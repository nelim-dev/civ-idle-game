// @vitest-environment jsdom

import { GameLoop, getGameLoop } from "./GameLoop";
import { createMockGameManager } from "@/test/helpers/createMockGameManager";
import { resetGameSingletons } from "@/test/helpers/resetGameSingletons";

function createLoop(tickMs = 1000) {
    const mock = createMockGameManager();
    const loop = new GameLoop(tickMs, mock.manager);
    return { loop, ...mock };
}

describe("GameLoop", () => {
    beforeEach(() => {
        resetGameSingletons();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe("синглтон и параметры", () => {
        it("getGameLoop возвращает один и тот же экземпляр", () => {
            const first = getGameLoop();
            const second = getGameLoop();

            expect(first).toBe(second);
            expect(first.getTickMS()).toBe(1000);
        });

        it("начальные скорость и период", () => {
            const { loop } = createLoop(500);

            expect(loop.getSpeed()).toBe(1);
            expect(loop.getTickMS()).toBe(500);
        });
    });

    describe("start и stop", () => {
        it("не тикает сразу, первый тик через tickMs", () => {
            const { loop, calls } = createLoop(1000);

            loop.start();
            vi.advanceTimersByTime(999);
            expect(calls).toHaveLength(0);

            vi.advanceTimersByTime(1);
            expect(calls).toHaveLength(1);
            expect(calls[0]).toEqual({ command: "tick", payload: { step: 1 } });
        });

        it("start идемпотентен и не создаёт второй интервал", () => {
            const { loop, calls } = createLoop(1000);

            loop.start();
            loop.start();
            vi.advanceTimersByTime(1000);

            expect(calls).toHaveLength(1);
        });

        it("stop прекращает тики", () => {
            const { loop, calls } = createLoop(1000);

            loop.start();
            vi.advanceTimersByTime(1000);
            loop.stop();
            vi.advanceTimersByTime(5000);

            expect(calls).toHaveLength(1);
        });

        it("start после stop возобновляет тики и продолжает шаг", () => {
            const { loop, calls } = createLoop(1000);

            loop.start();
            vi.advanceTimersByTime(1000);
            loop.stop();
            loop.start();
            vi.advanceTimersByTime(1000);

            expect(calls).toHaveLength(2);
            expect(calls[1]).toEqual({ command: "tick", payload: { step: 2 } });
        });
    });

    describe("setSpeed", () => {
        it("setSpeed(0) останавливает и эмитит speed:changed", () => {
            const { loop, calls } = createLoop(1000);

            loop.start();
            loop.setSpeed(0);
            vi.advanceTimersByTime(5000);

            expect(loop.getSpeed()).toBe(0);
            expect(calls.map((call) => call.command)).toEqual(["speed:changed"]);
            expect(calls[0].payload).toEqual({ speed: 0 });
        });

        it("start не запускает цикл после паузы", () => {
            const { loop, calls } = createLoop(1000);

            loop.setSpeed(0);
            loop.start();
            vi.advanceTimersByTime(5000);

            expect(calls).toHaveLength(1);
            expect(calls[0].payload).toEqual({ speed: 0 });
        });

        it("setSpeed(2) задаёт период 500 мс", () => {
            const { loop, calls } = createLoop(1000);

            loop.setSpeed(2);
            vi.advanceTimersByTime(500);

            expect(loop.getSpeed()).toBe(2);
            expect(loop.getTickMS()).toBe(500);
            expect(calls[0]).toEqual({ command: "speed:changed", payload: { speed: 2 } });
            expect(calls[1]).toEqual({ command: "tick", payload: { step: 1 } });
        });

        it("setSpeed(5) задаёт период 200 мс", () => {
            const { loop, calls } = createLoop(1000);

            loop.setSpeed(5);
            vi.advanceTimersByTime(600);

            expect(loop.getTickMS()).toBe(200);
            expect(calls.filter((call) => call.command === "tick")).toHaveLength(3);
        });

        it("смена скорости на ходу перезапускает интервал", () => {
            const { loop, calls } = createLoop(1000);

            loop.start();
            vi.advanceTimersByTime(1000);
            loop.setSpeed(2);
            vi.advanceTimersByTime(500);

            expect(loop.getTickMS()).toBe(500);
            expect(calls.filter((call) => call.command === "tick")).toHaveLength(2);
        });
    });

    describe("fast-forward", () => {
        it("выполняет N шагов и восстанавливает скорость", () => {
            const { loop, calls } = createLoop(1000);

            loop.start();
            loop.startFastForward(5, 3);
            vi.advanceTimersByTime(600);

            expect(calls.map((call) => call.command)).toEqual([
                "speed:changed",
                "tick",
                "tick",
                "tick",
                "speed:changed"
            ]);
            expect(calls[0].payload).toEqual({ speed: 5 });
            expect(calls[1].payload).toEqual({ step: 1 });
            expect(calls[3].payload).toEqual({ step: 3 });
            expect(calls[4].payload).toEqual({ speed: 1 });

            vi.advanceTimersByTime(1000);

            const tickCalls = calls.filter((call) => call.command === "tick");
            expect(tickCalls).toHaveLength(4);
            expect(tickCalls[3].payload).toEqual({ step: 4 });
        });

        it("не запускается при speed <= 0 или steps <= 0", () => {
            const { loop, calls } = createLoop(1000);

            loop.startFastForward(0, 5);
            loop.startFastForward(5, 0);
            loop.startFastForward(-1, 3);
            loop.startFastForward(2, -1);
            vi.advanceTimersByTime(5000);

            expect(loop.getSpeed()).toBe(1);
            expect(calls).toHaveLength(0);
        });

        it("пауза отменяет восстановление скорости", () => {
            const { loop, calls } = createLoop(1000);

            loop.start();
            loop.startFastForward(5, 10);
            vi.advanceTimersByTime(200);
            loop.setSpeed(0);
            vi.advanceTimersByTime(5000);

            expect(calls.map((call) => call.command)).toEqual([
                "speed:changed",
                "tick",
                "speed:changed"
            ]);
            expect(calls[2].payload).toEqual({ speed: 0 });
            expect(loop.getSpeed()).toBe(0);
        });

        it("restoreSpeed возвращает сохранённую скорость", () => {
            const { loop, calls } = createLoop(1000);

            loop.startFastForward(5, 10);
            loop.restoreSpeed();

            expect(loop.getSpeed()).toBe(1);
            expect(calls.map((call) => call.command)).toEqual([
                "speed:changed",
                "speed:changed"
            ]);
            expect(calls[1].payload).toEqual({ speed: 1 });
        });
    });

    describe("payload tick", () => {
        it("шаг увеличивается на каждом тике", () => {
            const { loop, calls } = createLoop(1000);

            loop.start();
            vi.advanceTimersByTime(3000);

            const tickCalls = calls.filter((call) => call.command === "tick");
            expect(tickCalls.map((call) => call.payload)).toEqual([
                { step: 1 },
                { step: 2 },
                { step: 3 }
            ]);
        });
    });
});
