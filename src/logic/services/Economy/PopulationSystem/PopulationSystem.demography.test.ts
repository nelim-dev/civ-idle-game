import Decimal from "break_infinity.js";
import type { ResourceData } from "@/shared/types/Resource";
import { makePopulationData } from "@/test/fixtures/population";
import {
    createPopulationResources,
    createPopulationSystem,
    getSnapshot,
    type PopulationSystemContract
} from "@/test/helpers/populationTestSetup";

type PopulationOverrides = Parameters<typeof makePopulationData>[0];

const NO_GROWTH = {
    baseRate: "0",
    foodBonus: "0",
    housingBonus: "0",
    maxGrowthRate: "0"
};

const NO_MORTALITY = {
    baseRate: "0",
    foodPenalty: "0",
    waterPenalty: "0",
    housingPenalty: "0",
    maxMortalityRate: "0"
};

function setup(
    populationOverrides: PopulationOverrides,
    resourceOverrides: Record<string, Partial<ResourceData>> = {}
): { system: PopulationSystemContract; resources: ReturnType<typeof createPopulationResources> } {
    const resources = createPopulationResources(resourceOverrides);
    const system = createPopulationSystem(
        [makePopulationData(populationOverrides)],
        resources
    );
    return { system, resources };
}

describe("PopulationSystem: рост и смертность", () => {
    it("растёт при полном покрытии и свободном жилье", () => {
        const { system } = setup({
            id: "Peasants",
            count: "100",
            mortality: NO_MORTALITY
        });

        system.tick(new Decimal(200));

        // growthRate = min(0.01, 0.005 + 0.005 + 0.002) = 0.01
        expect(Number(getSnapshot(system).count)).toBeCloseTo(101, 6);
    });

    it("ограничивает рост максимальной ставкой", () => {
        const { system } = setup({
            id: "Peasants",
            count: "100",
            growth: {
                baseRate: "0.02",
                foodBonus: "0.02",
                housingBonus: "0.02",
                maxGrowthRate: "0.01"
            },
            mortality: NO_MORTALITY
        });

        system.tick(new Decimal(200));

        expect(Number(getSnapshot(system).count)).toBeCloseTo(101, 6);
    });

    it("не растёт при заполненном жилье", () => {
        const { system } = setup({
            id: "Peasants",
            count: "10",
            mortality: NO_MORTALITY
        });

        system.tick(new Decimal(10));

        const snapshot = getSnapshot(system);
        expect(Number(snapshot.currentGrowth)).toBeCloseTo(0, 6);
        expect(Number(snapshot.count)).toBeCloseTo(10, 6);
    });

    it("не растёт при нехватке еды и повышает смертность", () => {
        const { system } = setup(
            { id: "Peasants", count: "10" },
            { Food: { count: "0" } }
        );

        system.tick(new Decimal(100));

        const snapshot = getSnapshot(system);
        expect(Number(snapshot.currentGrowth)).toBeCloseTo(0, 6);
        // mortality = min(0.01, 0 + 0.01 + 0 + 0) = 0.01
        expect(Number(snapshot.count)).toBeCloseTo(9.9, 6);
    });

    it("не растёт при нехватке воды и повышает смертность", () => {
        const { system } = setup(
            { id: "Peasants", count: "10" },
            { Water: { count: "0" } }
        );

        system.tick(new Decimal(100));

        const snapshot = getSnapshot(system);
        expect(Number(snapshot.currentGrowth)).toBeCloseTo(0, 6);
        // mortality = min(0.01, 0 + 0 + 0.005 + 0) = 0.005
        expect(Number(snapshot.count)).toBeCloseTo(9.95, 6);
    });

    it("при полном покрытии смертность равна базовой", () => {
        const { system } = setup({
            id: "Peasants",
            count: "10",
            growth: NO_GROWTH,
            mortality: {
                baseRate: "0.001",
                foodPenalty: "0",
                waterPenalty: "0",
                housingPenalty: "0",
                maxMortalityRate: "0.1"
            }
        });

        system.tick(new Decimal(100));

        const snapshot = getSnapshot(system);
        expect(Number(snapshot.currentMortality)).toBeCloseTo(0.001, 6);
        expect(Number(snapshot.count)).toBeCloseTo(9.99, 6);
    });

    it("считает смертность по формуле при нехватке всех потребностей", () => {
        const { system } = setup(
            {
                id: "Peasants",
                count: "10",
                growth: NO_GROWTH
            },
            {
                Food: { count: "0" },
                Water: { count: "0" }
            }
        );

        system.tick(new Decimal(0));

        const snapshot = getSnapshot(system);
        // min(0.01, 0 + 0.01 + 0.005 + 0.005) = 0.01
        expect(Number(snapshot.currentMortality)).toBeCloseTo(0.01, 6);
        expect(Number(snapshot.count)).toBeCloseTo(9.9, 6);
    });

    it("ограничивает смертность максимальной ставкой", () => {
        const { system } = setup({
            id: "Peasants",
            count: "10",
            growth: NO_GROWTH,
            mortality: {
                baseRate: "0.5",
                foodPenalty: "0",
                waterPenalty: "0",
                housingPenalty: "0",
                maxMortalityRate: "0.01"
            }
        });

        system.tick(new Decimal(100));

        const snapshot = getSnapshot(system);
        expect(Number(snapshot.currentMortality)).toBeCloseTo(0.01, 6);
        expect(Number(snapshot.count)).toBeCloseTo(9.9, 6);
    });

    it("не уводит население в минус и фиксирует поражение при вымирании", () => {
        const { system } = setup({
            id: "Peasants",
            count: "1",
            growth: NO_GROWTH,
            mortality: {
                baseRate: "1",
                foodPenalty: "0",
                waterPenalty: "0",
                housingPenalty: "0",
                maxMortalityRate: "1"
            }
        });

        system.tick(new Decimal(100));

        const snapshot = getSnapshot(system);
        expect(Number(snapshot.count)).toBe(0);
        expect(system.isDefeated()).toBe(true);
        expect(system.getDefeatReason()).toBe("extinction");
    });
});
