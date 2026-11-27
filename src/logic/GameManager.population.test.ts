// @vitest-environment jsdom

import { getGameManager } from "./GameManager";
import type { Population } from "./services/Economy/PopulationSystem/PopulationSystem";
import populationData from "@/data/population.json";
import { resetGameSingletons } from "@/test/helpers/resetGameSingletons";
import type { EconomySnapshotContract } from "@/test/helpers/populationTestSetup";

const POPULATIONS = populationData as unknown as Population[];
const PEASANTS_ID = POPULATIONS[0]?.id;

function snapshot(): EconomySnapshotContract {
    return getGameManager().serializeEconomy() as unknown as EconomySnapshotContract;
}

describe("GameManager: население", () => {
    beforeEach(() => {
        resetGameSingletons();
        localStorage.clear();
        vi.spyOn(console, "log").mockImplementation(() => undefined);
    });

    it("подключает население из population.json к запущенной игре", () => {
        const manager = getGameManager();

        manager.send("tick", { step: 1 });

        const state = snapshot();
        expect(PEASANTS_ID).toBeDefined();
        expect(state.population?.[PEASANTS_ID]).toBeDefined();
        expect(Number(state.population?.[PEASANTS_ID].count)).toBeGreaterThan(0);
    });

    it("saveGame сохраняет население в localStorage", () => {
        const manager = getGameManager();
        manager.send("tick", { step: 1 });

        manager.send("saveGame");

        const raw = localStorage.getItem("gameSave");
        expect(raw).not.toBeNull();
        const parsed = JSON.parse(raw!) as {
            economy: { population?: Record<string, unknown> };
        };
        expect(parsed.economy.population).toBeDefined();
        expect(parsed.economy.population?.[PEASANTS_ID]).toBeDefined();
    });

    it("loadGame восстанавливает население после изменения состояния", () => {
        const manager = getGameManager();
        manager.send("tick", { step: 1 });
        const before = snapshot().population;
        expect(before?.[PEASANTS_ID]).toBeDefined();

        manager.send("saveGame");
        manager.send("tick", { step: 2 });
        manager.send("loadGame");

        expect(snapshot().population).toEqual(before);
    });

    it("население потребляет еду в запущенной игре", () => {
        const manager = getGameManager();
        const before = manager.serializeEconomy();

        manager.send("tick", { step: 1 });

        const after = manager.serializeEconomy();
        expect(Number(after.resources.Food.count)).toBeLessThan(
            Number(before.resources.Food.count)
        );
    });
});
