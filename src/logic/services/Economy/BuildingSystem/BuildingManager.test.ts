import Decimal from "break_infinity.js";
import { BuildingManager } from "./BuildingManager";
import type { BuildingData } from "./Building";
import { ResourceManager } from "../ResourceSystem/ResourceManager";
import type { ResourceData } from "@/shared/types/Resource";
import { makeResourceData } from "@/test/fixtures/resources";

function d(value: string | number): Decimal {
    return new Decimal(value);
}

/**
 * Ожидаемый публичный контракт BuildingManager на этапе 2.
 * Тесты фиксируют его до реализации; сам класс пока содержит заглушки.
 *
 * Новые методы относительно текущего класса:
 * - tick(availableWorkers) — доступные рабочие приходят из PopulationSystem
 *   (этап 3), до неё это входной параметр тика;
 * - setMaintenanceEnabled — переключатель поддержания группы зданий;
 * - cancelBuild — отмена проекта строительства без возврата ресурсов.
 */
interface BuildingManagerContract {
    tick(availableWorkers?: Decimal): void;
    build(buildingId: string, count: Decimal): boolean;
    destroyBuilding(buildingId: string, count: Decimal): boolean;
    dealBuildingDamage(buildingId: string, amount: Decimal): void;
    setConstructionPriority(buildingId: string, priority: Decimal): void;
    setPower(buildingId: string, power: Decimal): void;
    setPriority(buildingId: string, priority: Decimal): void;
    setMaintenanceEnabled(buildingId: string, enabled: boolean): boolean;
    cancelBuild(buildingId: string): boolean;
    serializeForSave(): SavedBuildingManager;
    deserializeForSave(data: SavedBuildingManager): void;
}

interface SavedBuildingState {
    owned: string;
    power: string;
    priority: string;
    level: string;
    decayLevel: string;
    efficiency: string;
    hpSum: string;
    maxHpSum: string;
}

interface SavedConstructionProject {
    buildingId: string;
    count: string;
    progress: string;
    requiredPower: string;
    priority: string;
}

interface SavedBuildingManager {
    buildingsManager: {
        buildings: Record<string, SavedBuildingState>;
        constructionProjects: SavedConstructionProject[];
    };
}

function asContract(manager: BuildingManager): BuildingManagerContract {
    return manager as unknown as BuildingManagerContract;
}

function save(manager: BuildingManagerContract): SavedBuildingManager {
    return manager.serializeForSave();
}

function savedBuilding(
    manager: BuildingManagerContract,
    buildingId: string
): SavedBuildingState {
    const state = save(manager).buildingsManager.buildings[buildingId];
    if (!state) {
        throw new Error(`Нет состояния здания ${buildingId}`);
    }
    return state;
}

function savedBuildingNumber(
    manager: BuildingManagerContract,
    buildingId: string,
    field: keyof SavedBuildingState
): number {
    return Number(savedBuilding(manager, buildingId)[field]);
}

function savedProjects(
    manager: BuildingManagerContract
): SavedConstructionProject[] {
    return save(manager).buildingsManager.constructionProjects;
}

/** Задаёт runtime-состояние здания через публичный lossless-формат. */
function patchBuilding(
    manager: BuildingManagerContract,
    buildingId: string,
    patch: Partial<SavedBuildingState>
): void {
    const data = save(manager);
    data.buildingsManager.buildings[buildingId] = {
        ...data.buildingsManager.buildings[buildingId],
        ...patch
    };
    manager.deserializeForSave(data);
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

function createResourceManager(
    overrides: Record<string, Partial<ResourceData>> = {}
): ResourceManager {
    const data = BASE_RESOURCES.map((resource) => ({
        ...resource,
        ...(overrides[resource.id] ?? {})
    }));
    return new ResourceManager(data);
}

function getCount(resourceManager: ResourceManager, id: string): Decimal {
    const value = resourceManager.getResourceCount(id);
    if (!value) {
        throw new Error(`Ресурс ${id} не найден`);
    }
    return value;
}

function expectCount(
    resourceManager: ResourceManager,
    id: string,
    expected: string | number
): void {
    expect(getCount(resourceManager, id).toNumber()).toBeCloseTo(
        new Decimal(expected).toNumber(),
        6
    );
}

function getStorage(resourceManager: ResourceManager, id: string): Decimal {
    const value = resourceManager.getResourceStorage(id);
    if (!value) {
        throw new Error(`Ресурс ${id} не найден`);
    }
    return value;
}

type BuildingOverrides = Partial<BuildingData> & Pick<BuildingData, "id">;

function makeBuildingData(overrides: BuildingOverrides): BuildingData {
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

function farm(overrides: Partial<BuildingData> = {}): BuildingData {
    return makeBuildingData({
        id: "Farm",
        produces: { Food: "10" },
        consumes: { Water: "5" },
        workersRequired: "10",
        owned: "1",
        priority: "1",
        ...overrides
    });
}

function sawmill(overrides: Partial<BuildingData> = {}): BuildingData {
    return makeBuildingData({
        id: "Sawmill",
        cost: { Wood: "50", Stone: "20", BuildPower: "200" },
        owned: "0",
        ...overrides
    });
}

function decaying(overrides: Partial<BuildingData> = {}): BuildingData {
    return makeBuildingData({
        id: "Decaying",
        cost: { Wood: "100" },
        decayPerTurn: "1",
        owned: "1",
        ...overrides
    });
}

interface SetupOptions {
    buildings: BuildingData[];
    resources?: Record<string, Partial<ResourceData>>;
}

function setup({ buildings, resources = {} }: SetupOptions): {
    manager: BuildingManagerContract;
    resourceManager: ResourceManager;
} {
    const resourceManager = createResourceManager(resources);
    const manager = asContract(new BuildingManager(buildings, resourceManager));
    return { manager, resourceManager };
}

describe("BuildingManager: производство и потребление", () => {
    it("производит и потребляет с полной загрузкой", () => {
        const { manager, resourceManager } = setup({ buildings: [farm()] });

        manager.tick(d(10));

        expectCount(resourceManager, "Food", 10);
        expectCount(resourceManager, "Water", 95);
    });

    it("масштабирует производство по обеспеченности рабочими", () => {
        const { manager, resourceManager } = setup({ buildings: [farm()] });

        manager.tick(d(5));

        expectCount(resourceManager, "Food", 5);
        expectCount(resourceManager, "Water", 97.5);
    });

    it("умножает базовые ставки на количество зданий", () => {
        const { manager, resourceManager } = setup({
            buildings: [farm({ owned: "2" })]
        });

        manager.tick(d(20));

        expectCount(resourceManager, "Food", 20);
        expectCount(resourceManager, "Water", 90);
    });

    it("power 50 снижает производство и потребление вдвое", () => {
        const { manager, resourceManager } = setup({ buildings: [farm()] });
        manager.setPower("Farm", d(50));

        manager.tick(d(10));

        expectCount(resourceManager, "Food", 5);
        expectCount(resourceManager, "Water", 97.5);
    });

    it("power 0 останавливает производство и потребление", () => {
        const control = makeBuildingData({
            id: "Control",
            produces: { Stone: "10" },
            owned: "1"
        });
        const { manager, resourceManager } = setup({
            buildings: [farm(), control]
        });
        manager.setPower("Farm", d(0));

        manager.tick(d(10));

        expectCount(resourceManager, "Food", 0);
        expectCount(resourceManager, "Water", 100);
        expectCount(resourceManager, "Stone", 1010);
    });

    it("уровень 2 даёт +10% к производству и потреблению", () => {
        const { manager, resourceManager } = setup({
            buildings: [farm({ level: "2", maxLevel: "5" })]
        });

        manager.tick(d(10));

        expectCount(resourceManager, "Food", 11);
        expectCount(resourceManager, "Water", 94.5);
    });

    it("износ 50% снижает эффективность вдвое", () => {
        const { manager, resourceManager } = setup({
            buildings: [farm({ decayPerTurn: "0" })]
        });
        patchBuilding(manager, "Farm", { decayLevel: "50" });

        manager.tick(d(10));

        expectCount(resourceManager, "Food", 5);
        expectCount(resourceManager, "Water", 97.5);
    });

    it("при нехватке входа масштабирует и производство, и потребление", () => {
        const { manager, resourceManager } = setup({
            buildings: [farm()],
            resources: { Water: { count: "2" } }
        });

        manager.tick(d(10));

        expectCount(resourceManager, "Food", 4);
        expectCount(resourceManager, "Water", 0);
    });

    it("не даёт обратной связи: произведённая вода не потребляется в том же ходу", () => {
        const well = makeBuildingData({
            id: "Well",
            extraction: true,
            produces: { Water: "10" },
            consumes: { Tree: "10" },
            owned: "1",
            priority: "1"
        });
        const waterFarm = farm({
            id: "WaterFarm",
            produces: { Food: "10" },
            consumes: { Water: "10" },
            workersRequired: "0"
        });
        const { manager, resourceManager } = setup({
            buildings: [well, waterFarm],
            resources: {
                Water: { count: "0" },
                Tree: { count: "100" }
            }
        });

        manager.tick(d(0));

        expectCount(resourceManager, "Water", 10);
        expectCount(resourceManager, "Food", 0);
        expectCount(resourceManager, "Tree", 90);

        manager.tick(d(0));

        expectCount(resourceManager, "Water", 10);
        expectCount(resourceManager, "Food", 10);
        expectCount(resourceManager, "Tree", 80);
    });

    it("добыча переводит природный ресурс на склад игрока", () => {
        const pit = makeBuildingData({
            id: "Pit",
            extraction: true,
            produces: { Water: "1" },
            consumes: { WaterDeposit: "1" },
            owned: "1"
        });
        const { manager, resourceManager } = setup({
            buildings: [pit],
            resources: {
                Water: { count: "0" },
                WaterDeposit: { count: "10" }
            }
        });

        manager.tick(d(0));

        expectCount(resourceManager, "Water", 1);
        expectCount(resourceManager, "WaterDeposit", 9);
    });

    it("при истощении природного пула добыча останавливается", () => {
        const pit = makeBuildingData({
            id: "Pit",
            extraction: true,
            produces: { Water: "1" },
            consumes: { WaterDeposit: "1" },
            owned: "1"
        });
        const control = makeBuildingData({
            id: "Control",
            produces: { Food: "10" },
            owned: "1"
        });
        const { manager, resourceManager } = setup({
            buildings: [pit, control],
            resources: {
                Water: { count: "0" },
                WaterDeposit: { count: "0" }
            }
        });

        manager.tick(d(0));

        expectCount(resourceManager, "Water", 0);
        expectCount(resourceManager, "Food", 10);
    });
});

describe("BuildingManager: распределение рабочих", () => {
    it("делит рабочих пропорционально потребности внутри одного приоритета", () => {
        const producerA = makeBuildingData({
            id: "ProducerA",
            produces: { Food: "10" },
            workersRequired: "10",
            owned: "1"
        });
        const producerB = makeBuildingData({
            id: "ProducerB",
            produces: { Food: "10" },
            workersRequired: "10",
            owned: "1"
        });
        const { manager, resourceManager } = setup({
            buildings: [producerA, producerB]
        });

        manager.tick(d(10));

        expectCount(resourceManager, "Food", 10);
        expect(savedBuildingNumber(manager, "ProducerA", "efficiency")).toBeCloseTo(0.5, 6);
        expect(savedBuildingNumber(manager, "ProducerB", "efficiency")).toBeCloseTo(0.5, 6);
    });

    it("сначала обеспечивает рабочими здания с более высоким приоритетом", () => {
        const producerA = makeBuildingData({
            id: "ProducerA",
            produces: { Food: "10" },
            workersRequired: "10",
            owned: "1",
            priority: "1"
        });
        const producerB = makeBuildingData({
            id: "ProducerB",
            produces: { Food: "10" },
            workersRequired: "10",
            owned: "1",
            priority: "0"
        });
        const { manager, resourceManager } = setup({
            buildings: [producerA, producerB]
        });

        manager.tick(d(10));

        expectCount(resourceManager, "Food", 10);
        expect(savedBuildingNumber(manager, "ProducerA", "efficiency")).toBeCloseTo(1, 6);
        expect(savedBuildingNumber(manager, "ProducerB", "efficiency")).toBeCloseTo(0, 6);
    });

    it("считает workerFill равным 1, если рабочие не требуются", () => {
        const { manager, resourceManager } = setup({
            buildings: [farm({ workersRequired: "0" })]
        });

        manager.tick(d(0));

        expectCount(resourceManager, "Food", 10);
    });
});

describe("BuildingManager: приоритеты ресурсов", () => {
    it("сначала удовлетворяет запросы здания с более высоким приоритетом", () => {
        const high = makeBuildingData({
            id: "High",
            produces: { Food: "10" },
            consumes: { Water: "10" },
            owned: "1",
            priority: "1"
        });
        const low = makeBuildingData({
            id: "Low",
            produces: { Wood: "10" },
            consumes: { Water: "10" },
            owned: "1",
            priority: "0"
        });
        const { manager, resourceManager } = setup({
            buildings: [high, low],
            resources: { Water: { count: "10" } }
        });

        manager.tick(d(0));

        expectCount(resourceManager, "Food", 10);
        expectCount(resourceManager, "Wood", 1000);
        expectCount(resourceManager, "Water", 0);

        manager.setPriority("High", d(0));
        manager.setPriority("Low", d(1));
        resourceManager.setResourceCount("Water", d(10));

        manager.tick(d(0));

        expectCount(resourceManager, "Food", 10);
        expectCount(resourceManager, "Wood", 1010);
        expectCount(resourceManager, "Water", 0);
    });
});

describe("BuildingManager: склады", () => {
    it("применяет storageBonus зданий и не накапливает его повторно", () => {
        const warehouse = makeBuildingData({
            id: "Warehouse",
            category: "storage",
            storageBonus: { Wood: "200" },
            owned: "2"
        });
        const { manager, resourceManager } = setup({
            buildings: [warehouse],
            resources: { Wood: { count: "0", storage: "10" } }
        });

        manager.tick(d(0));

        expect(getStorage(resourceManager, "Wood").toNumber()).toBeCloseTo(410, 6);

        manager.tick(d(0));

        expect(getStorage(resourceManager, "Wood").toNumber()).toBeCloseTo(410, 6);
    });

    it("не добавляет storageBonus для зданий с owned = 0", () => {
        const emptyWarehouse = makeBuildingData({
            id: "EmptyWarehouse",
            category: "storage",
            storageBonus: { Wood: "200" },
            owned: "0"
        });
        const activeWarehouse = makeBuildingData({
            id: "ActiveWarehouse",
            category: "storage",
            storageBonus: { Wood: "100" },
            owned: "1"
        });
        const { manager, resourceManager } = setup({
            buildings: [emptyWarehouse, activeWarehouse],
            resources: { Wood: { count: "0", storage: "10" } }
        });

        manager.tick(d(0));

        expect(getStorage(resourceManager, "Wood").toNumber()).toBeCloseTo(110, 6);
    });
});

describe("BuildingManager: строительство", () => {
    it("ставит проект в очередь без немедленного списания ресурсов", () => {
        const { manager, resourceManager } = setup({ buildings: [sawmill()] });

        const queued = manager.build("Sawmill", d(1));

        expect(queued).toBe(true);
        const projects = savedProjects(manager);
        expect(projects).toHaveLength(1);
        expect(projects[0].buildingId).toBe("Sawmill");
        expect(projects[0].count).toBe("1");
        expect(projects[0].requiredPower).toBe("200");
        expect(projects[0].progress).toBe("0");
        expect(savedBuilding(manager, "Sawmill").owned).toBe("0");
        expectCount(resourceManager, "Wood", 1000);
        expectCount(resourceManager, "Stone", 1000);
    });

    it("отклоняет неизвестное здание и неположительное количество", () => {
        const { manager } = setup({ buildings: [sawmill()] });

        expect(manager.build("Unknown", d(1))).toBe(false);
        expect(manager.build("Sawmill", d(0))).toBe(false);
        expect(manager.build("Sawmill", d(-1))).toBe(false);
        expect(savedProjects(manager)).toHaveLength(0);
    });

    it("не позволяет строить закрытое здание", () => {
        const { manager } = setup({
            buildings: [sawmill({ open: false })]
        });

        expect(manager.build("Sawmill", d(1))).toBe(false);
        expect(savedProjects(manager)).toHaveLength(0);
    });

    it("оплачивает материалы по мере прогресса", () => {
        const { manager, resourceManager } = setup({ buildings: [sawmill()] });
        manager.build("Sawmill", d(1));
        resourceManager.setResourceCount("BuildPower", d(100));

        manager.tick(d(0));

        expect(savedProjects(manager)[0].progress).toBe("100");
        expect(savedBuilding(manager, "Sawmill").owned).toBe("0");
        expectCount(resourceManager, "Wood", 975);
        expectCount(resourceManager, "Stone", 990);
        expectCount(resourceManager, "BuildPower", 0);
    });

    it("завершает здание при полном прогрессе", () => {
        const { manager, resourceManager } = setup({ buildings: [sawmill()] });
        manager.build("Sawmill", d(1));
        resourceManager.setResourceCount("BuildPower", d(200));

        manager.tick(d(0));

        expect(savedProjects(manager)).toHaveLength(0);
        expect(savedBuilding(manager, "Sawmill").owned).toBe("1");
        expectCount(resourceManager, "Wood", 950);
        expectCount(resourceManager, "Stone", 980);
        expectCount(resourceManager, "BuildPower", 0);
    });

    it("ограничивает прогресс доступными материалами", () => {
        const { manager, resourceManager } = setup({
            buildings: [sawmill()],
            resources: { Wood: { count: "25" } }
        });
        manager.build("Sawmill", d(1));
        resourceManager.setResourceCount("BuildPower", d(200));

        manager.tick(d(0));

        expect(savedProjects(manager)[0].progress).toBe("100");
        expect(savedBuilding(manager, "Sawmill").owned).toBe("0");
        expectCount(resourceManager, "Wood", 0);
        expectCount(resourceManager, "Stone", 990);
    });

    it("строит несколько зданий из одного проекта", () => {
        const { manager, resourceManager } = setup({ buildings: [sawmill()] });
        manager.build("Sawmill", d(2));
        resourceManager.setResourceCount("BuildPower", d(400));

        manager.tick(d(0));

        expect(savedProjects(manager)).toHaveLength(0);
        expect(savedBuilding(manager, "Sawmill").owned).toBe("2");
        expectCount(resourceManager, "Wood", 900);
        expectCount(resourceManager, "Stone", 960);
    });

    it("распределяет BuildPower по приоритетам проектов", () => {
        const projectA = makeBuildingData({
            id: "ProjectA",
            cost: { Wood: "50", Stone: "20", BuildPower: "200" }
        });
        const projectB = makeBuildingData({
            id: "ProjectB",
            cost: { Wood: "50", Stone: "20", BuildPower: "200" }
        });
        const { manager, resourceManager } = setup({
            buildings: [projectA, projectB]
        });
        manager.build("ProjectA", d(1));
        manager.build("ProjectB", d(1));
        manager.setConstructionPriority("ProjectA", d(1));
        manager.setConstructionPriority("ProjectB", d(0));
        resourceManager.setResourceCount("BuildPower", d(200));

        manager.tick(d(0));

        expect(savedBuilding(manager, "ProjectA").owned).toBe("1");
        expect(savedBuilding(manager, "ProjectB").owned).toBe("0");
        const projects = savedProjects(manager);
        expect(projects).toHaveLength(1);
        expect(projects[0].buildingId).toBe("ProjectB");
        expect(projects[0].progress).toBe("0");
    });

    it("внутри одного приоритета делит BuildPower пропорционально оставшейся работе", () => {
        const projectA = makeBuildingData({
            id: "ProjectA",
            cost: { Wood: "50", Stone: "20", BuildPower: "200" }
        });
        const projectB = makeBuildingData({
            id: "ProjectB",
            cost: { Wood: "50", Stone: "20", BuildPower: "200" }
        });
        const { manager, resourceManager } = setup({
            buildings: [projectA, projectB]
        });
        manager.build("ProjectA", d(1));
        manager.build("ProjectB", d(1));
        resourceManager.setResourceCount("BuildPower", d(200));

        manager.tick(d(0));

        const projects = savedProjects(manager);
        expect(projects).toHaveLength(2);
        for (const project of projects) {
            expect(project.progress).toBe("100");
        }
        expect(savedBuilding(manager, "ProjectA").owned).toBe("0");
        expect(savedBuilding(manager, "ProjectB").owned).toBe("0");
        expectCount(resourceManager, "Wood", 950);
        expectCount(resourceManager, "Stone", 980);
    });

    it("отменяет проект без возврата ресурсов", () => {
        const { manager, resourceManager } = setup({ buildings: [sawmill()] });
        manager.build("Sawmill", d(1));
        const woodBefore = getCount(resourceManager, "Wood");
        const stoneBefore = getCount(resourceManager, "Stone");

        expect(manager.cancelBuild("Sawmill")).toBe(true);
        expect(manager.cancelBuild("Unknown")).toBe(false);

        expect(savedProjects(manager)).toHaveLength(0);
        expect(getCount(resourceManager, "Wood").eq(woodBefore)).toBe(true);
        expect(getCount(resourceManager, "Stone").eq(stoneBefore)).toBe(true);
    });

    it("здание, завершённое в этом ходу, начинает работать со следующего хода", () => {
        const base = makeBuildingData({
            id: "Base",
            produces: { BuildPower: "20" },
            owned: "1",
            priority: "1"
        });
        const hut = makeBuildingData({
            id: "Hut",
            produces: { Food: "10" },
            cost: { BuildPower: "20" },
            owned: "0"
        });
        const { manager, resourceManager } = setup({
            buildings: [base, hut]
        });
        manager.build("Hut", d(1));

        manager.tick(d(0));

        expect(savedBuilding(manager, "Hut").owned).toBe("1");
        expectCount(resourceManager, "Food", 0);
        expectCount(resourceManager, "BuildPower", 0);

        manager.tick(d(0));

        expectCount(resourceManager, "Food", 10);
    });
});

describe("BuildingManager: износ и ремонт", () => {
    it("изнашивается и ремонтируется при включённом поддержании", () => {
        const { manager, resourceManager } = setup({
            buildings: [decaying()],
            resources: { Wood: { count: "100" } }
        });

        manager.tick(d(0));

        expect(savedBuildingNumber(manager, "Decaying", "decayLevel")).toBeCloseTo(0, 6);
        expectCount(resourceManager, "Wood", 99);

        manager.tick(d(0));
        manager.tick(d(0));

        expect(savedBuildingNumber(manager, "Decaying", "decayLevel")).toBeCloseTo(0, 6);
        expectCount(resourceManager, "Wood", 97);
    });

    it("применяет частичный ремонт при нехватке ресурсов", () => {
        const { manager, resourceManager } = setup({
            buildings: [decaying()],
            resources: { Wood: { count: "0.5" } }
        });

        manager.tick(d(0));

        expect(savedBuildingNumber(manager, "Decaying", "decayLevel")).toBeCloseTo(0.5, 6);
        expectCount(resourceManager, "Wood", 0);
    });

    it("не ремонтирует при отключённом поддержании", () => {
        const { manager, resourceManager } = setup({
            buildings: [decaying()],
            resources: { Wood: { count: "100" } }
        });

        expect(manager.setMaintenanceEnabled("Decaying", false)).toBe(true);

        manager.tick(d(0));

        expect(savedBuildingNumber(manager, "Decaying", "decayLevel")).toBeCloseTo(1, 6);
        expectCount(resourceManager, "Wood", 100);
    });

    it("разрушает группу, если износ на начало фазы >= 100", () => {
        const { manager, resourceManager } = setup({
            buildings: [decaying()],
            resources: { Wood: { count: "100" } }
        });
        patchBuilding(manager, "Decaying", { decayLevel: "100" });

        manager.tick(d(0));

        expect(savedBuilding(manager, "Decaying").owned).toBe("0");
        expectCount(resourceManager, "Wood", 100);
    });

    it("не обрезает износ выше 100 и разрушает группу на следующем ходу", () => {
        const { manager } = setup({
            buildings: [decaying()],
            resources: { Wood: { count: "100" } }
        });
        patchBuilding(manager, "Decaying", { decayLevel: "99.5" });
        manager.setMaintenanceEnabled("Decaying", false);

        manager.tick(d(0));

        expect(savedBuildingNumber(manager, "Decaying", "decayLevel")).toBeCloseTo(100.5, 6);
        expect(savedBuilding(manager, "Decaying").owned).toBe("1");

        manager.tick(d(0));

        expect(savedBuilding(manager, "Decaying").owned).toBe("0");
    });

    it("без ресурсов износ остаётся после роста", () => {
        const { manager, resourceManager } = setup({
            buildings: [decaying()],
            resources: { Wood: { count: "0" } }
        });

        manager.tick(d(0));

        expect(savedBuildingNumber(manager, "Decaying", "decayLevel")).toBeCloseTo(1, 6);
        expectCount(resourceManager, "Wood", 0);
    });
});

describe("BuildingManager: урон и снос", () => {
    function walled(): BuildingData {
        return makeBuildingData({
            id: "Walled",
            hp: "100",
            maxHp: "100",
            owned: "1000"
        });
    }

    it("распределяет урон и уменьшает количество зданий", () => {
        const { manager } = setup({ buildings: [walled()] });

        manager.dealBuildingDamage("Walled", d(5000));

        expect(savedBuilding(manager, "Walled").owned).toBe("999");
        expect(savedBuildingNumber(manager, "Walled", "hpSum")).toBeCloseTo(95000, 6);
    });

    it("сносит указанное количество зданий", () => {
        const { manager } = setup({ buildings: [walled()] });

        manager.destroyBuilding("Walled", d(10));

        expect(savedBuilding(manager, "Walled").owned).toBe("990");
    });

    it("не уводит owned в отрицательное значение", () => {
        const { manager } = setup({ buildings: [walled()] });

        manager.destroyBuilding("Walled", d(2000));

        expect(savedBuilding(manager, "Walled").owned).toBe("0");
    });
});

describe("BuildingManager: сохранение", () => {
    it("восстанавливает количество, power, priority, износ и очередь строительства", () => {
        const buildings = [sawmill(), decaying({ decayPerTurn: "0" })];
        const { manager, resourceManager } = setup({ buildings });
        manager.build("Sawmill", d(1));
        resourceManager.setResourceCount("BuildPower", d(100));
        manager.tick(d(0));
        manager.setPower("Sawmill", d(40));
        manager.setPriority("Sawmill", d(7));
        patchBuilding(manager, "Decaying", { decayLevel: "12.5" });

        const saved = save(manager);
        const restored = setup({ buildings });
        restored.manager.deserializeForSave(saved);
        const restoredSave = save(restored.manager);

        expect(restoredSave.buildingsManager.buildings.Sawmill.power).toBe("40");
        expect(restoredSave.buildingsManager.buildings.Sawmill.priority).toBe("7");
        expect(restoredSave.buildingsManager.buildings.Decaying.decayLevel).toBe("12.5");
        expect(restoredSave.buildingsManager.constructionProjects).toHaveLength(1);
        expect(restoredSave.buildingsManager.constructionProjects[0]).toMatchObject({
            buildingId: "Sawmill",
            count: "1",
            progress: "100",
            requiredPower: "200"
        });
    });
});
