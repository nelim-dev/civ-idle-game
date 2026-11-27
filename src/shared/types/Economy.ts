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

/** Политика питания влияет только на расход еды (docs/game-design_v1.md §8.2). */
export type FoodPolicy = "economy" | "normal" | "abundant";

/** Причина поражения; null — игра продолжается. */
export type DefeatReason = "extinction" | "civilWar" | null;

/** Предупреждения панели населения (docs/game-design_v1.md §13.2). */
export type PopulationWarning =
    | "hunger"
    | "waterShortage"
    | "rebellion"
    | "strike"
    | "civilWar";

/**
 * Снимок одного типа населения для UI.
 * Числовые поля — форматированные строки, точность для расчётов не нужна.
 */
export interface PopulationSnapshot {
    id: string;
    name: string;
    icon: string;
    count: string;
    housingRequired: string;
    housingCapacity: string;
    foodPolicy: FoodPolicy;
    foodCoverage: string;
    waterCoverage: string;
    housingCoverage: string;
    satisfaction: string;
    currentGrowth: string;
    currentMortality: string;
    currentRebellion: string;
    availableWorkers: string;
    employedWorkers: string;
    unemployedWorkers: string;
    civilWarCooldown: string;
    isDefeated: boolean;
    defeatReason: DefeatReason;
    warnings: PopulationWarning[];
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
    /** Снимок населения по типам. */
    population?: Record<string, PopulationSnapshot>;
    /** Агрегированные предупреждения населения для верхней панели. */
    warnings?: PopulationWarning[];
}
