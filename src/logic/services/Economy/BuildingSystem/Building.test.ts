import Decimal from "break_infinity.js";
import { Building } from "./Building";
import type { BuildingData } from "./Building";

type BuildingOverrides = Partial<BuildingData> & Pick<BuildingData, "id">;

function d(value: string | number): Decimal {
    return new Decimal(value);
}

/**
 * Нейтральное описание здания для проверки сущности.
 * Все поля, которых нет в overrides, не влияют на проверяемую механику.
 */
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

function createBuilding(overrides: BuildingOverrides): Building {
    return new Building(makeBuildingData(overrides));
}

/** Задаёт runtime-состояние через публичный lossless-формат. */
function setRuntimeState(building: Building, patch: Record<string, string>): void {
    building.deserializeForSave({ ...building.serializeForSave(), ...patch });
}

/** Группа из 1000 зданий по 100 HP: удобная база для проверки тиров. */
function wall(overrides: Partial<BuildingData> = {}): Building {
    return createBuilding({
        id: "Wall",
        hp: "100",
        maxHp: "100",
        owned: "1000",
        ...overrides
    });
}

describe("Building: износ", () => {
    it("не обрезает износ на 100 и допускает превышение", () => {
        const building = createBuilding({ id: "Decaying", decayPerTurn: "1" });
        setRuntimeState(building, { decayLevel: "99.9" });

        building.BuildingDecayTurn();

        expect(building.getDecayLevel().toNumber()).toBeCloseTo(100.9, 6);

        building.BuildingDecayTurn();

        expect(building.getDecayLevel().toNumber()).toBeCloseTo(101.9, 6);
    });
});

describe("Building: тир-бакеты урона", () => {
    it("5% урона разрушает только тир 0", () => {
        const building = wall();

        const destroyed = building.damageBuild(d(5000));

        expect(destroyed.toNumber()).toBeCloseTo(1, 6);
        expect(building.getOwned().toNumber()).toBe(999);
        expect(building.getHpSum().toNumber()).toBeCloseTo(95000, 6);
        expect(building.getMaxHpSum().toNumber()).toBeCloseTo(99900, 6);
    });

    it("1% урона не разрушает здания", () => {
        const building = wall();

        const destroyed = building.damageBuild(d(1000));

        expect(destroyed.toNumber()).toBeCloseTo(0, 6);
        expect(building.getOwned().toNumber()).toBe(1000);
        expect(building.getHpSum().toNumber()).toBeCloseTo(99000, 6);
        expect(building.getMaxHpSum().toNumber()).toBeCloseTo(100000, 6);
    });

    it("урон, равный HP одного здания, разрушает его", () => {
        const building = wall({ owned: "1" });

        const destroyed = building.damageBuild(d(100));

        expect(destroyed.toNumber()).toBeCloseTo(1, 6);
        expect(building.getOwned().toNumber()).toBe(0);
        expect(building.getHpSum().toNumber()).toBeCloseTo(0, 6);
        expect(building.getMaxHpSum().toNumber()).toBeCloseTo(0, 6);
        expect(building.getHp().toNumber()).toBeCloseTo(0, 6);
    });

    it("накапливает концентрацию между ходами", () => {
        const building = wall();

        const first = building.damageBuild(d(3000));
        expect(first.toNumber()).toBeCloseTo(0, 6);
        expect(building.getOwned().toNumber()).toBe(1000);
        expect(building.getHpSum().toNumber()).toBeCloseTo(97000, 6);

        const second = building.damageBuild(d(3000));
        expect(second.toNumber()).toBeCloseTo(1, 6);
        expect(building.getOwned().toNumber()).toBe(999);
        expect(building.getHpSum().toNumber()).toBeCloseTo(94000, 6);
    });

    it("малые группы не дробятся на пустые тиры", () => {
        const building = wall({ owned: "10" });

        const first = building.damageBuild(d(500));
        expect(first.toNumber()).toBeCloseTo(0, 6);
        expect(building.getOwned().toNumber()).toBe(10);
        expect(building.getHpSum().toNumber()).toBeCloseTo(500, 6);

        const second = building.damageBuild(d(500));
        expect(second.toNumber()).toBeCloseTo(10, 6);
        expect(building.getOwned().toNumber()).toBe(0);
        expect(building.getHpSum().toNumber()).toBeCloseTo(0, 6);
    });

    it("переливает остаток урона из пустых тиров в последний", () => {
        const building = wall({ owned: "1" });

        // Доли тиров 0–2 не могут быть поглощены: их ёмкость равна 0.
        // Эти 20% урона переливаются в тир 3.
        const first = building.damageBuild(d(80));
        expect(first.toNumber()).toBeCloseTo(0, 6);
        expect(building.getOwned().toNumber()).toBe(1);
        expect(building.getHpSum().toNumber()).toBeCloseTo(20, 6);

        const second = building.damageBuild(d(20));
        expect(second.toNumber()).toBeCloseTo(1, 6);
        expect(building.getOwned().toNumber()).toBe(0);
    });
});

describe("Building: инварианты HP", () => {
    it("после урона hpSum не превышает maxHpSum", () => {
        const building = wall();

        building.damageBuild(d(5000));

        expect(building.getHpSum().lte(building.getMaxHpSum())).toBe(true);
    });

    it("hpSum = 0 влечёт owned = 0", () => {
        const building = wall({ owned: "10" });

        building.damageBuild(d(1000));

        expect(building.getHpSum().toNumber()).toBeCloseTo(0, 6);
        expect(building.getOwned().toNumber()).toBe(0);
    });
});

describe("Building: постройка, снос и ремонт", () => {
    it("build добавляет здания с полной прочностью", () => {
        const building = wall({ owned: "10" });
        building.damageBuild(d(300));
        expect(building.getHpSum().toNumber()).toBeCloseTo(700, 6);

        building.build(d(5));

        expect(building.getOwned().toNumber()).toBe(15);
        expect(building.getHpSum().toNumber()).toBeCloseTo(1200, 6);
        expect(building.getMaxHpSum().toNumber()).toBeCloseTo(1500, 6);
        expect(building.getHp().toNumber()).toBeCloseTo(80, 6);
    });

    it("destroy снимает среднюю прочность и не уводит значения в минус", () => {
        const building = wall({ owned: "10" });
        building.damageBuild(d(300));

        building.destroy(d(5));

        expect(building.getOwned().toNumber()).toBe(5);
        expect(building.getHpSum().toNumber()).toBeCloseTo(350, 6);
        expect(building.getMaxHpSum().toNumber()).toBeCloseTo(500, 6);
        expect(building.getHp().toNumber()).toBeCloseTo(70, 6);

        building.destroy(d(100));

        expect(building.getOwned().toNumber()).toBe(0);
        expect(building.getHpSum().toNumber()).toBeCloseTo(0, 6);
        expect(building.getMaxHpSum().toNumber()).toBeCloseTo(0, 6);
        expect(building.getHp().toNumber()).toBeCloseTo(0, 6);
    });

    it("addBuildHp не поднимает hpSum выше maxHpSum", () => {
        const building = wall({ owned: "10" });
        building.damageBuild(d(300));

        building.addBuildHp(d(500));
        expect(building.getHpSum().toNumber()).toBeCloseTo(1000, 6);

        building.addBuildHp(d(500));
        expect(building.getHpSum().toNumber()).toBeCloseTo(1000, 6);
        expect(building.getHp().toNumber()).toBeCloseTo(100, 6);
    });

    it("reduceBuildHp не опускает hpSum ниже нуля", () => {
        const building = wall({ owned: "10" });

        building.reduceBuildHp(d(1500));

        expect(building.getHpSum().toNumber()).toBeCloseTo(0, 6);
        expect(building.getHp().toNumber()).toBeCloseTo(0, 6);
    });
});

describe("Building: формат сохранения", () => {
    it("не хранит тир-бакеты и deficit", () => {
        const building = wall();
        building.damageBuild(d(5000));

        const saved = building.serializeForSave();

        expect(saved.owned).toBe("999");
        expect(saved.hpSum).toBe("95000");
        expect(saved.maxHpSum).toBe("99900");
        expect(saved).not.toHaveProperty("buckets");
        expect(saved).not.toHaveProperty("tierCount");
        expect(saved).not.toHaveProperty("tierHpSum");
        expect(saved).not.toHaveProperty("deficit");
    });
});
