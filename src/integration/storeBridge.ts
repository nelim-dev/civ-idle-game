import { gameManager } from "@/logic/GameManager";
import { useGameStore } from "@/store/gameStore";

let unsubscribeTick: (() => void) | null = null;
let unsubscribeLoad: (() => void) | null = null;
let unsubscribeSpeed: (() => void) | null = null;

/**
 * Единственное место встречи логики и store.
 * Подписывается на события логики и переносит снимок экономики в Zustand.
 */
export function initStoreBridge(): void {
    if (typeof window === "undefined") return;
    if (unsubscribeTick !== null) return;

    const syncEconomy = () => {
        const snapshot = gameManager.serializeEconomy();
        useGameStore.setState((state) => ({
            economy: {
                ...state.economy,
                ...snapshot,
            },
        }));
    };

    const handleTick = (payload?: { step?: number }) => {
        const snapshot = gameManager.serializeEconomy();
        useGameStore.setState((state) => ({
            ...(payload?.step !== undefined ? { gameStep: payload.step } : {}),
            economy: {
                ...state.economy,
                ...snapshot,
            },
        }));
    };

    const handleSpeedChanged = (payload?: { speed?: number }) => {
        if (payload?.speed === undefined) return;
        useGameStore.setState({ gameSpeed: payload.speed });
    };

    const eventBus = gameManager.getEventBus();
    unsubscribeTick = eventBus.on("tick", handleTick);
    unsubscribeLoad = eventBus.on("loadGame", syncEconomy);
    unsubscribeSpeed = eventBus.on("speed:changed", handleSpeedChanged);

    // Начальная синхронизация, чтобы UI не ждал первого тика.
    syncEconomy();
}

export function disposeStoreBridge(): void {
    unsubscribeTick?.();
    unsubscribeLoad?.();
    unsubscribeSpeed?.();
    unsubscribeTick = null;
    unsubscribeLoad = null;
    unsubscribeSpeed = null;
}
