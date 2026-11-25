// @vitest-environment jsdom

import { GameManager, getGameManager } from "./GameManager";
import { resetGameSingletons } from "@/test/helpers/resetGameSingletons";

describe("GameManager", () => {
    beforeEach(() => {
        resetGameSingletons();
        localStorage.clear();
        vi.spyOn(console, "log").mockImplementation(() => undefined);
    });

    describe("синглтон", () => {
        it("getGameManager возвращает один и тот же экземпляр", () => {
            const first = getGameManager();
            const second = getGameManager();

            expect(first).toBe(second);
            expect(GameManager.getInstance()).toBe(first);
        });

        it("после resetGameSingletons создаётся новый экземпляр", () => {
            const first = getGameManager();

            resetGameSingletons();
            const second = getGameManager();

            expect(second).not.toBe(first);
        });

        it("getEventBus возвращает тот же bus", () => {
            const manager = getGameManager();

            expect(manager.getEventBus()).toBe(manager.getEventBus());
        });
    });

    describe("send", () => {
        it("эмитит событие с payload", () => {
            const manager = getGameManager();
            const listener = vi.fn();
            manager.getEventBus().on("custom:event", listener);

            manager.send("custom:event", { value: 42 });

            expect(listener).toHaveBeenCalledTimes(1);
            expect(listener).toHaveBeenCalledWith({ value: 42 });
        });

        it("эмитит undefined без payload", () => {
            const manager = getGameManager();
            const listener = vi.fn();
            manager.getEventBus().on("custom:event", listener);

            manager.send("custom:event");

            expect(listener).toHaveBeenCalledWith(undefined);
        });

        it("не бросает для неизвестной команды", () => {
            const manager = getGameManager();

            expect(() => manager.send("unknown:command", {})).not.toThrow();
        });
    });

    describe("serializeEconomy", () => {
        it("возвращает снимок экономики в форме EconomySnapshot", () => {
            const manager = getGameManager();

            const snapshot = manager.serializeEconomy();

            expect(snapshot.balanceHistoryLength).toBe(100);
            expect(snapshot.resources.Wood).toBeDefined();
            expect(snapshot.resources.WaterDeposit).toBeDefined();
            expect(snapshot.resources.BuildPower).toBeDefined();
            expect(snapshot.resources.Money).toBeDefined();
            expect(snapshot.resources.Wood.count).toBe("400.00");
            expect(snapshot.resources.WaterDeposit.count).toBe("800000000.00");
            expect(snapshot.resources.Money.open).toBe(false);
            expect(snapshot.balanceHistory.Wood).toHaveLength(1);
        });

        it("не содержит вложенности resourcesManager", () => {
            const manager = getGameManager();

            const snapshot = manager.serializeEconomy();

            expect(snapshot).not.toHaveProperty("resourcesManager");
            expect(snapshot.resources).not.toHaveProperty("resourcesManager");
        });
    });

    describe("тик через EventBus", () => {
        it("проводит tick через EconomySystem и ResourceManager", () => {
            const manager = getGameManager();
            const listener = vi.fn();
            manager.getEventBus().on("tick", listener);

            manager.send("tick", { step: 1 });

            const snapshot = manager.serializeEconomy();

            expect(listener).toHaveBeenCalledWith({ step: 1 });
            expect(snapshot.resources.Wood.count).toBe("396.00");
            expect(snapshot.resources.WaterDeposit.count).toBe("800008000.00");
            expect(snapshot.resources.Tree.count).toBe("50000.00");
        });
    });

    describe("регистрация Saveable", () => {
        it("saveGame сохраняет экономику в localStorage", () => {
            const manager = getGameManager();

            manager.send("saveGame");

            const raw = localStorage.getItem("gameSave");
            expect(raw).not.toBeNull();
            const parsed = JSON.parse(raw!);
            expect(parsed).toHaveProperty("economy");
            expect(parsed.economy).toHaveProperty("resourcesManager");
        });

        it("loadGame восстанавливает снимок после тика", () => {
            const manager = getGameManager();
            const before = manager.serializeEconomy();

            manager.send("saveGame");
            manager.send("tick", { step: 1 });
            expect(manager.serializeEconomy().resources.Wood.count).toBe("396.00");

            manager.send("loadGame");

            expect(manager.serializeEconomy()).toEqual(before);
        });

        it("loadGame без сейва не бросает и не меняет состояние", () => {
            const manager = getGameManager();
            const before = manager.serializeEconomy();

            expect(() => manager.send("loadGame")).not.toThrow();
            expect(manager.serializeEconomy()).toEqual(before);
        });
    });
});
