import { GameLoop } from "./GameLoop";
import { createMockGameManager } from "@/test/helpers/createMockGameManager";

describe("GameLoop без window (SSR)", () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("start не создаёт таймер", () => {
        const { manager } = createMockGameManager();
        const loop = new GameLoop(1000, manager);

        loop.start();

        expect(vi.getTimerCount()).toBe(0);
    });

    it("setSpeed эмитит событие, но не создаёт таймер", () => {
        const { manager, calls } = createMockGameManager();
        const loop = new GameLoop(1000, manager);

        loop.setSpeed(2);

        expect(loop.getSpeed()).toBe(2);
        expect(calls).toEqual([{ command: "speed:changed", payload: { speed: 2 } }]);
        expect(vi.getTimerCount()).toBe(0);
    });

    it("stop без запуска не бросает", () => {
        const { manager } = createMockGameManager();
        const loop = new GameLoop(1000, manager);

        expect(() => loop.stop()).not.toThrow();
    });
});
