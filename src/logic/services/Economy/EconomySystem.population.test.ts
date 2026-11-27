import { EconomySystem } from "./EconomySystem";
import { EventBus } from "@/logic/EventBus";
import type { BuildingData } from "./BuildingSystem/Building";
import type { Population } from "./PopulationSystem/PopulationSystem";
import type { ResourceData } from "@/shared/types/Resource";
import {
    makePopulationData,
    noRebellionPressurePopulation,
    stablePopulation
} from "@/test/fixtures/population";
import {
    createPopulationResourceData,
    type EconomySnapshotContract
} from "@/test/helpers/populationTestSetup";

type EconomySystemConstructor = new (
    eventBus: EventBus,
    resourcesData: ResourceData[],
    buildingsData: BuildingData[],
    populationData: Population[]
) => EconomySystem;

function createSystem(
    buildings: BuildingData[],
    population: Population[],
    resources: ResourceData[] = createPopulationResourceData()
): { system: EconomySystem; eventBus: EventBus } {
    const eventBus = new EventBus();
    const Constructor = EconomySystem as unknown as EconomySystemConstructor;
    return {
        system: new Constructor(eventBus, resources, buildings, population),
        eventBus
    };
}

function snapshot(system: EconomySystem): EconomySnapshotContract {
    return system.serialize() as unknown as EconomySnapshotContract;
}

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
        maxLevel: "5",
        open: true,
        storageBonus: {},
        housingCapacity: "0",
        owned: "0",
        ...rest
    };
}

interface EconomySaveContract {
    economy: {
        population: Record<string, Record<string, string>>;
    };
}

function patchEconomyPopulation(
    system: EconomySystem,
    id: string,
    patch: Record<string, string>
): void {
    const save = system.serializeForSave() as unknown as EconomySaveContract;
    const existing = save.economy.population[id];
    if (!existing) {
        throw new Error(`В сейве экономики нет населения ${id}`);
    }
    save.economy.population[id] = { ...existing, ...patch };
    system.deserializeForSave(save);
}

const NO_MORTALITY = {
    baseRate: "0",
    foodPenalty: "0",
    waterPenalty: "0",
    housingPenalty: "0",
    maxMortalityRate: "0"
};

describe("EconomySystem: население", () => {
    it("снимок содержит население и предупреждения", () => {
        const { system, eventBus } = createSystem(
            [],
            [makePopulationData({ id: "Peasants" })]
        );

        eventBus.emit("tick");

        const state = snapshot(system);
        expect(state.population?.Peasants).toBeDefined();
        expect(state.warnings).toBeDefined();
        expect(Array.isArray(state.warnings)).toBe(true);
    });

    it("потребляет население до производства зданий", () => {
        const farm = makeBuildingData({
            id: "Farm",
            produces: { Food: "10" },
            owned: "1"
        });
        const { system, eventBus } = createSystem(
            [farm],
            [stablePopulation({ id: "Peasants" })],
            createPopulationResourceData({
                Food: { count: "0", storage: "10000" },
                Water: { count: "1000", storage: "10000" }
            })
        );

        eventBus.emit("tick");

        const state = snapshot(system);
        // Население не смогло поесть произведённую в этом же ходу еду.
        expect(Number(state.population?.Peasants.foodCoverage)).toBeCloseTo(0, 6);
        expect(Number(state.resources.Food.count)).toBeCloseTo(10, 6);
    });

    it("передаёт доступных рабочих в BuildingManager до производства", () => {
        const building = makeBuildingData({
            id: "Workshop",
            produces: { Wood: "10" },
            workersRequired: "10",
            owned: "1"
        });
        const full = createSystem(
            [building],
            [noRebellionPressurePopulation({ id: "Peasants" })]
        );
        full.eventBus.emit("tick");
        expect(Number(snapshot(full.system).resources.Wood.count)).toBeCloseTo(10, 6);

        const strike = createSystem(
            [building],
            [noRebellionPressurePopulation({ id: "Peasants" })]
        );
        patchEconomyPopulation(strike.system, "Peasants", {
            currentRebellion: "0.3"
        });
        strike.eventBus.emit("tick");
        expect(Number(snapshot(strike.system).resources.Wood.count)).toBeCloseTo(7, 6);
    });

    it("берёт вместимость жилья из зданий", () => {
        const population = makePopulationData({
            id: "Peasants",
            count: "10",
            mortality: NO_MORTALITY
        });
        const withoutHousing = createSystem([], [population]);
        withoutHousing.eventBus.emit("tick");
        expect(
            Number(snapshot(withoutHousing.system).population?.Peasants.count)
        ).toBeCloseTo(10, 6);

        const house = makeBuildingData({
            id: "House",
            category: "housing",
            housingCapacity: "20",
            owned: "1"
        });
        const withHousing = createSystem([house], [population]);
        withHousing.eventBus.emit("tick");
        expect(
            Number(snapshot(withHousing.system).population?.Peasants.count)
        ).toBeCloseTo(10.1, 6);
    });

    it("добавляет предупреждения населения в снимок", () => {
        const { system, eventBus } = createSystem(
            [],
            [stablePopulation({ id: "Peasants" })],
            createPopulationResourceData({ Food: { count: "0" } })
        );

        eventBus.emit("tick");

        const state = snapshot(system);
        expect(state.population?.Peasants.warnings).toContain("hunger");
        expect(state.warnings).toContain("hunger");
    });

    it("сохраняет и загружает население через EconomySystem", () => {
        const { system, eventBus } = createSystem(
            [],
            [makePopulationData({ id: "Peasants" })]
        );
        eventBus.emit("tick");

        const save = system.serializeForSave() as unknown as EconomySaveContract;
        expect(save.economy.population.Peasants).toBeDefined();

        save.economy.population.Peasants.count = "42";
        save.economy.population.Peasants.currentRebellion = "0.4";
        save.economy.population.Peasants.foodPolicy = "abundant";
        system.deserializeForSave(save);

        const state = snapshot(system);
        expect(Number(state.population?.Peasants.count)).toBe(42);
        expect(Number(state.population?.Peasants.currentRebellion)).toBeCloseTo(0.4, 6);
        expect(state.population?.Peasants.foodPolicy).toBe("abundant");
    });

    it("выполняет конец хода после фаз населения и зданий", () => {
        const farm = makeBuildingData({
            id: "Farm",
            produces: { Food: "10" },
            owned: "1"
        });
        const { system, eventBus } = createSystem(
            [farm],
            [stablePopulation({ id: "Peasants" })],
            createPopulationResourceData({
                Food: { count: "0", storage: "5", spoilRate: "1" }
            })
        );

        eventBus.emit("tick");

        const state = snapshot(system);
        expect(Number(state.population?.Peasants.foodCoverage)).toBeCloseTo(0, 6);
        expect(Number(state.resources.Food.count)).toBeCloseTo(5, 6);
    });
});
