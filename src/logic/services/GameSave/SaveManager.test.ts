// @vitest-environment jsdom

import { EventBus } from "@/logic/EventBus";
import { SaveManager } from "./SaveManager";
import type { Saveable } from "./Isaveable";

const SAVE_KEY = "gameSave";

interface FakeSaveable {
    saveable: Saveable;
    serializeForSave: ReturnType<typeof vi.fn>;
    deserializeForSave: ReturnType<typeof vi.fn>;
}

function createSaveable(
    data: Record<string, unknown>,
    onDeserialize: (saveData: Record<string, any>) => void = () => undefined
): FakeSaveable {
    const serializeForSave = vi.fn(() => data);
    const deserializeForSave = vi.fn(onDeserialize);
    return {
        saveable: { serializeForSave, deserializeForSave },
        serializeForSave,
        deserializeForSave
    };
}

describe("SaveManager", () => {
    beforeEach(() => {
        localStorage.clear();
        vi.spyOn(console, "log").mockImplementation(() => undefined);
        vi.spyOn(console, "error").mockImplementation(() => undefined);
    });

    describe("saveGame", () => {
        it("сохраняет объединённые данные всех модулей", () => {
            const bus = new EventBus();
            const manager = new SaveManager(bus);
            const economy = createSaveable({ economy: { wood: "100" } });
            const buildings = createSaveable({ buildings: { sawmill: "2" } });

            manager.register(economy.saveable);
            manager.register(buildings.saveable);
            bus.emit("saveGame");

            expect(JSON.parse(localStorage.getItem(SAVE_KEY)!)).toEqual({
                economy: { wood: "100" },
                buildings: { sawmill: "2" }
            });
            expect(economy.serializeForSave).toHaveBeenCalledTimes(1);
            expect(buildings.serializeForSave).toHaveBeenCalledTimes(1);
        });

        it("без зарегистрированных модулей пишет пустой объект", () => {
            const bus = new EventBus();
            new SaveManager(bus);

            bus.emit("saveGame");

            expect(JSON.parse(localStorage.getItem(SAVE_KEY)!)).toEqual({});
        });

        it("при повторном сохранении сериализует модули заново", () => {
            const bus = new EventBus();
            const manager = new SaveManager(bus);
            const module = createSaveable({ value: 1 });

            manager.register(module.saveable);
            bus.emit("saveGame");
            bus.emit("saveGame");

            expect(module.serializeForSave).toHaveBeenCalledTimes(2);
        });
    });

    describe("loadGame", () => {
        it("передаёт разобранный сейв каждому модулю", () => {
            const bus = new EventBus();
            const manager = new SaveManager(bus);
            const first = createSaveable({});
            const second = createSaveable({});
            const saveData = { economy: { wood: "50" }, buildings: { sawmill: "1" } };
            localStorage.setItem(SAVE_KEY, JSON.stringify(saveData));

            manager.register(first.saveable);
            manager.register(second.saveable);
            bus.emit("loadGame");

            expect(first.deserializeForSave).toHaveBeenCalledWith(saveData);
            expect(second.deserializeForSave).toHaveBeenCalledWith(saveData);
        });

        it("без сейва ничего не делает", () => {
            const bus = new EventBus();
            const manager = new SaveManager(bus);
            const module = createSaveable({});

            manager.register(module.saveable);

            expect(() => bus.emit("loadGame")).not.toThrow();
            expect(module.deserializeForSave).not.toHaveBeenCalled();
        });

        it("битый JSON логирует ошибку и не вызывает модули", () => {
            const bus = new EventBus();
            const manager = new SaveManager(bus);
            const module = createSaveable({});
            localStorage.setItem(SAVE_KEY, "{not-json");

            manager.register(module.saveable);

            expect(() => bus.emit("loadGame")).not.toThrow();
            expect(module.deserializeForSave).not.toHaveBeenCalled();
            expect(console.error).toHaveBeenCalled();
        });

        it("save → load восстанавливает состояние", () => {
            const bus = new EventBus();
            const manager = new SaveManager(bus);
            const state = { value: 1 };
            const module: Saveable = {
                serializeForSave: () => ({ module: { value: state.value } }),
                deserializeForSave: (saveData) => {
                    state.value = saveData.module.value;
                }
            };
            manager.register(module);

            state.value = 2;
            bus.emit("saveGame");
            state.value = 99;
            bus.emit("loadGame");

            expect(state.value).toBe(2);
        });
    });
});
