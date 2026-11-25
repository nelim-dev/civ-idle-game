import resourceData from "./resource.json";
import buildingsData from "./buildings.json";
import populationData from "./population.json";
import type { ResourceData } from "@/shared/types/Resource";
import type { BuildingData } from "@/logic/services/Economy/BuildingSystem/Building";
import type { Population } from "@/logic/services/Economy/PopulationSystem/PopulationSystem";

const resources = resourceData as ResourceData[];
const buildings = buildingsData as unknown as BuildingData[];
const populations = populationData as Population[];

const RESOURCE_OWNERS = ["player", "nature"];
const BUILDING_CATEGORIES = [
    "production",
    "storage",
    "infrastructure",
    "housing",
    "research",
    "military"
];
const EXTRACTION_BUILDINGS = ["Sawmill", "Pit", "StoneQuarry", "IronMine"];

function expectUniqueIds(items: { id: string }[], type: string): void {
    const ids = items.map((item) => item.id);
    expect(new Set(ids).size, `${type}: id должны быть уникальны`).toBe(ids.length);
}

function expectNonNegativeNumeric(value: string | undefined, field: string): void {
    expect(value, `${field} должен быть задан`).toBeDefined();
    const parsed = Number(value);
    expect(Number.isFinite(parsed), `${field} должен быть числом: ${value}`).toBe(true);
    expect(parsed, `${field} не может быть отрицательным`).toBeGreaterThanOrEqual(0);
}

describe("контент: ресурсы", () => {
    it("id уникальны", () => {
        expectUniqueIds(resources, "resources");
    });

    it("обязательные поля заполнены, owner допустим", () => {
        for (const resource of resources) {
            expect(resource.id, "resource.id").toBeTruthy();
            expect(resource.name, `${resource.id}.name`).toBeTruthy();
            expect(RESOURCE_OWNERS, `${resource.id}.owner`).toContain(resource.owner);
        }
    });

    it("числовые поля — неотрицательные числа", () => {
        for (const resource of resources) {
            expectNonNegativeNumeric(resource.count, `${resource.id}.count`);
            expectNonNegativeNumeric(resource.storage, `${resource.id}.storage`);
            expectNonNegativeNumeric(resource.renewRate, `${resource.id}.renewRate`);
            expectNonNegativeNumeric(resource.spoilRate, `${resource.id}.spoilRate`);
            expectNonNegativeNumeric(resource.era, `${resource.id}.era`);
        }
    });

    it("spoilRate в диапазоне 0..1", () => {
        for (const resource of resources) {
            const spoilRate = Number(resource.spoilRate);
            expect(spoilRate, `${resource.id}.spoilRate`).toBeGreaterThanOrEqual(0);
            expect(spoilRate, `${resource.id}.spoilRate`).toBeLessThanOrEqual(1);
        }
    });

    it("природные пулы не портятся", () => {
        for (const resource of resources.filter((item) => item.owner === "nature")) {
            expect(Number(resource.spoilRate), `${resource.id}.spoilRate`).toBe(0);
        }
    });

    it("значения spoilRate соответствуют v1", () => {
        const byId = new Map(resources.map((resource) => [resource.id, resource]));
        expect(byId.get("Food")?.spoilRate).toBe("0.02");
        expect(byId.get("Water")?.spoilRate).toBe("0.05");
        expect(byId.get("BuildPower")?.spoilRate).toBe("1");

        for (const id of ["Wood", "Stone", "Iron", "IronOre", "Charcoal", "Money"]) {
            expect(byId.get(id)?.spoilRate, `${id}.spoilRate`).toBe("0.01");
        }
    });

    it("эпоха появления задана", () => {
        for (const resource of resources) {
            expect(resource.era, `${resource.id}.era`).toBe("1");
        }
    });
});

describe("контент: здания", () => {
    const resourceIds = new Set(resources.map((resource) => resource.id));

    it("id уникальны", () => {
        expectUniqueIds(buildings, "buildings");
    });

    it("обязательные поля заполнены, категория допустима", () => {
        for (const building of buildings) {
            expect(building.id, "building.id").toBeTruthy();
            expect(building.name, `${building.id}.name`).toBeTruthy();
            expect(BUILDING_CATEGORIES, `${building.id}.category`).toContain(building.category);
            expect(typeof building.extraction, `${building.id}.extraction`).toBe("boolean");
        }
    });

    it("производные поля отсутствуют в контенте", () => {
        for (const building of buildings) {
            expect(building).not.toHaveProperty("hpSum");
            expect(building).not.toHaveProperty("maxHpSum");
            expect(building).not.toHaveProperty("decayLevel");
            expect(building).not.toHaveProperty("efficiency");
        }
    });

    it("используется BuildPower, а не buildPower", () => {
        for (const building of buildings) {
            expect(building.cost).not.toHaveProperty("buildPower");
            expect(building.produces).not.toHaveProperty("buildPower");
            expect(building.consumes).not.toHaveProperty("buildPower");
            expect(building.storageBonus).not.toHaveProperty("buildPower");
        }
    });

    it("CentralBase производит BuildPower", () => {
        const centralBase = buildings.find((building) => building.id === "CentralBase");
        expect(centralBase).toBeDefined();
        expect(centralBase?.produces.BuildPower).toBe("20");
    });

    it("все ссылки на ресурсы существуют", () => {
        for (const building of buildings) {
            const references = [
                ...Object.keys(building.produces),
                ...Object.keys(building.consumes),
                ...Object.keys(building.cost),
                ...Object.keys(building.storageBonus)
            ];
            for (const reference of references) {
                expect(resourceIds.has(reference), `${building.id}: неизвестный ресурс ${reference}`).toBe(true);
            }
        }
    });

    it("числовые поля корректны, hp/maxHp согласованы", () => {
        for (const building of buildings) {
            expectNonNegativeNumeric(building.workersRequired, `${building.id}.workersRequired`);
            expectNonNegativeNumeric(building.hp, `${building.id}.hp`);
            expectNonNegativeNumeric(building.maxHp, `${building.id}.maxHp`);
            expectNonNegativeNumeric(building.decayPerTurn, `${building.id}.decayPerTurn`);
            expectNonNegativeNumeric(building.priority, `${building.id}.priority`);
            expectNonNegativeNumeric(building.power, `${building.id}.power`);
            expectNonNegativeNumeric(building.level, `${building.id}.level`);
            expectNonNegativeNumeric(building.maxLevel, `${building.id}.maxLevel`);
            expectNonNegativeNumeric(building.housingCapacity, `${building.id}.housingCapacity`);
            expectNonNegativeNumeric(building.owned, `${building.id}.owned`);
            expectNonNegativeNumeric(building.era, `${building.id}.era`);

            const hp = Number(building.hp);
            const maxHp = Number(building.maxHp);
            expect(hp, `${building.id}.hp`).toBeGreaterThan(0);
            expect(maxHp, `${building.id}.maxHp`).toBeGreaterThanOrEqual(hp);

            for (const [resourceId, amount] of Object.entries(building.storageBonus)) {
                expectNonNegativeNumeric(amount, `${building.id}.storageBonus.${resourceId}`);
            }
        }
    });

    it("priority 0..30 и power 0..100", () => {
        for (const building of buildings) {
            const priority = Number(building.priority);
            expect(priority, `${building.id}.priority`).toBeGreaterThanOrEqual(0);
            expect(priority, `${building.id}.priority`).toBeLessThanOrEqual(30);

            const power = Number(building.power);
            expect(power, `${building.id}.power`).toBeGreaterThanOrEqual(0);
            expect(power, `${building.id}.power`).toBeLessThanOrEqual(100);
        }
    });

    it("флаг extraction выставлен по типу здания", () => {
        for (const building of buildings) {
            expect(building.extraction, `${building.id}.extraction`).toBe(EXTRACTION_BUILDINGS.includes(building.id));
        }
    });

    it("деревянный дом относится к жилью", () => {
        const house = buildings.find((building) => building.id === "Wood-House");
        expect(house?.category).toBe("housing");
    });

    it("эпоха появления задана", () => {
        for (const building of buildings) {
            expect(building.era, `${building.id}.era`).toBe("1");
        }
    });
});

describe("контент: население", () => {
    it("id уникальны", () => {
        expectUniqueIds(populations, "population");
    });

    it("обязательные поля заполнены", () => {
        for (const population of populations) {
            expect(population.id, "population.id").toBeTruthy();
            expect(population.name, `${population.id}.name`).toBeTruthy();
            expectNonNegativeNumeric(population.count, `${population.id}.count`);
            expectNonNegativeNumeric(population.housingRequired, `${population.id}.housingRequired`);
            expectNonNegativeNumeric(population.era, `${population.id}.era`);
        }
    });

    it("производные current-поля отсутствуют в контенте", () => {
        for (const population of populations) {
            expect(population.growth).not.toHaveProperty("currentGrowth");
            expect(population.mortality).not.toHaveProperty("currentMortality");
            expect(population.rebellion).not.toHaveProperty("currentRebellion");
        }
    });

    it("поля гражданской войны заданы", () => {
        const requiredFields = [
            "threshold",
            "civilWarThreshold",
            "foodPenalty",
            "housingPenalty",
            "waterPenalty",
            "reliefRate",
            "strikeWorkerFactor",
            "civilWarChance",
            "civilWarLoss",
            "civilWarCooldown"
        ];
        for (const population of populations) {
            for (const field of requiredFields) {
                expect(population.rebellion, `${population.id}.rebellion.${field}`).toHaveProperty(field);
            }
        }
    });

    it("числовые параметры неотрицательны", () => {
        for (const population of populations) {
            for (const [field, value] of Object.entries(population.consumes)) {
                expectNonNegativeNumeric(value, `${population.id}.consumes.${field}`);
            }
            for (const [field, value] of Object.entries(population.growth)) {
                expectNonNegativeNumeric(value, `${population.id}.growth.${field}`);
            }
            for (const [field, value] of Object.entries(population.mortality)) {
                expectNonNegativeNumeric(value, `${population.id}.mortality.${field}`);
            }
            for (const [field, value] of Object.entries(population.rebellion)) {
                expectNonNegativeNumeric(value, `${population.id}.rebellion.${field}`);
            }
        }
    });

    it("доли и вероятности в диапазоне 0..1", () => {
        for (const population of populations) {
            const values = [
                population.growth.baseRate,
                population.growth.foodBonus,
                population.growth.housingBonus,
                population.growth.maxGrowthRate,
                population.mortality.baseRate,
                population.mortality.foodPenalty,
                population.mortality.waterPenalty,
                population.mortality.housingPenalty,
                population.mortality.maxMortalityRate,
                population.rebellion.threshold,
                population.rebellion.civilWarThreshold,
                population.rebellion.foodPenalty,
                population.rebellion.housingPenalty,
                population.rebellion.waterPenalty,
                population.rebellion.reliefRate,
                population.rebellion.strikeWorkerFactor,
                population.rebellion.civilWarChance,
                population.rebellion.civilWarLoss
            ];
            for (const value of values) {
                const parsed = Number(value);
                expect(parsed, `${population.id}: значение ${value}`).toBeGreaterThanOrEqual(0);
                expect(parsed, `${population.id}: значение ${value}`).toBeLessThanOrEqual(1);
            }
        }
    });
});
