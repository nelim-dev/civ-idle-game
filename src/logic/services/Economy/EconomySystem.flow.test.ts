import resourceData from "@/data/resource.json";
import { EventBus } from "@/logic/EventBus";
import type { ResourceData } from "@/shared/types/Resource";
import { EconomySystem } from "./EconomySystem";

/**
 * Контракт этапа 1.2 на уровне хода EconomySystem:
 * BuildPower — поток текущего хода, он сбрасывается в конце хода и не
 * попадает в сейв. Ожидаемое поведение из docs/game-design_v1.md §4.2,
 * §4.3, §5.5, §18.3 и docs/status.md, этап 1.2.
 */

const RESOURCES = resourceData as ResourceData[];

type Overrides = Partial<Record<string, Partial<ResourceData>>>;

function createSystem(overrides: Overrides = {}): {
    system: EconomySystem;
    bus: EventBus;
} {
    const data = RESOURCES.map((resource) => ({
        ...resource,
        ...(overrides[resource.id] ?? {})
    }));
    const bus = new EventBus();
    return {
        system: new EconomySystem(bus, data),
        bus
    };
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

describe("EconomySystem: BuildPower как поток (этап 1.2)", () => {
    it("сбрасывает поток в конце хода", () => {
        const { system, bus } = createSystem({
            BuildPower: { count: "20", storage: "1000", spoilRate: "0" }
        });

        bus.emit("tick");

        expect(system.serialize().resources.BuildPower.count).toBe("0.00");
    });

    it("исключает поток из serializeForSave", () => {
        const { system } = createSystem();

        const save = system.serializeForSave();

        expect(savedResources(save)).not.toHaveProperty("BuildPower");
    });

    it("оставляет поток в снимке для store", () => {
        const { system } = createSystem({
            BuildPower: { count: "20", storage: "1000", spoilRate: "0" }
        });

        const snapshot = system.serialize();

        expect(snapshot.resources.BuildPower).toBeDefined();
        expect(snapshot.resources.BuildPower.count).toBe("20.00");
    });

    it("игнорирует поток при загрузке сейва", () => {
        const { system } = createSystem();

        system.deserializeForSave({
            economy: {
                resourcesManager: {
                    resourcesManager: {
                        resources: {
                            BuildPower: buildPowerSave("999")
                        },
                        balanceHistory: {},
                        balanceHistoryLength: "100"
                    }
                }
            }
        });

        expect(system.serialize().resources.BuildPower.count).toBe("0.00");
    });

    it("save → load не восстанавливает поток", () => {
        const { system, bus } = createSystem({
            BuildPower: { count: "20", storage: "1000", spoilRate: "0" }
        });

        const save = system.serializeForSave();
        bus.emit("tick");
        system.deserializeForSave(save);

        expect(system.serialize().resources.BuildPower.count).toBe("0.00");
    });

    it("save → load восстанавливает обычный запас", () => {
        const { system: source } = createSystem({
            Wood: { count: "100", storage: "200" }
        });
        const save = source.serializeForSave();

        const { system: target } = createSystem({
            Wood: { count: "0", storage: "200" }
        });
        target.deserializeForSave(save);

        expect(target.serialize().resources.Wood.count).toBe("100.00");
    });
});
