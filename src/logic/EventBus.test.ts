import { EventBus } from "./EventBus";

describe("EventBus", () => {
    it("вызывает подписчика с payload", () => {
        const bus = new EventBus();
        const listener = vi.fn();

        bus.on("tick", listener);
        bus.emit("tick", { step: 1 });

        expect(listener).toHaveBeenCalledTimes(1);
        expect(listener).toHaveBeenCalledWith({ step: 1 });
    });

    it("передаёт undefined, если payload не указан", () => {
        const bus = new EventBus();
        const listener = vi.fn();

        bus.on("tick", listener);
        bus.emit("tick");

        expect(listener).toHaveBeenCalledWith(undefined);
    });

    it("вызывает всех подписчиков в порядке подписки", () => {
        const bus = new EventBus();
        const calls: string[] = [];

        bus.on("tick", () => calls.push("first"));
        bus.on("tick", () => calls.push("second"));
        bus.emit("tick");

        expect(calls).toEqual(["first", "second"]);
    });

    it("off удаляет только указанного подписчика", () => {
        const bus = new EventBus();
        const first = vi.fn();
        const second = vi.fn();

        bus.on("tick", first);
        bus.on("tick", second);
        bus.off("tick", first);
        bus.emit("tick");

        expect(first).not.toHaveBeenCalled();
        expect(second).toHaveBeenCalledTimes(1);
    });

    it("возвращённая функция отписывает и идемпотентна", () => {
        const bus = new EventBus();
        const listener = vi.fn();

        const unsubscribe = bus.on("tick", listener);
        unsubscribe();
        unsubscribe();
        bus.emit("tick");

        expect(listener).not.toHaveBeenCalled();
    });

    it("off для неизвестного события не бросает", () => {
        const bus = new EventBus();

        expect(() => bus.off("unknown", () => undefined)).not.toThrow();
    });

    it("emit для события без подписчиков не бросает", () => {
        const bus = new EventBus();

        expect(() => bus.emit("unknown", { any: "payload" })).not.toThrow();
    });

    it("один и тот же callback, подписанный дважды, вызывается один раз", () => {
        const bus = new EventBus();
        const listener = vi.fn();

        bus.on("tick", listener);
        bus.on("tick", listener);
        bus.emit("tick");

        expect(listener).toHaveBeenCalledTimes(1);
    });

    it("подписчик, отписавшийся во время emit, не мешает остальным", () => {
        const bus = new EventBus();
        const calls: string[] = [];
        const first = () => {
            calls.push("first");
            bus.off("tick", first);
        };
        const second = () => calls.push("second");

        bus.on("tick", first);
        bus.on("tick", second);

        bus.emit("tick");
        expect(calls).toEqual(["first", "second"]);

        bus.emit("tick");
        expect(calls).toEqual(["first", "second", "second"]);
    });

    it("после отписки всех слушателей emit никого не вызывает", () => {
        const bus = new EventBus();
        const listener = vi.fn();

        bus.on("tick", listener);
        bus.off("tick", listener);
        bus.emit("tick");

        expect(listener).not.toHaveBeenCalled();
    });
});
