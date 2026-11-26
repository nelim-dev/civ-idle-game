import { EconomySystem } from "./EconomySystem";
import { EventBus } from "@/logic/EventBus";
import type { BuildingData } from "./BuildingSystem/Building";
import type { ResourceData } from "@/shared/types/Resource";
import { makeResourceData } from "@/test/fixtures/resources";

function makeBuildingData(
    overrides: Partial<BuildingData> & Pick<BuildingData, "id">
): BuildingData {
    const { id, ...rest } = overrides;
    return {
        id,
        name: id,
        description: "",
        icon: "",
        category: "production",
        era: "1",
        extraction: false,
        produces: {},
        consumes: {},
        workersRequired: "0",
        hp: "100",
        maxHp: "100",
        decayPerTurn: "0",
        cost: {},
        priority: "0",
        power: "100",
        level: "1",
        maxLevel: "1",
        open: true,
        storageBonus: {},
        housingCapacity: "0",
        owned: "0",
        ...rest
    };
}

const BASE_RESOURCES: ResourceData[] = [
    makeResourceData({ id: "Wood", count: "1000", storage: "10000" }),
    makeResourceData({ id: "Stone", count: "1000", storage: "10000" }),
    makeResourceData({ id: "Water", count: "100", storage: "10000" }),
    makeResourceData({ id: "Food", count: "0", storage: "10000" }),
    makeResourceData({
        id: "Tree",
        owner: "nature",
        count: "1000",
        storage: "10000"
    }),
    makeResourceData({
        id: "WaterDeposit",
        owner: "nature",
        count: "100",
        storage: "10000"
    }),
    makeResourceData({
        id: "BuildPower",
        count: "0",
        storage: "0",
        spoilRate: "1"
    })
];

function createResources(
    overrides: Record<string, Partial<ResourceData>> = {}
): ResourceData[] {
    return BASE_RESOURCES.map((resource) => ({
        ...resource,
        ...(overrides[resource.id] ?? {})
    }));
}

/**
 * Ожидаемый контракт этапа 2: EconomySystem создаёт BuildingManager из
 * buildings.json и агрегирует его состояние в снимке и сейве.
 */
type EconomySystemConstructor = new (
    eventBus: EventBus,
    resourcesData: ResourceData[],
    buildingsData: BuildingData[]
) => EconomySystem;

function createSystem(
    buildings: BuildingData[],
    resources: ResourceData[] = createResources()
): { system: EconomySystem; eventBus: EventBus } {
    const eventBus = new EventBus();
    const Constructor = EconomySystem as unknown as EconomySystemConstructor;
    return {
        system: new Constructor(eventBus, resources, buildings),
        eventBus
    };
}

interface SnapshotWithBuildings {
    resources: Record<string, { count: string }>;
    buildings: Record<
        string,
        {
            owned: string;
            level?: string;
            power?: string;
            priority?: string;
            efficiency?: string;
            decayLevel?: string;
        }
    >;
    constructionProjects: Array<{
        buildingId: string;
        count: string;
        progress: string;
        requiredPower: string;
        priority: string;
    }>;
}

function snapshot(system: EconomySystem): SnapshotWithBuildings {
    return system.serialize() as unknown as SnapshotWithBuildings;
}

function centralBase(overrides: Partial<BuildingData> = {}): BuildingData {
    return makeBuildingData({
        id: "CentralBase",
        category: "infrastructure",
        produces: { BuildPower: "20" },
        owned: "1",
        priority: "1",
        housingCapacity: "30",
        ...overrides
    });
}

describe("EconomySystem: здания", () => {
    it("снимок содержит здания и пустую очередь строительства", () => {
        const { system } = createSystem([centralBase()]);

        const state = snapshot(system);

        expect(state.buildings.CentralBase).toBeDefined();
        expect(state.buildings.CentralBase.owned).toBe("1");
        expect(state.constructionProjects).toEqual([]);
    });

    it("сохранение включает здания", () => {
        const { system } = createSystem([centralBase()]);

        const saved = system.serializeForSave();

        expect(saved.economy.buildingsManager).toBeDefined();
        expect(saved.economy.buildingsManager.buildings.CentralBase.owned).toBe("1");
    });

    it("загрузка восстанавливает состояние зданий", () => {
        const first = createSystem([centralBase()]);
        const saved = first.system.serializeForSave();
        saved.economy.buildingsManager.buildings.CentralBase.owned = "5";

        const second = createSystem([centralBase()]);
        second.system.deserializeForSave(saved);

        expect(snapshot(second.system).buildings.CentralBase.owned).toBe("5");
    });

    it("производство зданий выполняется до конца хода и подчиняется порче", () => {
        const farm = makeBuildingData({
            id: "Farm",
            produces: { Food: "10" },
            owned: "1"
        });
        const resources = createResources({
            Food: { count: "0", storage: "5", spoilRate: "1" }
        });
        const { system, eventBus } = createSystem([farm], resources);

        eventBus.emit("tick");

        expect(Number(snapshot(system).resources.Food.count)).toBeCloseTo(5, 6);
    });
});
