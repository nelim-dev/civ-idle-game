// @vitest-environment jsdom

import { disposeStoreBridge, initStoreBridge } from "./storeBridge";
import { getGameManager } from "@/logic/GameManager";
import { useGameStore } from "@/store/gameStore";
import { resetGameSingletons } from "@/test/helpers/resetGameSingletons";
import type { EconomySnapshot } from "@/shared/types/Economy";

const EMPTY_ECONOMY: EconomySnapshot = {
    resources: {},
    balanceHistory: {},
    balanceHistoryLength: 0
};

function resetStore(): void {
    useGameStore.setState({
        gameStep: 0,
        gameSpeed: 1,
        economy: EMPTY_ECONOMY
    });
}

describe("storeBridge", () => {
    beforeEach(() => {
        disposeStoreBridge();
        resetGameSingletons();
        resetStore();
        localStorage.clear();
        vi.spyOn(console, "log").mockImplementation(() => undefined);
    });

    afterEach(() => {
        disposeStoreBridge();
    });

    describe("инициализация", () => {
        it("сразу синхронизирует экономику в store", () => {
            initStoreBridge();

            const state = useGameStore.getState();

            expect(state.economy.resources.Wood.count).toBe("400.00");
            expect(state.economy.resources.WaterDeposit.count).toBe("800000000.00");
            expect(state.economy.balanceHistoryLength).toBe(100);
        });

        it("повторный init не подписывается второй раз", () => {
            const manager = getGameManager();
            const serializeSpy = vi.spyOn(manager, "serializeEconomy");

            initStoreBridge();
            initStoreBridge();

            expect(serializeSpy).toHaveBeenCalledTimes(1);

            manager.send("tick", { step: 1 });

            expect(serializeSpy).toHaveBeenCalledTimes(2);
        });
    });

    describe("tick", () => {
        it("обновляет gameStep и экономику", () => {
            const manager = getGameManager();
            initStoreBridge();

            manager.send("tick", { step: 7 });

            const state = useGameStore.getState();
            const economy = manager.serializeEconomy();

            expect(state.gameStep).toBe(7);
            // Store получает ровно тот снимок, который отдаёт логика;
            // конкретные значения складов в ожиданиях не фиксируются.
            expect(state.economy.resources).toEqual(economy.resources);
            // Интеграция: здания подключены к запущенному GameManager.
            expect(state.economy.buildings?.CentralBase?.owned).toBe("1");
            expect(state.economy.constructionProjects).toEqual([]);
        });

        it("без step не меняет gameStep", () => {
            useGameStore.setState({ gameStep: 3 });
            initStoreBridge();

            getGameManager().send("tick");

            expect(useGameStore.getState().gameStep).toBe(3);
        });

        it("step = 0 применяется как значение", () => {
            useGameStore.setState({ gameStep: 5 });
            initStoreBridge();

            getGameManager().send("tick", { step: 0 });

            expect(useGameStore.getState().gameStep).toBe(0);
        });
    });

    describe("speed:changed", () => {
        it("обновляет gameSpeed", () => {
            initStoreBridge();

            getGameManager().send("speed:changed", { speed: 5 });

            expect(useGameStore.getState().gameSpeed).toBe(5);
        });

        it("без speed не меняет gameSpeed", () => {
            initStoreBridge();

            getGameManager().send("speed:changed");

            expect(useGameStore.getState().gameSpeed).toBe(1);
        });

        it("speed = 0 применяется как пауза", () => {
            initStoreBridge();

            getGameManager().send("speed:changed", { speed: 0 });

            expect(useGameStore.getState().gameSpeed).toBe(0);
        });
    });

    describe("loadGame", () => {
        it("синхронизирует store после загрузки сейва", () => {
            const manager = getGameManager();
            initStoreBridge();
            const before = manager.serializeEconomy();

            manager.send("saveGame");
            manager.send("tick", { step: 1 });

            // После тика store отражает текущее состояние логики.
            expect(useGameStore.getState().economy.resources).toEqual(
                manager.serializeEconomy().resources
            );

            manager.send("loadGame");

            const afterLoad = useGameStore.getState().economy;
            // Загрузка возвращает сохранённый снимок без привязки к числам складов.
            expect(afterLoad.resources).toEqual(before.resources);
            expect(afterLoad.buildings?.CentralBase?.owned).toBe("1");
            expect(afterLoad.constructionProjects).toEqual([]);
        });
    });

    describe("disposeStoreBridge", () => {
        it("отписывает от tick, speed:changed и loadGame", () => {
            initStoreBridge();
            disposeStoreBridge();

            const manager = getGameManager();
            manager.send("tick", { step: 9 });
            manager.send("speed:changed", { speed: 5 });

            const state = useGameStore.getState();

            expect(state.gameStep).toBe(0);
            expect(state.gameSpeed).toBe(1);
            expect(state.economy.resources.Wood.count).toBe("400.00");
        });

        it("после dispose можно инициализировать снова", () => {
            initStoreBridge();
            disposeStoreBridge();
            initStoreBridge();

            getGameManager().send("tick", { step: 2 });

            expect(useGameStore.getState().gameStep).toBe(2);
        });
    });
});
