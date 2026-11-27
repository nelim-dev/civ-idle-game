import Decimal from "break_infinity.js";
import { BuildingManager } from "./BuildingManager";
import type { BuildingData } from "./Building";
import { createPopulationResources } from "@/test/helpers/populationTestSetup";

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
        maxLevel: "5",
        open: true,
        storageBonus: {},
        housingCapacity: "0",
        owned: "0",
        ...rest
    };
}

interface BuildingManagerPopulationContract {
    getTotalHousingCapacity(): Decimal;
    getTotalWorkerDemand(): Decimal;
}

function createManager(buildings: BuildingData[]): BuildingManagerPopulationContract {
    const resources = createPopulationResources();
    const manager = new BuildingManager(buildings, resources);
    return manager as unknown as BuildingManagerPopulationContract;
}

describe("BuildingManager: жильё и спрос на рабочих для населения", () => {
    it("суммирует вместимость жилья по owned", () => {
        const manager = createManager([
            makeBuildingData({
                id: "House",
                category: "housing",
                housingCapacity: "10",
                owned: "2"
            })
        ]);

        expect(manager.getTotalHousingCapacity().toNumber()).toBeCloseTo(20, 6);
    });

    it("масштабирует жильё уровнем через levelProductionFactor", () => {
        const manager = createManager([
            makeBuildingData({
                id: "House",
                category: "housing",
                housingCapacity: "10",
                owned: "2",
                level: "2"
            })
        ]);

        expect(manager.getTotalHousingCapacity().toNumber()).toBeCloseTo(22, 6);
    });

    it("не учитывает здания с owned = 0", () => {
        const manager = createManager([
            makeBuildingData({
                id: "House",
                category: "housing",
                housingCapacity: "10",
                owned: "0"
            })
        ]);

        expect(manager.getTotalHousingCapacity().toNumber()).toBeCloseTo(0, 6);
    });

    it("суммирует потребность в рабочих по owned", () => {
        const manager = createManager([
            makeBuildingData({
                id: "Farm",
                workersRequired: "3",
                owned: "2",
                power: "100"
            })
        ]);

        expect(manager.getTotalWorkerDemand().toNumber()).toBeCloseTo(6, 6);
    });

    it("не создаёт спрос на рабочих у выключенных зданий", () => {
        const manager = createManager([
            makeBuildingData({
                id: "Active",
                workersRequired: "3",
                owned: "2",
                power: "100"
            }),
            makeBuildingData({
                id: "Disabled",
                workersRequired: "5",
                owned: "1",
                power: "0"
            })
        ]);

        expect(manager.getTotalWorkerDemand().toNumber()).toBeCloseTo(6, 6);
    });

    it("не создаёт спрос на рабочих у зданий с owned = 0", () => {
        const manager = createManager([
            makeBuildingData({
                id: "Empty",
                workersRequired: "5",
                owned: "0",
                power: "100"
            })
        ]);

        expect(manager.getTotalWorkerDemand().toNumber()).toBeCloseTo(0, 6);
    });
});
