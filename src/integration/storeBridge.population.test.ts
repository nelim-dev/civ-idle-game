// @vitest-environment jsdom

import {
    disposeStoreBridge,
    initStoreBridge
} from "./storeBridge";
import { getGameManager } from "@/logic/GameManager";
import type { Population } from "@/logic/services/Economy/PopulationSystem/PopulationSystem";
import populationData from "@/data/population.json";
import { resetGameSingletons } from "@/test/helpers/resetGameSingletons";
import type { EconomySnapshotContract } from "@/test/helpers/populationTestSetup";
import { useGameStore } from "@/store/gameStore";

const POPULATIONS = populationData as unknown as Population[];
const PEASANTS_ID = POPULATIONS[0]?.id;

function storeEconomy(): EconomySnapshotContract {
    return useGameStore.getState().economy as unknown as EconomySnapshotContract;
}

describe("storeBridge: население", () => {
    beforeEach(() => {
        resetGameSingletons();
        localStorage.clear();
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

    afterEach(() => {
        disposeStoreBridge();
    });

    it("переносит население и предупреждения в store по тику", () => {
        initStoreBridge();
        const manager = getGameManager();

        manager.send("tick", { step: 1 });

        const economy = storeEconomy();
        expect(PEASANTS_ID).toBeDefined();
        expect(economy.population?.[PEASANTS_ID]).toBeDefined();
        expect(Array.isArray(economy.warnings)).toBe(true);
    });

    it("синхронизирует население в store после loadGame", () => {
        initStoreBridge();
        const manager = getGameManager();
        manager.send("tick", { step: 1 });
        const before = storeEconomy().population;
        expect(before?.[PEASANTS_ID]).toBeDefined();

        manager.send("saveGame");
        manager.send("tick", { step: 2 });
        manager.send("loadGame");

        expect(storeEconomy().population).toEqual(before);
    });

    it("после dispose не обновляет население в store", () => {
        initStoreBridge();
        const manager = getGameManager();
        manager.send("tick", { step: 1 });
        const before = storeEconomy().population;
        expect(before?.[PEASANTS_ID]).toBeDefined();

        disposeStoreBridge();
        manager.send("tick", { step: 2 });

        expect(storeEconomy().population).toEqual(before);
    });
});
