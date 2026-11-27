import Decimal from "break_infinity.js";
import type { ResourceData } from "@/shared/types/Resource";
import {
    noRebellionPressurePopulation,
    stablePopulation
} from "@/test/fixtures/population";
import {
    createPopulationResources,
    createPopulationSystem,
    getSnapshot,
    patchPopulation,
    type PopulationSystemContract
} from "@/test/helpers/populationTestSetup";

type Population = Parameters<typeof stablePopulation>[0];

function setup(
    population = noRebellionPressurePopulation(),
    resourceOverrides: Record<string, Partial<ResourceData>> = {},
    options?: { random?: () => number }
): { system: PopulationSystemContract; resources: ReturnType<typeof createPopulationResources> } {
    const resources = createPopulationResources(resourceOverrides);
    const system = createPopulationSystem([population], resources, options);
    return { system, resources };
}

function systemWithRebellion(
    rebellion: string,
    populationOverrides: Population = { id: "Peasants" }
): PopulationSystemContract {
    const { system } = setup(
        noRebellionPressurePopulation({
            ...populationOverrides,
            id: populationOverrides.id,
            rebellion: {
                civilWarThreshold: "0.9",
                ...(populationOverrides.rebellion ?? {})
            }
        })
    );
    patchPopulation(system, "Peasants", { currentRebellion: rebellion });
    return system;
}

describe("PopulationSystem: бунт и забастовка", () => {
    it("начисляет давление бунта при нулевых покрытиях", () => {
        const { system } = setup(stablePopulation(), {
            Food: { count: "0" },
            Water: { count: "0" }
        });

        system.tick(new Decimal(0));

        const snapshot = getSnapshot(system);
        // foodCoverage = waterCoverage = housingCoverage = 0:
        // 0.1 + 0.05 + 0.05, satisfaction = 0
        expect(Number(snapshot.currentRebellion)).toBeCloseTo(0.2, 6);
        expect(Number(snapshot.satisfaction)).toBeCloseTo(0, 6);
    });

    it("снижает бунт на reliefRate × satisfaction при полном покрытии", () => {
        const { system } = setup(stablePopulation());
        patchPopulation(system, "Peasants", { currentRebellion: "0.5" });

        system.tick(new Decimal(100));

        expect(Number(getSnapshot(system).currentRebellion)).toBeCloseTo(0.48, 6);
    });

    it("не опускает бунт ниже 0", () => {
        const { system } = setup(stablePopulation());
        patchPopulation(system, "Peasants", { currentRebellion: "0.01" });

        system.tick(new Decimal(100));

        expect(Number(getSnapshot(system).currentRebellion)).toBeCloseTo(0, 6);
    });

    it("не поднимает бунт выше 1", () => {
        const { system } = setup(stablePopulation());
        patchPopulation(system, "Peasants", { currentRebellion: "0.95" });

        system.tick(new Decimal(0));

        expect(Number(getSnapshot(system).currentRebellion)).toBeCloseTo(1, 6);
    });

    it("при бунте 0.3 доступно 70% рабочих", () => {
        const system = systemWithRebellion("0.3");

        system.tick(new Decimal(100));

        expect(system.getAvailableWorkers().toNumber()).toBeCloseTo(7, 6);
    });

    it("между порогами доля рабочих снижается линейно", () => {
        const system = systemWithRebellion("0.45");

        system.tick(new Decimal(100));

        // 0.7 − 0.2 × ((0.45 − 0.3) / 0.3) = 0.6
        expect(system.getAvailableWorkers().toNumber()).toBeCloseTo(6, 6);
    });

    it("при бунте 0.6 доступно 50% рабочих", () => {
        const system = systemWithRebellion("0.6");

        system.tick(new Decimal(100));

        expect(system.getAvailableWorkers().toNumber()).toBeCloseTo(5, 6);
    });

    it("ниже порога доступны все рабочие", () => {
        const system = systemWithRebellion("0.29");

        system.tick(new Decimal(100));

        expect(system.getAvailableWorkers().toNumber()).toBeCloseTo(10, 6);
    });

    it("считает занятых и безработных по спросу зданий", () => {
        const system = systemWithRebellion("0.3");

        system.tick(new Decimal(100), new Decimal(4));

        const snapshot = getSnapshot(system);
        expect(Number(snapshot.availableWorkers)).toBeCloseTo(7, 6);
        expect(Number(snapshot.employedWorkers)).toBeCloseTo(4, 6);
        expect(Number(snapshot.unemployedWorkers)).toBeCloseTo(3, 6);
    });

    it("не оставляет безработных, если спрос выше доступных рабочих", () => {
        const system = systemWithRebellion("0.3");

        system.tick(new Decimal(100), new Decimal(20));

        const snapshot = getSnapshot(system);
        expect(Number(snapshot.employedWorkers)).toBeCloseTo(7, 6);
        expect(Number(snapshot.unemployedWorkers)).toBeCloseTo(0, 6);
    });
});

describe("PopulationSystem: гражданская война и поражение", () => {
    it("при бунте 0.6 и неудачном RNG наступает поражение", () => {
        const { system } = setup(
            noRebellionPressurePopulation({ id: "Peasants" }),
            {},
            { random: () => 0 }
        );
        patchPopulation(system, "Peasants", {
            currentRebellion: "0.6",
            civilWarCooldown: "0"
        });

        system.tick(new Decimal(100));

        expect(system.isDefeated()).toBe(true);
        expect(system.getDefeatReason()).toBe("civilWar");
    });

    it("при выживании теряет долю населения и уходит на кулдаун", () => {
        const { system } = setup(
            noRebellionPressurePopulation({ id: "Peasants" }),
            {},
            { random: () => 0.99 }
        );
        patchPopulation(system, "Peasants", {
            currentRebellion: "0.6",
            civilWarCooldown: "0"
        });

        system.tick(new Decimal(100));

        const snapshot = getSnapshot(system);
        expect(system.isDefeated()).toBe(false);
        expect(Number(snapshot.count)).toBeCloseTo(7, 6);
        expect(Number(snapshot.civilWarCooldown)).toBeCloseTo(50, 6);
        expect(Number(snapshot.availableWorkers)).toBeCloseTo(3.5, 6);
    });

    it("кулдаун блокирует новое событие и уменьшается на 1 за ход", () => {
        const { system } = setup(
            noRebellionPressurePopulation({ id: "Peasants" }),
            {},
            { random: () => 0 }
        );
        patchPopulation(system, "Peasants", {
            currentRebellion: "0.6",
            civilWarCooldown: "50"
        });

        system.tick(new Decimal(100));

        const snapshot = getSnapshot(system);
        expect(system.isDefeated()).toBe(false);
        expect(Number(snapshot.civilWarCooldown)).toBeCloseTo(49, 6);
    });
});

describe("PopulationSystem: предупреждения", () => {
    it("предупреждает о голоде", () => {
        const { system } = setup(
            stablePopulation({ id: "Peasants" }),
            { Food: { count: "0" } }
        );

        system.tick(new Decimal(100));

        expect(getSnapshot(system).warnings).toContain("hunger");
    });

    it("предупреждает о нехватке воды", () => {
        const { system } = setup(
            stablePopulation({ id: "Peasants" }),
            { Water: { count: "0" } }
        );

        system.tick(new Decimal(100));

        expect(getSnapshot(system).warnings).toContain("waterShortage");
    });

    it("предупреждает о бунте ниже порога забастовки", () => {
        const system = systemWithRebellion("0.1");

        system.tick(new Decimal(100));

        const warnings = getSnapshot(system).warnings;
        expect(warnings).toContain("rebellion");
        expect(warnings).not.toContain("strike");
    });

    it("предупреждает о забастовке при 0.3", () => {
        const system = systemWithRebellion("0.3");

        system.tick(new Decimal(100));

        const warnings = getSnapshot(system).warnings;
        expect(warnings).toContain("strike");
        expect(warnings).not.toContain("civilWar");
    });

    it("предупреждает о гражданской войне при 0.6", () => {
        const { system } = setup(
            noRebellionPressurePopulation({ id: "Peasants" }),
            {},
            { random: () => 0.99 }
        );
        patchPopulation(system, "Peasants", {
            currentRebellion: "0.6",
            civilWarCooldown: "10"
        });

        system.tick(new Decimal(100));

        expect(getSnapshot(system).warnings).toContain("civilWar");
    });
});
