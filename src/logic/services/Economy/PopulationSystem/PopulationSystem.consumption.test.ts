import Decimal from "break_infinity.js";
import type { ResourceData } from "@/shared/types/Resource";
import {
    makePopulationData,
    stablePopulation
} from "@/test/fixtures/population";
import {
    createPopulationResources,
    createPopulationSystem,
    expectCount,
    getSnapshot,
    type PopulationSystemContract
} from "@/test/helpers/populationTestSetup";

type PopulationOverrides = Parameters<typeof makePopulationData>[0];

function setup(
    populationOverrides: PopulationOverrides = { id: "Peasants" },
    resourceOverrides: Record<string, Partial<ResourceData>> = {}
): { system: PopulationSystemContract; resources: ReturnType<typeof createPopulationResources> } {
    const resources = createPopulationResources(resourceOverrides);
    const system = createPopulationSystem(
        [makePopulationData(populationOverrides)],
        resources
    );
    return { system, resources };
}

function stableSetup(
    resourceOverrides: Record<string, Partial<ResourceData>> = {},
    populationOverrides: PopulationOverrides = { id: "Peasants" }
): { system: PopulationSystemContract; resources: ReturnType<typeof createPopulationResources> } {
    const resources = createPopulationResources(resourceOverrides);
    const system = createPopulationSystem(
        [stablePopulation(populationOverrides)],
        resources
    );
    return { system, resources };
}

describe("PopulationSystem: потребление, покрытия и жильё", () => {
    it("стартовое состояние берётся из данных населения", () => {
        const { system } = setup();

        const snapshot = getSnapshot(system);

        expect(Number(snapshot.count)).toBe(10);
        expect(Number(snapshot.currentRebellion)).toBe(0);
        expect(Number(snapshot.civilWarCooldown)).toBe(0);
        expect(snapshot.foodPolicy).toBe("normal");
        expect(system.isDefeated()).toBe(false);
    });

    it("потребляет еду и воду по норме", () => {
        const { system, resources } = stableSetup();

        system.tick(new Decimal(100));

        expectCount(resources, "Food", 999.9);
        expectCount(resources, "Water", 999.9);
        const snapshot = getSnapshot(system);
        expect(Number(snapshot.foodCoverage)).toBeCloseTo(1, 6);
        expect(Number(snapshot.waterCoverage)).toBeCloseTo(1, 6);
    });

    it("нехватка еды даёт частичное покрытие и не уводит ресурс в минус", () => {
        const { system, resources } = stableSetup({
            Food: { count: "0.05" }
        });

        system.tick(new Decimal(100));

        expectCount(resources, "Food", 0);
        expect(Number(getSnapshot(system).foodCoverage)).toBeCloseTo(0.5, 6);
    });

    it("политика экономии снижает расход еды до 50% и не трогает воду", () => {
        const { system, resources } = stableSetup();

        system.setFoodPolicy("economy");
        system.tick(new Decimal(100));

        expectCount(resources, "Food", 999.95);
        expectCount(resources, "Water", 999.9);
    });

    it("политика вдоволь повышает расход еды до 150% и не трогает воду", () => {
        const { system, resources } = stableSetup();

        system.setFoodPolicy("abundant");
        system.tick(new Decimal(100));

        expectCount(resources, "Food", 999.85);
        expectCount(resources, "Water", 999.9);
    });

    it("покрытия еды и воды независимы", () => {
        const { system, resources } = stableSetup({
            Food: { count: "0.05" },
            Water: { count: "1000" }
        });

        system.tick(new Decimal(100));

        const snapshot = getSnapshot(system);
        expectCount(resources, "Food", 0);
        expectCount(resources, "Water", 999.9);
        expect(Number(snapshot.foodCoverage)).toBeCloseTo(0.5, 6);
        expect(Number(snapshot.waterCoverage)).toBeCloseTo(1, 6);
    });

    it("считает покрытие жилья от переданной вместимости", () => {
        const full = stableSetup();
        full.system.tick(new Decimal(10));
        expect(Number(getSnapshot(full.system).housingCoverage)).toBeCloseTo(1, 6);

        const half = stableSetup();
        half.system.tick(new Decimal(5));
        expect(Number(getSnapshot(half.system).housingCoverage)).toBeCloseTo(0.5, 6);

        const none = stableSetup();
        none.system.tick(new Decimal(0));
        expect(Number(getSnapshot(none.system).housingCoverage)).toBeCloseTo(0, 6);
    });

    it("удовлетворённость равна минимальному покрытию", () => {
        const { system } = stableSetup();

        system.tick(new Decimal(5));

        const snapshot = getSnapshot(system);
        expect(Number(snapshot.satisfaction)).toBeCloseTo(0.5, 6);
    });

    it("население 0 не потребляет ресурсы и означает поражение", () => {
        const { system, resources } = setup({ id: "Peasants", count: "0" });

        system.tick(new Decimal(100));

        expectCount(resources, "Food", 1000);
        expectCount(resources, "Water", 1000);
        expect(system.isDefeated()).toBe(true);
        expect(system.getDefeatReason()).toBe("extinction");
        expect(Number(getSnapshot(system).count)).toBe(0);
    });
});
