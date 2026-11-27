import type { Population } from "@/logic/services/Economy/PopulationSystem/PopulationSystem";

type PopulationOverrides = Partial<
    Omit<Population, "growth" | "mortality" | "rebellion" | "consumes">
> &
    Pick<Population, "id"> & {
        growth?: Partial<Population["growth"]>;
        mortality?: Partial<Population["mortality"]>;
        rebellion?: Partial<Population["rebellion"]>;
        consumes?: Record<string, string>;
    };

/**
 * Фикстура населения для unit-тестов этапа 3.
 * Значения заданы явно, чтобы тесты не зависели от src/data/population.json.
 */
export function makePopulationData(overrides: PopulationOverrides): Population {
    const { growth, mortality, rebellion, consumes, ...rest } = overrides;

    return {
        id: rest.id,
        name: rest.name ?? "Крестьяне",
        icon: rest.icon ?? "",
        description: rest.description ?? "",
        count: rest.count ?? "10",
        housingRequired: rest.housingRequired ?? "1",
        consumes: {
            Food: "0.01",
            Water: "0.01",
            ...(consumes ?? {})
        },
        growth: {
            baseRate: "0.005",
            foodBonus: "0.005",
            housingBonus: "0.002",
            maxGrowthRate: "0.01",
            ...(growth ?? {})
        },
        mortality: {
            baseRate: "0",
            foodPenalty: "0.01",
            waterPenalty: "0.005",
            housingPenalty: "0.005",
            maxMortalityRate: "0.01",
            ...(mortality ?? {})
        },
        rebellion: {
            threshold: "0.3",
            civilWarThreshold: "0.6",
            foodPenalty: "0.1",
            waterPenalty: "0.05",
            housingPenalty: "0.05",
            reliefRate: "0.02",
            strikeWorkerFactor: "0.7",
            civilWarChance: "0.5",
            civilWarLoss: "0.3",
            civilWarCooldown: "50",
            ...(rebellion ?? {})
        },
        open: rest.open ?? true,
        era: rest.era ?? "1"
    };
}

/** Население без роста и смертности: удобно для тестов порядка фаз. */
export function stablePopulation(
    overrides: PopulationOverrides = { id: "Peasants" }
): Population {
    return makePopulationData({
        ...overrides,
        id: overrides.id,
        growth: {
            baseRate: "0",
            foodBonus: "0",
            housingBonus: "0",
            maxGrowthRate: "0",
            ...(overrides.growth ?? {})
        },
        mortality: {
            baseRate: "0",
            foodPenalty: "0",
            waterPenalty: "0",
            housingPenalty: "0",
            maxMortalityRate: "0",
            ...(overrides.mortality ?? {})
        }
    });
}

/** Население без давления и спада бунта: бунт задаётся тестом напрямую. */
export function noRebellionPressurePopulation(
    overrides: PopulationOverrides = { id: "Peasants" }
): Population {
    return stablePopulation({
        ...overrides,
        id: overrides.id,
        rebellion: {
            foodPenalty: "0",
            waterPenalty: "0",
            housingPenalty: "0",
            reliefRate: "0",
            ...(overrides.rebellion ?? {})
        }
    });
}
