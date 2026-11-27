import type { ResourceData } from "@/shared/types/Resource";

/**
 * Запись истории баланса для UI.
 * Числа отформатированы для отображения, точность здесь не важна.
 */
export interface BalanceHistoryEntry {
    count: string;
    income: string;
    expense: string;
}

/**
 * Снимок экономики для store/UI.
 * Формируется чистой serialize() в EconomySystem, без записи в store.
 */
export interface EconomySnapshot {
    resources: Record<string, ResourceData>;
    balanceHistory: Record<string, BalanceHistoryEntry[]>;
    balanceHistoryLength: number;
    /**
     * Снимок зданий для UI. Формат строк — как у serializeForStore,
     * поэтому store не работает с Decimal напрямую.
     */
    buildings?: Record<string, Record<string, unknown>>;
    /** Очередь строительства в снимке для UI. */
    constructionProjects?: Array<Record<string, string>>;
}
