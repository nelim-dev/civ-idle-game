import { initStoreBridge } from "./storeBridge";
import { useGameStore } from "@/store/gameStore";
import { resetGameSingletons } from "@/test/helpers/resetGameSingletons";

describe("storeBridge без window (SSR)", () => {
    beforeEach(() => {
        resetGameSingletons();
        useGameStore.setState({
            gameStep: 0,
            gameSpeed: 1,
            economy: {
                resources: {},
                balanceHistory: {},
                balanceHistoryLength: 0
            }
        });
    });

    it("не инициализируется и не создаёт GameManager", () => {
        initStoreBridge();

        expect(globalThis.__gameManager).toBeUndefined();
        expect(useGameStore.getState().economy.resources).toEqual({});
    });

    it("не бросает при вызове", () => {
        expect(() => initStoreBridge()).not.toThrow();
    });
});
