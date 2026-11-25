import Decimal from "break_infinity.js";
import { Resource } from "./Resource";
import type { ResourceData } from "@/shared/types/Resource";
import { makeResourceData } from "@/test/fixtures/resources";

function makeResource(overrides: Partial<ResourceData> = {}): Resource {
    return new Resource(
        makeResourceData({
            id: "Wood",
            count: "100",
            storage: "200",
            ...overrides
        })
    );
}

describe("Resource", () => {
    describe("конструктор", () => {
        it("переносит поля и конвертирует строки в Decimal", () => {
            const resource = makeResource({
                name: "Древесина",
                description: "Материал",
                icon: "🌳",
                open: false,
                owner: "nature",
                renewable: true,
                renewRate: "0.001",
                spoilRate: "0.05"
            });

            expect(resource.getId()).toBe("Wood");
            expect(resource.getName()).toBe("Древесина");
            expect(resource.getDescription()).toBe("Материал");
            expect(resource.getIcon()).toBe("🌳");
            expect(resource.getOpenStatus()).toBe(false);
            expect(resource.getOwner()).toBe("nature");
            expect(resource.getRenewable()).toBe(true);
            expect(resource.getResourceCount().eq(100)).toBe(true);
            expect(resource.getStorage().eq(200)).toBe(true);
            expect(resource.getRenewableRate().eq("0.001")).toBe(true);
            expect(resource.getSpoilRate().eq("0.05")).toBe(true);
        });

        it("использует spoilRate по умолчанию, если поле не задано", () => {
            const resource = makeResource({ spoilRate: undefined });

            expect(resource.getSpoilRate().eq("0.01")).toBe(true);
        });
    });

    describe("addResource", () => {
        it("прибавляет положительное значение", () => {
            const resource = makeResource();

            expect(resource.addResource(new Decimal(25))).toBe(true);
            expect(resource.getResourceCount().eq(125)).toBe(true);
        });

        it("прибавляет ноль без изменений", () => {
            const resource = makeResource();

            expect(resource.addResource(new Decimal(0))).toBe(true);
            expect(resource.getResourceCount().eq(100)).toBe(true);
        });

        it("отклоняет отрицательное значение", () => {
            const resource = makeResource();

            expect(resource.addResource(new Decimal(-1))).toBe(false);
            expect(resource.getResourceCount().eq(100)).toBe(true);
        });

        it("не обрезает по складу — это делает pruneResource", () => {
            const resource = makeResource({ count: "190", storage: "200" });

            expect(resource.addResource(new Decimal(50))).toBe(true);
            expect(resource.getResourceCount().eq(240)).toBe(true);
        });
    });

    describe("reduceResource", () => {
        it("списывает точное количество", () => {
            const resource = makeResource();

            expect(resource.reduceResource(new Decimal(40))).toBe(true);
            expect(resource.getResourceCount().eq(60)).toBe(true);
        });

        it("не уводит количество в минус", () => {
            const resource = makeResource();

            expect(resource.reduceResource(new Decimal(150))).toBe(true);
            expect(resource.getResourceCount().eq(0)).toBe(true);
        });

        it("отклоняет отрицательное значение", () => {
            const resource = makeResource();

            expect(resource.reduceResource(new Decimal(-5))).toBe(false);
            expect(resource.getResourceCount().eq(100)).toBe(true);
        });
    });

    describe("setResourceCount", () => {
        it("устанавливает неотрицательное значение", () => {
            const resource = makeResource();

            expect(resource.setResourceCount(new Decimal(0))).toBe(true);
            expect(resource.getResourceCount().eq(0)).toBe(true);
        });

        it("отклоняет отрицательное значение", () => {
            const resource = makeResource();

            expect(resource.setResourceCount(new Decimal(-1))).toBe(false);
            expect(resource.getResourceCount().eq(100)).toBe(true);
        });
    });

    describe("pruneResource", () => {
        it("обрезает излишек до вместимости склада", () => {
            const resource = makeResource({ count: "250", storage: "200" });

            resource.pruneResource();

            expect(resource.getResourceCount().eq(200)).toBe(true);
        });

        it("не меняет количество в пределах склада", () => {
            const resource = makeResource({ count: "150", storage: "200" });

            resource.pruneResource();

            expect(resource.getResourceCount().eq(150)).toBe(true);
        });

        it("при нулевом складе обрезает до нуля", () => {
            const resource = makeResource({ count: "400", storage: "0" });

            resource.pruneResource();

            expect(resource.getResourceCount().eq(0)).toBe(true);
        });
    });

    describe("spoilExcess", () => {
        it("теряет долю излишка сверх склада по spoilRate", () => {
            const resource = makeResource({ count: "250", storage: "200", spoilRate: "0.01" });

            const lost = resource.spoilExcess();

            expect(lost.eq("0.5")).toBe(true);
            expect(resource.getResourceCount().eq("249.5")).toBe(true);
        });

        it("не меняет ресурс в пределах склада", () => {
            const resource = makeResource({ count: "150", storage: "200", spoilRate: "0.5" });

            const lost = resource.spoilExcess();

            expect(lost.eq(0)).toBe(true);
            expect(resource.getResourceCount().eq(150)).toBe(true);
        });

        it("при spoilRate = 1 убирает весь излишек", () => {
            const resource = makeResource({ count: "400", storage: "0", spoilRate: "1" });

            const lost = resource.spoilExcess();

            expect(lost.eq(400)).toBe(true);
            expect(resource.getResourceCount().eq(0)).toBe(true);
        });

        it("при spoilRate = 0 не портит излишек", () => {
            const resource = makeResource({ count: "250", storage: "200", spoilRate: "0" });

            const lost = resource.spoilExcess();

            expect(lost.eq(0)).toBe(true);
            expect(resource.getResourceCount().eq(250)).toBe(true);
        });
    });

    describe("проверки количества и склада", () => {
        it("hasEnough учитывает границу", () => {
            const resource = makeResource();

            expect(resource.hasEnough(new Decimal(100))).toBe(true);
            expect(resource.hasEnough(new Decimal(101))).toBe(false);
        });

        it("canAdd учитывает точное попадание и переполнение", () => {
            const resource = makeResource({ count: "150", storage: "200" });

            expect(resource.canAdd(new Decimal(50))).toBe(true);
            expect(resource.canAdd(new Decimal(51))).toBe(false);
            expect(resource.canAdd(new Decimal(-1))).toBe(false);
        });

        it("canAdd при нулевом складе разрешает только ноль", () => {
            const resource = makeResource({ count: "0", storage: "0" });

            expect(resource.canAdd(new Decimal(0))).toBe(true);
            expect(resource.canAdd(new Decimal(1))).toBe(false);
        });

        it("canReduce учитывает границу", () => {
            const resource = makeResource();

            expect(resource.canReduce(new Decimal(100))).toBe(true);
            expect(resource.canReduce(new Decimal(101))).toBe(false);
            expect(resource.canReduce(new Decimal(-1))).toBe(false);
        });

        it("isFull и isEmpty", () => {
            const full = makeResource({ count: "200", storage: "200" });
            const empty = makeResource({ count: "0", storage: "0" });
            const partial = makeResource({ count: "50", storage: "200" });

            expect(full.isFull()).toBe(true);
            expect(empty.isFull()).toBe(true);
            expect(partial.isFull()).toBe(false);
            expect(empty.isEmpty()).toBe(true);
            expect(partial.isEmpty()).toBe(false);
        });

        it("getAvailableSpace может быть отрицательным при переполнении", () => {
            const resource = makeResource({ count: "250", storage: "200" });

            expect(resource.getAvailableSpace().eq(-50)).toBe(true);
        });
    });

    describe("операции со складом", () => {
        it("addStorage прибавляет и отклоняет отрицательное", () => {
            const resource = makeResource();

            expect(resource.addStorage(new Decimal(50))).toBe(true);
            expect(resource.getStorage().eq(250)).toBe(true);
            expect(resource.addStorage(new Decimal(-1))).toBe(false);
            expect(resource.getStorage().eq(250)).toBe(true);
        });

        it("reduceStorage не уводит вместимость в минус", () => {
            const resource = makeResource();

            expect(resource.reduceStorage(new Decimal(250))).toBe(true);
            expect(resource.getStorage().eq(0)).toBe(true);
            expect(resource.reduceStorage(new Decimal(-1))).toBe(false);
        });

        it("setStorage устанавливает и отклоняет отрицательное", () => {
            const resource = makeResource();

            expect(resource.setStorage(new Decimal(500))).toBe(true);
            expect(resource.getStorage().eq(500)).toBe(true);
            expect(resource.setStorage(new Decimal(-1))).toBe(false);
            expect(resource.getStorage().eq(500)).toBe(true);
        });
    });

    describe("флаги", () => {
        it("меняет open, renewable и renewRate", () => {
            const resource = makeResource();

            resource.setOpenStatus(false);
            resource.setRenewable(true);
            resource.setRenewableRate(new Decimal("0.25"));

            expect(resource.getOpenStatus()).toBe(false);
            expect(resource.getRenewable()).toBe(true);
            expect(resource.getRenewableRate().eq("0.25")).toBe(true);
        });
    });

    describe("сериализация", () => {
        it("serializeForStore форматирует числа для UI", () => {
            const resource = makeResource({
                count: "12.34",
                storage: "56.78",
                renewRate: "0.001234"
            });

            expect(resource.serializeForStore()).toEqual({
                id: "Wood",
                name: "Wood",
                description: "",
                count: "12.34",
                storage: "56.78",
                icon: "",
                open: true,
                owner: "player",
                renewable: false,
                renewRate: "0.001234",
                spoilRate: "0.010000"
            });
        });

        it("serializeForStore добавляет нули до нужной точности", () => {
            const resource = makeResource({ count: "1", storage: "2", renewRate: "0.5" });

            const data = resource.serializeForStore();

            expect(data.count).toBe("1.00");
            expect(data.storage).toBe("2.00");
            expect(data.renewRate).toBe("0.500000");
        });

        it("serializeForSave сохраняет точность", () => {
            const resource = makeResource({ count: "1.234567890123456789" });

            const saved = resource.serializeForSave();

            expect(saved.count).toBe(resource.getResourceCount().toString());
            expect(saved.count).not.toBe("1.23");
        });

        it("round-trip serializeForSave → deserializeForSave не теряет точность", () => {
            const original = makeResource({
                count: "1.234567890123456789",
                storage: "9.876543210987654321",
                renewRate: "0.000000123456789",
                spoilRate: "0.25"
            });
            const restored = makeResource();

            restored.deserializeForSave(original.serializeForSave());

            expect(restored.getResourceCount().eq(original.getResourceCount())).toBe(true);
            expect(restored.getStorage().eq(original.getStorage())).toBe(true);
            expect(restored.getRenewableRate().eq(original.getRenewableRate())).toBe(true);
            expect(restored.getSpoilRate().eq(original.getSpoilRate())).toBe(true);
        });

        it("deserializeForSave перезаписывает все поля", () => {
            const resource = makeResource();

            resource.deserializeForSave({
                id: "Stone",
                name: "Камень",
                description: "Тяжёлый",
                count: "42",
                storage: "100",
                icon: "🪨",
                open: false,
                owner: "nature",
                renewable: true,
                renewRate: "0.01",
                spoilRate: "0.03"
            });

            expect(resource.getId()).toBe("Stone");
            expect(resource.getName()).toBe("Камень");
            expect(resource.getDescription()).toBe("Тяжёлый");
            expect(resource.getIcon()).toBe("🪨");
            expect(resource.getOpenStatus()).toBe(false);
            expect(resource.getOwner()).toBe("nature");
            expect(resource.getRenewable()).toBe(true);
            expect(resource.getResourceCount().eq(42)).toBe(true);
            expect(resource.getStorage().eq(100)).toBe(true);
            expect(resource.getRenewableRate().eq("0.01")).toBe(true);
            expect(resource.getSpoilRate().eq("0.03")).toBe(true);
        });
    });
});
