import { resetGameSingletons } from "./helpers/resetGameSingletons";

afterEach(() => {
    vi.useRealTimers();
    resetGameSingletons();
    if (typeof localStorage !== "undefined") {
        localStorage.clear();
    }
});
