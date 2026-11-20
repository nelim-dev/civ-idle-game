import { gameManager } from "@/logic/GameManager";
import { useGameStore } from "@/store/gameStore";

let unsubscribeTick: (() => void) | null = null;
let unsubscribeLoad: (() => void) | null = null;

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

    const eventBus = gameManager.getEventBus();
    unsubscribeTick = eventBus.on("tick", syncEconomy);
    unsubscribeLoad = eventBus.on("loadGame", syncEconomy);

    // Начальная синхронизация, чтобы UI не ждал первого тика.
    syncEconomy();
}

export function disposeStoreBridge(): void {
    unsubscribeTick?.();
    unsubscribeLoad?.();
    unsubscribeTick = null;
    unsubscribeLoad = null;
}
