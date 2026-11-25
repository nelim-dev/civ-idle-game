import Decimal from "break_infinity.js";
import resourceData from "@/data/resource.json";
import type { ResourceData } from "@/shared/types/Resource";
import { ResourceManager } from "./ResourceManager";

/**
 * Контракт этапа 1.2: BuildPower — поток текущего хода.
 * Ожидаемое поведение из docs/game-design_v1.md §4.2, §4.3, §5.5, §18.3.
 *
 * Тесты намеренно используют реальный resource.json и публичные методы,
 * чтобы не фиксировать способ реализации transient-ресурсов (флаг в контенте
 * или отдельный признак в логике).
 */

function d(value: string | number): Decimal {
    return new Decimal(value);
}

const RESOURCES = resourceData as ResourceData[];

type Overrides = Partial<Record<string, Partial<ResourceData>>>;

function createManager(overrides: Overrides = {}): ResourceManager {
    const data = RESOURCES.map((resource) => ({
        ...resource,
        ...(overrides[resource.id] ?? {})
    }));
    return new ResourceManager(data);
}

/**
 * Находит карту ресурсов в сейве, не завязываясь на текущую вложенность.
 * Формат сейва может меняться отдельной задачей, это не часть этапа 1.2.
 */
function findResourcesMap(value: unknown): Record<string, unknown> | null {
    if (typeof value !== "object" || value === null) {
        return null;
    }

    const record = value as Record<string, unknown>;
    if ("resources" in record) {
        const resources = record.resources;
        if (typeof resources === "object" && resources !== null) {
            return resources as Record<string, unknown>;
        }
    }

    for (const child of Object.values(record)) {
        const found = findResourcesMap(child);
        if (found) {
            return found;
        }
    }

    return null;
}

function savedResources(save: unknown): Record<string, unknown> {
    const resources = findResourcesMap(save);
    if (!resources) {
        throw new Error("В сейве не найдена карта resources");
    }
    return resources;
}

function buildPowerSave(count: string): Record<string, unknown> {
    return {
        id: "BuildPower",
        name: "Строительные мощности",
        description: "",
        count,
        storage: "1000",
        icon: "",
        open: true,
        owner: "player",
        renewable: false,
        renewRate: "0",
        spoilRate: "0"
    };
}

describe("BuildPower как поток (этап 1.2)", () => {
    describe("в течение хода", () => {
        it("накапливается", () => {
            const manager = createManager();

            manager.addResourceDirectly("BuildPower", d(20));

            expect(manager.getResourceCount("BuildPower")?.eq(20)).toBe(true);
        });

        it("расходуется", () => {
            const manager = createManager();
            manager.addResourceDirectly("BuildPower", d(20));

            manager.reduceResourceDirectly("BuildPower", d(15));

            expect(manager.getResourceCount("BuildPower")?.eq(5)).toBe(true);
        });
    });

    describe("конец хода", () => {
        it("сбрасывает поток, даже если порча не могла его обнулить", () => {
            // spoilRate = 0 и большой склад исключают объяснение сброса
            // через общее правило порчи излишка.
            const manager = createManager({
                BuildPower: { count: "20", storage: "1000", spoilRate: "0" }
            });

            manager.tick();

            expect(manager.getResourceCount("BuildPower")?.eq(0)).toBe(true);
        });

        it("не переносит поток на следующий ход", () => {
            const manager = createManager({
                BuildPower: { count: "20", storage: "1000", spoilRate: "0" }
            });

            manager.tick();
            expect(manager.getResourceCount("BuildPower")?.eq(0)).toBe(true);

            manager.addResourceDirectly("BuildPower", d(5));
            expect(manager.getResourceCount("BuildPower")?.eq(5)).toBe(true);

            manager.tick();
            expect(manager.getResourceCount("BuildPower")?.eq(0)).toBe(true);
        });

        it("не сбрасывает обычный запас игрока", () => {
            const manager = createManager({
                Wood: { count: "100", storage: "200" }
            });

            manager.tick();

            expect(manager.getResourceCount("Wood")?.eq(100)).toBe(true);
        });
    });

    describe("сериализация", () => {
        it("исключает поток из serializeForSave", () => {
            const manager = createManager();
            manager.addResourceDirectly("BuildPower", d(20));

            const save = manager.serializeForSave();

            expect(savedResources(save)).not.toHaveProperty("BuildPower");
        });

        it("оставляет поток в serializeForStore для UI", () => {
            const manager = createManager();
            manager.addResourceDirectly("BuildPower", d(20));

            const snapshot = manager.serializeForStore();

            expect(snapshot.resourcesManager.resources.BuildPower).toBeDefined();
            expect(snapshot.resourcesManager.resources.BuildPower.count).toBe("20.00");
        });

        it("игнорирует поток при загрузке сейва", () => {
            const manager = createManager();

            manager.deserializeForSave({
                resourcesManager: {
                    resources: {
                        BuildPower: buildPowerSave("999")
                    },
                    balanceHistory: {},
                    balanceHistoryLength: "100"
                }
            });

            expect(manager.getResourceCount("BuildPower")?.eq(0)).toBe(true);
        });

        it("round-trip save → load не восстанавливает поток", () => {
            const manager = createManager({
                BuildPower: { count: "20", storage: "1000", spoilRate: "0" }
            });

            const save = manager.serializeForSave();
            manager.tick();
            manager.deserializeForSave(save);

            expect(manager.getResourceCount("BuildPower")?.eq(0)).toBe(true);
        });

        it("round-trip save → load сохраняет обычный запас", () => {
            const manager = createManager({
                Wood: { count: "100", storage: "200" }
            });

            const save = manager.serializeForSave();
            manager.reduceResourceDirectly("Wood", d(40));
            manager.deserializeForSave(save);

            expect(manager.getResourceCount("Wood")?.eq(100)).toBe(true);
        });
    });
});
