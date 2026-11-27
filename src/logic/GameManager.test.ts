// @vitest-environment jsdom

import { GameManager, getGameManager } from "./GameManager";
import { resetGameSingletons } from "@/test/helpers/resetGameSingletons";
import resourceData from "@/data/resource.json";
import populationData from "@/data/population.json";
import type { ResourceData } from "@/shared/types/Resource";
import type { Population } from "./services/Economy/PopulationSystem/PopulationSystem";

const RESOURCES = resourceData as ResourceData[];
const POPULATIONS = populationData as unknown as Population[];

/** Ожидание берётся из контента, а не фиксируется числом в тесте. */
function contentResource(id: string): ResourceData {
    const resource = RESOURCES.find((item) => item.id === id);
    if (!resource) {
        throw new Error(`В контенте нет ресурса ${id}`);
    }
    return resource;
}

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
            const wood = contentResource("Wood");
            const waterDeposit = contentResource("WaterDeposit");
            const money = contentResource("Money");

            const snapshot = manager.serializeEconomy();

            expect(snapshot.balanceHistoryLength).toBe(100);
            expect(snapshot.resources.Wood).toBeDefined();
            expect(snapshot.resources.WaterDeposit).toBeDefined();
            expect(snapshot.resources.BuildPower).toBeDefined();
            expect(snapshot.resources.Money).toBeDefined();
            // Снимок не расходится с текущим контентом: значения выводятся
            // из resource.json, а не фиксируются числом в тесте.
            expect(snapshot.resources.Wood.count).toBe(
                Number(wood.count).toFixed(2)
            );
            expect(snapshot.resources.WaterDeposit.count).toBe(
                Number(waterDeposit.count).toFixed(2)
            );
            expect(snapshot.resources.Money.open).toBe(money.open);
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
            const before = manager.serializeEconomy();

            manager.send("tick", { step: 1 });

            const snapshot = manager.serializeEconomy();

            expect(listener).toHaveBeenCalledWith({ step: 1 });

            // Интеграция: GameManager передал buildings.json в EconomySystem.
            expect(snapshot.buildings?.CentralBase?.owned).toBe("1");
            expect(snapshot.constructionProjects).toEqual([]);

            // Ожидания не привязаны к числу стартовых складов. Проверяется
            // правило дизайна (docs/game-design_v1.md §5.4): портится только
            // излишек сверх вместимости. Дополнительно учитывается потребление
            // населения: фаза населения выполняется до фазы зданий.
            const population = POPULATIONS[0];
            const populationSnapshot = population
                ? before.population?.[population.id]
                : undefined;
            const populationCount = Number(populationSnapshot?.count ?? 0);
            const foodPolicyFactor =
                populationSnapshot?.foodPolicy === "economy"
                    ? 0.5
                    : populationSnapshot?.foodPolicy === "abundant"
                        ? 1.5
                        : 1;

            const populationConsumption: Record<string, number> = {};
            if (population) {
                for (const [resourceId, rate] of Object.entries(population.consumes)) {
                    const policyFactor = resourceId === "Food" ? foodPolicyFactor : 1;
                    populationConsumption[resourceId] =
                        populationCount * Number(rate) * policyFactor;
                }
            }

            for (const [id, initial] of Object.entries(before.resources)) {
                const after = snapshot.resources[id];

                if (id === "BuildPower") {
                    // Поток производится в ходу и сбрасывается в конце.
                    expect(after.count).toBe("0.00");
                    continue;
                }

                const startCount = Number(initial.count);
                const storage = Number(after.storage);
                const renewRate = Number(after.renewRate);
                const spoilRate = Number(after.spoilRate ?? "0");

                if (initial.owner === "nature") {
                    // Природные пулы восстанавливаются и обрезаются по складу.
                    const expected = Math.min(startCount * (1 + renewRate), storage);
                    expect(Number(after.count)).toBeCloseTo(expected, 2);
                    continue;
                }

                const consumed = Math.min(
                    populationConsumption[id] ?? 0,
                    startCount
                );
                const remaining = startCount - consumed;
                const excess = Math.max(0, remaining - storage);
                expect(Number(after.count)).toBeCloseTo(
                    remaining - excess * spoilRate,
                    2
                );
            }
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

            // Тик меняет состояние, но проверка не зависит от конкретных
            // значений складов: важно, что загрузка возвращает сейв.
            expect(manager.serializeEconomy()).not.toEqual(before);

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
