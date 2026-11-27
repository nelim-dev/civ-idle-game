import Decimal from "break_infinity.js";
import { makePopulationData } from "@/test/fixtures/population";
import {
    createPopulationResources,
    createPopulationSystem,
    getSnapshot,
    patchPopulation,
    type PopulationSnapshot,
    type PopulationSystemContract
} from "@/test/helpers/populationTestSetup";

function setup(): {
    system: PopulationSystemContract;
    resources: ReturnType<typeof createPopulationResources>;
} {
    const resources = createPopulationResources();
    const system = createPopulationSystem(
        [makePopulationData({ id: "Peasants" })],
        resources
    );
    return { system, resources };
}

describe("PopulationSystem: снимок и сохранение", () => {
    it("снимок содержит все поля панели населения", () => {
        const { system } = setup();
        system.tick(new Decimal(100));

        const snapshot = getSnapshot(system);
        const fields: Array<keyof PopulationSnapshot> = [
            "id",
            "name",
            "icon",
            "count",
            "housingRequired",
            "housingCapacity",
            "foodPolicy",
            "foodCoverage",
            "waterCoverage",
            "housingCoverage",
            "satisfaction",
            "currentGrowth",
            "currentMortality",
            "currentRebellion",
            "availableWorkers",
            "employedWorkers",
            "unemployedWorkers",
            "civilWarCooldown",
            "isDefeated",
            "defeatReason",
            "warnings"
        ];

        for (const field of fields) {
            expect(snapshot, `поле ${field}`).toHaveProperty(field);
        }
        expect(typeof snapshot.count).toBe("string");
        expect(Array.isArray(snapshot.warnings)).toBe(true);
    });

    it("сохраняет накопительное состояние населения", () => {
        const { system } = setup();
        system.setFoodPolicy("abundant");
        patchPopulation(system, "Peasants", {
            currentRebellion: "0.4",
            civilWarCooldown: "12"
        });

        const saved = system.serializeForSave().population.Peasants;

        expect(saved.count).toBe("10");
        expect(saved.currentRebellion).toBe("0.4");
        expect(saved.civilWarCooldown).toBe("12");
        expect(saved.foodPolicy).toBe("abundant");
    });

    it("save → load восстанавливает количество, бунт, кулдаун и политику", () => {
        const source = setup();
        source.system.setFoodPolicy("economy");
        patchPopulation(source.system, "Peasants", {
            currentRebellion: "0.4",
            civilWarCooldown: "12"
        });
        const save = source.system.serializeForSave();

        const target = setup();
        target.system.deserializeForSave(save);

        const snapshot = getSnapshot(target.system);
        expect(Number(snapshot.count)).toBe(10);
        expect(Number(snapshot.currentRebellion)).toBeCloseTo(0.4, 6);
        expect(Number(snapshot.civilWarCooldown)).toBe(12);
        expect(snapshot.foodPolicy).toBe("economy");
    });

    it("не берёт коэффициенты роста из сейва", () => {
        const source = setup();
        const save = source.system.serializeForSave();
        const saved = save.population.Peasants as unknown as Record<string, unknown>;
        saved.growth = {
            baseRate: "999",
            foodBonus: "999",
            housingBonus: "999",
            maxGrowthRate: "999"
        };

        const target = setup();
        target.system.deserializeForSave(save);
        target.system.tick(new Decimal(200));

        // Коэффициенты роста остаются контентными: 1% от 100 = 101.
        expect(Number(getSnapshot(target.system).count)).toBeCloseTo(101, 6);
    });

    it("старый сейв без населения оставляет стартовое состояние", () => {
        const { system } = setup();

        expect(() => system.deserializeForSave({})).not.toThrow();

        expect(Number(getSnapshot(system).count)).toBe(10);
    });
});
