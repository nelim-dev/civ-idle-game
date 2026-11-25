import Decimal from "break_infinity.js";
import { ResourceManager } from "./ResourceManager";
import type { ResourceRequest, ResourceResult } from "./ResourceManager";
import type { ResourceData } from "@/shared/types/Resource";
import { TEST_RESOURCES, makeResourceData } from "@/test/fixtures/resources";

function d(value: string | number): Decimal {
    return new Decimal(value);
}

function createManager(
    overrides: Partial<Record<string, Partial<ResourceData>>> = {}
): ResourceManager {
    const data = TEST_RESOURCES.map((resource) => ({
        ...resource,
        ...(overrides[resource.id] ?? {})
    }));
    return new ResourceManager(data);
}

function request(
    id: string,
    priority: number,
    consumes: Record<string, Decimal> = {},
    produces: Record<string, Decimal> = {}
): ResourceRequest {
    return { id, priority, consumes, produces };
}

function resultById(results: ResourceResult[], id: string): ResourceResult {
    const found = results.find((result) => result.requestId === id);
    if (!found) {
        throw new Error(`Нет результата для запроса ${id}`);
    }
    return found;
}

describe("ResourceManager", () => {
    describe("конструктор", () => {
        it("создаёт все ресурсы из данных", () => {
            const manager = createManager();

            for (const resource of TEST_RESOURCES) {
                expect(manager.hasResource(resource.id)).toBe(true);
            }
            expect(manager.getResourceCount("Wood")?.eq(100)).toBe(true);
            expect(manager.getResourceStorage("Wood")?.eq(200)).toBe(true);
        });

        it("создаёт стартовую запись истории для каждого ресурса", () => {
            const manager = createManager();

            const history = manager.getBalanceHistory("Wood");

            expect(history).toHaveLength(1);
            expect(history[0].count.eq(100)).toBe(true);
            expect(history[0].income.eq(0)).toBe(true);
            expect(history[0].expense.eq(0)).toBe(true);
            expect(manager.getAverageBalance("Wood")?.eq(0)).toBe(true);
        });
    });

    describe("processRequests: приоритеты", () => {
        it("приоритет 1 обрабатывается раньше приоритета 0", () => {
            const manager = createManager();
            const requests = [
                request("low", 0, { Wood: d(80) }, { Stone: d(1) }),
                request("high", 1, { Wood: d(80) }, { Food: d(10) })
            ];

            const results = manager.processRequests(requests);

            expect(results.map((result) => result.requestId)).toEqual(["high", "low"]);
            expect(resultById(results, "high").satisfactionCoeff.eq(1)).toBe(true);
            expect(resultById(results, "low").satisfactionCoeff.eq("0.25")).toBe(true);
            expect(resultById(results, "low").actualConsumes.Wood.eq(20)).toBe(true);
            expect(resultById(results, "low").actualProduces.Stone.eq("0.25")).toBe(true);
        });

        it("приоритет 30 обрабатывается раньше приоритета 0", () => {
            const manager = createManager();
            const requests = [
                request("lowest", 0, { Wood: d(60) }),
                request("thirty", 30, { Wood: d(60) })
            ];

            const results = manager.processRequests(requests);

            expect(results.map((result) => result.requestId)).toEqual(["thirty", "lowest"]);
            expect(resultById(results, "thirty").satisfactionCoeff.eq(1)).toBe(true);
            expect(resultById(results, "lowest").satisfactionCoeff.eq(d(40).div(60))).toBe(true);
        });

        it("приоритет 1 обрабатывается раньше приоритета 2", () => {
            const manager = createManager();
            const requests = [
                request("second", 2, { Wood: d(60) }),
                request("first", 1, { Wood: d(60) })
            ];

            const results = manager.processRequests(requests);

            expect(results.map((result) => result.requestId)).toEqual(["first", "second"]);
            expect(resultById(results, "first").satisfactionCoeff.eq(1)).toBe(true);
            expect(resultById(results, "second").satisfactionCoeff.eq(d(40).div(60))).toBe(true);
        });
    });

    describe("processRequests: дефицит", () => {
        it("масштабирует запрос при нехватке одного ресурса", () => {
            const manager = createManager({ Wood: { count: "5" } });
            const requests = [request("r", 1, { Wood: d(10) }, { Food: d(2) })];

            const result = manager.processRequests(requests)[0];

            expect(result.satisfactionCoeff.eq("0.5")).toBe(true);
            expect(result.actualConsumes.Wood.eq(5)).toBe(true);
            expect(result.actualProduces.Food.eq(1)).toBe(true);
        });

        it("масштабирует по самому дефицитному ресурсу", () => {
            const manager = createManager({ Stone: { count: "2" } });
            const requests = [
                request("r", 1, { Wood: d(10), Stone: d(4) }, { Food: d(2) })
            ];

            const result = manager.processRequests(requests)[0];

            expect(result.satisfactionCoeff.eq("0.5")).toBe(true);
            expect(result.actualConsumes.Wood.eq(5)).toBe(true);
            expect(result.actualConsumes.Stone.eq(2)).toBe(true);
            expect(result.actualProduces.Food.eq(1)).toBe(true);
        });

        it("распределяет общий ресурс пропорционально внутри группы", () => {
            const manager = createManager({ Wood: { count: "10" } });
            const requests = [
                request("a", 1, { Wood: d(4) }),
                request("b", 1, { Wood: d(8) })
            ];

            const results = manager.processRequests(requests);
            const a = resultById(results, "a");
            const b = resultById(results, "b");

            expect(a.satisfactionCoeff.toNumber()).toBeCloseTo(5 / 6, 6);
            expect(b.satisfactionCoeff.toNumber()).toBeCloseTo(5 / 6, 6);
            expect(a.actualConsumes.Wood.toNumber()).toBeCloseTo(20 / 6, 6);
            expect(b.actualConsumes.Wood.toNumber()).toBeCloseTo(40 / 6, 6);
        });

        it("сначала удовлетворяет запросы без критического ресурса", () => {
            const manager = createManager({
                Wood: { count: "5" },
                Stone: { count: "100" }
            });
            const requests = [
                request("wood", 1, { Wood: d(10) }),
                request("stone", 1, { Stone: d(5) })
            ];

            const results = manager.processRequests(requests);

            expect(resultById(results, "wood").satisfactionCoeff.eq("0.5")).toBe(true);
            expect(resultById(results, "stone").satisfactionCoeff.eq(1)).toBe(true);
            expect(resultById(results, "stone").actualConsumes.Stone.eq(5)).toBe(true);
        });

        it("возвращает нулевое удовлетворение при нулевом запасе", () => {
            const manager = createManager({ Wood: { count: "0" } });
            const requests = [request("r", 1, { Wood: d(10) }, { Food: d(5) })];

            const result = manager.processRequests(requests)[0];

            expect(result.satisfactionCoeff.eq(0)).toBe(true);
            expect(result.actualConsumes.Wood.eq(0)).toBe(true);
            expect(result.actualProduces.Food.eq(0)).toBe(true);
        });

        it("неизвестный ресурс считается отсутствующим", () => {
            const manager = createManager();
            const requests = [request("r", 1, { Unknown: d(5) })];

            const result = manager.processRequests(requests)[0];

            expect(result.satisfactionCoeff.eq(0)).toBe(true);
            expect(result.actualConsumes.Unknown.eq(0)).toBe(true);
        });

        it("запрос только с производством удовлетворяется полностью", () => {
            const manager = createManager();
            const requests = [request("r", 1, {}, { Food: d(5) })];

            const result = manager.processRequests(requests)[0];

            expect(result.satisfactionCoeff.eq(1)).toBe(true);
            expect(result.actualProduces.Food.eq(5)).toBe(true);
        });

        it("пустой список запросов возвращает пустой результат", () => {
            const manager = createManager();

            expect(manager.processRequests([])).toEqual([]);
        });

        it("не меняет реальные ресурсы и историю", () => {
            const manager = createManager();
            manager.processRequests([request("r", 1, { Wood: d(50) }, { Food: d(10) })]);
            manager.tick();

            expect(manager.getResourceCount("Wood")?.eq(100)).toBe(true);
            const history = manager.getBalanceHistory("Wood");
            expect(history[history.length - 1].income.eq(0)).toBe(true);
            expect(history[history.length - 1].expense.eq(0)).toBe(true);
        });
    });

    describe("applyRequests", () => {
        it("списывает потребление и начисляет производство", () => {
            const manager = createManager();
            const results = manager.processRequests([
                request("r", 1, { Wood: d(30) }, { Food: d(5) })
            ]);

            manager.applyRequests(results);

            expect(manager.getResourceCount("Wood")?.eq(70)).toBe(true);
            expect(manager.getResourceCount("Food")?.eq(5)).toBe(true);
        });

        it("не уводит ресурс в минус", () => {
            const manager = createManager({ Wood: { count: "10" } });

            manager.applyRequests([
                {
                    requestId: "r",
                    satisfactionCoeff: d(1),
                    actualConsumes: { Wood: d(50) },
                    actualProduces: {}
                }
            ]);

            expect(manager.getResourceCount("Wood")?.eq(0)).toBe(true);
        });

        it("портит излишек производства в конце хода", () => {
            const manager = createManager();
            manager.applyRequests([
                {
                    requestId: "r",
                    satisfactionCoeff: d(1),
                    actualConsumes: {},
                    actualProduces: { Wood: d(150) }
                }
            ]);

            expect(manager.getResourceCount("Wood")?.eq(250)).toBe(true);

            manager.tick();

            expect(manager.getResourceCount("Wood")?.eq("249.5")).toBe(true);
        });

        it("переносит доход и расход в историю следующего tick", () => {
            const manager = createManager();
            manager.applyRequests([
                {
                    requestId: "r",
                    satisfactionCoeff: d(1),
                    actualConsumes: { Wood: d(20) },
                    actualProduces: { Food: d(5) }
                }
            ]);

            manager.tick();

            const woodHistory = manager.getBalanceHistory("Wood");
            const woodLast = woodHistory[woodHistory.length - 1];
            const foodHistory = manager.getBalanceHistory("Food");
            const foodLast = foodHistory[foodHistory.length - 1];

            expect(woodLast.income.eq(0)).toBe(true);
            expect(woodLast.expense.eq(20)).toBe(true);
            expect(foodLast.income.eq(5)).toBe(true);
            expect(foodLast.expense.eq(0)).toBe(true);
        });

        it("reduceResources и addResources отклоняют отрицательные значения целиком", () => {
            const manager = createManager();

            expect(manager.reduceResources({ Wood: d(10), Stone: d(-1) })).toBe(false);
            expect(manager.addResources({ Wood: d(10), Stone: d(-1) })).toBe(false);
            expect(manager.getResourceCount("Wood")?.eq(100)).toBe(true);
        });
    });

    describe("tick: восстановление, обрезка, история", () => {
        it("растит возобновляемый ресурс на count × renewRate", () => {
            const manager = createManager();

            manager.tick();

            expect(manager.getResourceCount("Tree")?.eq(1100)).toBe(true);
        });

        it("обрезает рост возобновляемого ресурса по складу", () => {
            const manager = createManager({ Tree: { count: "1990" } });

            manager.tick();

            expect(manager.getResourceCount("Tree")?.eq(2000)).toBe(true);
        });

        it("не растит исчерпанный возобновляемый ресурс", () => {
            const manager = createManager({ Tree: { count: "0" } });

            manager.tick();

            expect(manager.getResourceCount("Tree")?.eq(0)).toBe(true);
        });

        it("не меняет невозобновляемый ресурс", () => {
            const manager = createManager();

            manager.tick();

            expect(manager.getResourceCount("Wood")?.eq(100)).toBe(true);
        });

        it("портит излишек невозобновляемого ресурса по spoilRate", () => {
            const manager = createManager({ Wood: { count: "250" } });

            manager.tick();

            expect(manager.getResourceCount("Wood")?.eq("249.5")).toBe(true);
        });

        it("портит излишек при нулевом складе, а не обрезает сразу", () => {
            const manager = createManager({
                Wood: { count: "400", storage: "0", spoilRate: "0.01" }
            });

            manager.tick();

            expect(manager.getResourceCount("Wood")?.eq(396)).toBe(true);
        });

        it("при spoilRate = 1 полностью сбрасывает излишек игрока", () => {
            const manager = createManager({
                BuildPower: { count: "100", storage: "0", spoilRate: "1" }
            });

            manager.tick();

            expect(manager.getResourceCount("BuildPower")?.eq(0)).toBe(true);
        });

        it("записывает в историю количество после порчи", () => {
            const manager = createManager({ Wood: { count: "250" } });

            manager.tick();

            const history = manager.getBalanceHistory("Wood");
            expect(history[history.length - 1].count.eq("249.5")).toBe(true);
        });

        it("записывает доход, расход и количество в историю и сбрасывает счётчики", () => {
            const manager = createManager();
            manager.addResources({ Wood: d(20) });
            manager.reduceResources({ Wood: d(5) });

            manager.tick();

            const history = manager.getBalanceHistory("Wood");
            const last = history[history.length - 1];

            expect(history).toHaveLength(2);
            expect(last.count.eq(115)).toBe(true);
            expect(last.income.eq(20)).toBe(true);
            expect(last.expense.eq(5)).toBe(true);

            manager.tick();

            const nextHistory = manager.getBalanceHistory("Wood");
            const nextLast = nextHistory[nextHistory.length - 1];
            expect(nextLast.income.eq(0)).toBe(true);
            expect(nextLast.expense.eq(0)).toBe(true);
        });

        it("balanceHistoryLength ограничивает историю последними записями", () => {
            const manager = createManager();

            for (let step = 0; step < 101; step += 1) {
                manager.tick();
            }

            const history = manager.getBalanceHistory("Wood");
            expect(history).toHaveLength(100);
            expect(
                history[history.length - 1].count.eq(manager.getResourceCount("Wood")!)
            ).toBe(true);
        });
    });

    describe("история баланса", () => {
        function prepareHistory(): ResourceManager {
            const manager = createManager();
            manager.addResources({ Wood: d(10) });
            manager.tick();
            manager.reduceResources({ Wood: d(4) });
            manager.tick();
            return manager;
        }

        it("getBalanceHistory возвращает последние steps записей", () => {
            const manager = prepareHistory();

            const all = manager.getBalanceHistory("Wood");
            const lastOne = manager.getBalanceHistory("Wood", 1);
            const lastTwo = manager.getBalanceHistory("Wood", 2);

            expect(all).toHaveLength(3);
            expect(lastOne).toHaveLength(1);
            expect(lastTwo).toHaveLength(2);
            expect(lastTwo[1]).toBe(all[2]);
            expect(manager.getBalanceHistory("Wood", 0)).toBe(all);
            expect(manager.getBalanceHistory("Unknown")).toEqual([]);
        });

        it("getAverageBalance считает средний доход минус расход", () => {
            const manager = prepareHistory();

            expect(manager.getAverageBalance("Wood", 2)?.eq(3)).toBe(true);
            expect(manager.getAverageBalance("Wood")?.eq(2)).toBe(true);
            expect(manager.getAverageBalance("Unknown")).toBeNull();
        });

        it("getTotalIncome и getTotalExpense суммируют за период", () => {
            const manager = prepareHistory();

            expect(manager.getTotalIncome("Wood", 2)?.eq(10)).toBe(true);
            expect(manager.getTotalExpense("Wood", 2)?.eq(4)).toBe(true);
            expect(manager.getTotalIncome("Unknown")).toBeNull();
            expect(manager.getTotalExpense("Unknown")).toBeNull();
        });

        it("getCurrentBalance возвращает баланс последней записи", () => {
            const manager = prepareHistory();

            expect(manager.getCurrentBalance("Wood")?.eq(-4)).toBe(true);
            expect(manager.getCurrentBalance("Unknown")).toBeNull();
        });
    });

    describe("доступ к ресурсам", () => {
        it("возвращает null/false для неизвестного id", () => {
            const manager = createManager();

            expect(manager.getResourceCount("Unknown")).toBeNull();
            expect(manager.getResourceStorage("Unknown")).toBeNull();
            expect(manager.getResource("Unknown")).toBeUndefined();
            expect(manager.getAvailableSpace("Unknown")).toBeNull();
            expect(manager.hasEnough("Unknown", d(1))).toBe(false);
            expect(manager.canAdd("Unknown", d(1))).toBe(false);
            expect(manager.canReduce("Unknown", d(1))).toBe(false);
            expect(manager.isFull("Unknown")).toBe(false);
            expect(manager.isEmpty("Unknown")).toBe(false);
        });

        it("делегирует проверки ресурсу", () => {
            const manager = createManager();

            expect(manager.hasEnough("Wood", d(100))).toBe(true);
            expect(manager.hasEnough("Wood", d(101))).toBe(false);
            expect(manager.canAdd("Wood", d(100))).toBe(true);
            expect(manager.canAdd("Wood", d(101))).toBe(false);
            expect(manager.canReduce("Wood", d(100))).toBe(true);
            expect(manager.canReduce("Wood", d(101))).toBe(false);
            expect(manager.isFull("Stone")).toBe(true);
            expect(manager.isEmpty("Food")).toBe(true);
            expect(manager.getAvailableSpace("Wood")?.eq(100)).toBe(true);
        });

        it("фильтрует по владельцу, открытости и возобновляемости", () => {
            const manager = createManager();

            expect(Object.keys(manager.getResourcesByOwner("nature"))).toEqual(["Tree"]);
            expect(Object.keys(manager.getRenewableResources())).toEqual(["Tree"]);
            expect(Object.keys(manager.getOpenResources())).toHaveLength(TEST_RESOURCES.length);
            expect(Object.keys(manager.getAllResources())).toHaveLength(TEST_RESOURCES.length);
            expect(manager.getResource("Wood")).toBe(manager.getAllResources().Wood);
        });

        it("меняет количество и склад через прямые методы", () => {
            const manager = createManager();

            expect(manager.addResourceDirectly("Wood", d(10))).toBe(true);
            expect(manager.reduceResourceDirectly("Wood", d(20))).toBe(true);
            expect(manager.setResourceCount("Wood", d(50))).toBe(true);
            expect(manager.addStorage("Wood", d(10))).toBe(true);
            expect(manager.reduceStorage("Wood", d(20))).toBe(true);
            expect(manager.setStorage("Wood", d(300))).toBe(true);

            expect(manager.getResourceCount("Wood")?.eq(50)).toBe(true);
            expect(manager.getResourceStorage("Wood")?.eq(300)).toBe(true);

            expect(manager.addResourceDirectly("Unknown", d(1))).toBe(false);
            expect(manager.reduceResourceDirectly("Unknown", d(1))).toBe(false);
            expect(manager.setResourceCount("Unknown", d(1))).toBe(false);
            expect(manager.addStorage("Unknown", d(1))).toBe(false);
            expect(manager.reduceStorage("Unknown", d(1))).toBe(false);
            expect(manager.setStorage("Unknown", d(1))).toBe(false);
        });
    });

    describe("сериализация", () => {
        it("serializeForStore форматирует строки и сохраняет вложенность", () => {
            const manager = createManager();

            const data = manager.serializeForStore();

            expect(data.resourcesManager.resources.Wood.count).toBe("100.00");
            expect(data.resourcesManager.resources.Wood.storage).toBe("200.00");
            expect(data.resourcesManager.balanceHistory.Wood).toHaveLength(1);
            expect(data.resourcesManager.balanceHistory.Wood[0].count).toBe("100.00");
            expect(data.resourcesManager.balanceHistory.Wood[0].income).toBe("0.00");
            expect(data.resourcesManager.balanceHistoryLength).toBe("100");
        });

        it("serializeForSave сохраняет точность строк", () => {
            const manager = createManager();
            manager.addResources({ Wood: d("1.234567890123456789") });

            const data = manager.serializeForSave();

            expect(data.resourcesManager.resources.Wood.count).toBe(
                manager.getResourceCount("Wood")?.toString()
            );
            expect(data.resourcesManager.resources.Wood.count).not.toBe("101.23");
            expect(data.resourcesManager.balanceHistoryLength).toBe("100");
        });

        it("round-trip serializeForSave → deserializeForSave сохраняет ресурсы и историю", () => {
            const manager = createManager();
            manager.addResources({ Wood: d("12.34567890123456789") });
            manager.reduceResources({ Stone: d(5) });
            manager.tick();

            const save = manager.serializeForSave();
            const restored = createManager();

            restored.deserializeForSave(save);

            expect(restored.getResourceCount("Wood")?.eq(manager.getResourceCount("Wood")!)).toBe(true);
            expect(restored.getResourceCount("Stone")?.eq(manager.getResourceCount("Stone")!)).toBe(true);
            expect(restored.getBalanceHistory("Wood")).toHaveLength(
                manager.getBalanceHistory("Wood").length
            );
            expect(restored.serializeForStore().resourcesManager.balanceHistoryLength).toBe("100");
        });

        it("deserializeForSave без resourcesManager ничего не меняет", () => {
            const manager = createManager();

            expect(() => manager.deserializeForSave({})).not.toThrow();
            expect(manager.getResourceCount("Wood")?.eq(100)).toBe(true);
            expect(manager.getBalanceHistory("Wood")).toHaveLength(1);
        });

        it("игнорирует неизвестные ресурсы в сейве", () => {
            const manager = createManager();

            manager.deserializeForSave({
                resourcesManager: {
                    resources: {
                        Unknown: makeResourceData({ id: "Unknown", count: "999" })
                    },
                    balanceHistory: {},
                    balanceHistoryLength: "100"
                }
            });

            expect(manager.hasResource("Unknown")).toBe(false);
        });

        it("обновляет только переданные части сейва", () => {
            const manager = createManager();

            manager.deserializeForSave({
                resourcesManager: {
                    resources: {
                        Wood: {
                            ...makeResourceData({ id: "Wood" }),
                            count: "42",
                            storage: "100"
                        }
                    }
                }
            });

            expect(manager.getResourceCount("Wood")?.eq(42)).toBe(true);
            expect(manager.getBalanceHistory("Wood")).toHaveLength(1);
        });

        it("восстанавливает balanceHistoryLength из сейва", () => {
            const manager = createManager();

            manager.deserializeForSave({
                resourcesManager: {
                    resources: {},
                    balanceHistory: {},
                    balanceHistoryLength: "50"
                }
            });

            expect(manager.serializeForStore().resourcesManager.balanceHistoryLength).toBe("50");
        });
    });
});
