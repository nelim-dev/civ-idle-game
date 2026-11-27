import Decimal from "break_infinity.js";
import type { Population } from "@/logic/services/Economy/PopulationSystem/PopulationSystem";
import * as PopulationModule from "@/logic/services/Economy/PopulationSystem/PopulationSystem";
import { ResourceManager } from "@/logic/services/Economy/ResourceSystem/ResourceManager";
import type { ResourceData } from "@/shared/types/Resource";
import type { EconomySnapshot } from "@/shared/types/Economy";
import { makeResourceData } from "@/test/fixtures/resources";

/**
 * Публичный контракт PopulationSystem на этапе 3.
 * Класса пока нет, поэтому тесты обращаются к модулю через контракт:
 * красная стадия падает при создании системы, а не при компиляции.
 */
export type FoodPolicy = "economy" | "normal" | "abundant";

export type DefeatReason = "extinction" | "civilWar" | null;

export type PopulationWarning =
    | "hunger"
    | "waterShortage"
    | "rebellion"
    | "strike"
    | "civilWar";

export interface PopulationSnapshot {
    id: string;
    name: string;
    icon: string;
    count: string;
    housingRequired: string;
    housingCapacity: string;
    foodPolicy: FoodPolicy;
    foodCoverage: string;
    waterCoverage: string;
    housingCoverage: string;
    satisfaction: string;
    currentGrowth: string;
    currentMortality: string;
    currentRebellion: string;
    availableWorkers: string;
    employedWorkers: string;
    unemployedWorkers: string;
    civilWarCooldown: string;
    isDefeated: boolean;
    defeatReason: DefeatReason;
    warnings: PopulationWarning[];
}

export interface SavedPopulationState {
    count: string;
    currentRebellion: string;
    civilWarCooldown: string;
    foodPolicy: FoodPolicy;
}

export interface PopulationSystemContract {
    tick(housingCapacity: Decimal, workerDemand?: Decimal): void;
    setFoodPolicy(policy: FoodPolicy): void;
    getAvailableWorkers(): Decimal;
    isDefeated(): boolean;
    getDefeatReason(): DefeatReason;
    serializeForStore(): { population: Record<string, PopulationSnapshot> };
    serializeForSave(): { population: Record<string, SavedPopulationState> };
    deserializeForSave(data: Record<string, unknown>): void;
}

type PopulationSystemConstructor = new (
    populationData: Population[],
    resourceManager: ResourceManager,
    options?: { random?: () => number }
) => PopulationSystemContract;

const PopulationSystemConstructorRef = (
    PopulationModule as unknown as {
        PopulationSystem: PopulationSystemConstructor;
    }
).PopulationSystem;

export function createPopulationSystem(
    populationData: Population[],
    resourceManager: ResourceManager,
    options?: { random?: () => number }
): PopulationSystemContract {
    if (typeof PopulationSystemConstructorRef !== "function") {
        throw new Error(
            "PopulationSystem не реализован: модуль не экспортирует класс PopulationSystem"
        );
    }
    return new PopulationSystemConstructorRef(populationData, resourceManager, options);
}

const BASE_RESOURCE_DATA: ResourceData[] = [
    makeResourceData({ id: "Food", count: "1000", storage: "10000" }),
    makeResourceData({ id: "Water", count: "1000", storage: "10000" }),
    makeResourceData({ id: "Wood", count: "0", storage: "10000" }),
    makeResourceData({ id: "BuildPower", count: "0", storage: "0", spoilRate: "1" })
];

export function createPopulationResourceData(
    overrides: Record<string, Partial<ResourceData>> = {}
): ResourceData[] {
    return BASE_RESOURCE_DATA.map((resource) => ({
        ...resource,
        ...(overrides[resource.id] ?? {})
    }));
}

export function createPopulationResources(
    overrides: Record<string, Partial<ResourceData>> = {}
): ResourceManager {
    return new ResourceManager(createPopulationResourceData(overrides));
}

export function getCount(resourceManager: ResourceManager, id: string): Decimal {
    const value = resourceManager.getResourceCount(id);
    if (value === null) {
        throw new Error(`Ресурс ${id} не найден`);
    }
    return value;
}

export function expectCount(
    resourceManager: ResourceManager,
    id: string,
    expected: string | number | Decimal
): void {
    expect(getCount(resourceManager, id).toNumber()).toBeCloseTo(
        new Decimal(expected).toNumber(),
        6
    );
}

export function getSnapshot(
    system: PopulationSystemContract,
    id = "Peasants"
): PopulationSnapshot {
    const snapshot = system.serializeForStore().population[id];
    if (!snapshot) {
        throw new Error(`В снимке нет населения ${id}`);
    }
    return snapshot;
}

export function patchPopulation(
    system: PopulationSystemContract,
    id: string,
    patch: Partial<SavedPopulationState>
): void {
    const data = system.serializeForSave();
    const existing = data.population[id];
    if (!existing) {
        throw new Error(`В сейве нет населения ${id}`);
    }
    data.population[id] = { ...existing, ...patch };
    system.deserializeForSave(data);
}

export type EconomySnapshotContract = EconomySnapshot & {
    population?: Record<string, PopulationSnapshot>;
    warnings?: PopulationWarning[];
};
