import Decimal from "break_infinity.js";
import type { Saveable } from "../../GameSave/Isaveable";
import type { ResourceManager } from "../ResourceSystem/ResourceManager";
import type {
    DefeatReason,
    FoodPolicy,
    PopulationSnapshot,
    PopulationWarning
} from "@/shared/types/Economy";

// Типы снимка живут в shared, потому что их использует и логика, и store.
// Реэкспорт сохраняет публичный контракт модуля PopulationSystem.
export type {
    DefeatReason,
    FoodPolicy,
    PopulationSnapshot,
    PopulationWarning
} from "@/shared/types/Economy";

export interface Population {
    "id": string,
    "name": string,
    "icon": string,
    "description": string,
    "count": string,
    "housingRequired": string,
    "consumes": Record<string, string>,
    "growth": GrowthData,
    "mortality": MortalityData,
    "rebellion": RebellionData,
    "open": boolean,
    "era": string
}

interface GrowthData {
    "baseRate": string,
    "foodBonus": string,
    "housingBonus": string,
    "maxGrowthRate": string
}

interface MortalityData {
    "baseRate": string,
    "foodPenalty": string,
    "waterPenalty": string,
    "housingPenalty": string,
    "maxMortalityRate": string
}

interface RebellionData {
    "threshold": string,
    "civilWarThreshold": string,
    "foodPenalty": string,
    "housingPenalty": string,
    "waterPenalty": string,
    "reliefRate": string,
    "strikeWorkerFactor": string,
    "civilWarChance": string,
    "civilWarLoss": string,
    "civilWarCooldown": string
}

/**
 * Накопительное состояние населения для сейва.
 * Коэффициенты роста, смертности и бунта — контент, поэтому в сейв не входят.
 */
export interface SavedPopulationState {
    count: string;
    currentRebellion: string;
    civilWarCooldown: string;
    foodPolicy: FoodPolicy;
    /**
     * Поражение от гражданской войны не выводится из количества населения,
     * поэтому фиксируется в сейве.
     */
    defeatReason?: DefeatReason;
}

export interface PopulationSystemOptions {
    /** Детерминированный RNG для тестов; возвращает [0, 1). */
    random?: () => number;
    /**
     * Вместимость жилья из зданий. Нужна, чтобы пересчитать производные
     * значения после загрузки сейва без изменения ресурсов.
     */
    housingCapacityProvider?: () => Decimal;
    /** Суммарная потребность зданий в рабочих. */
    workerDemandProvider?: () => Decimal;
}

/** Политика питания: экономия 50%, норма 100%, вдоволь 150% еды. */
const FOOD_POLICY_FACTORS: Record<FoodPolicy, Decimal> = {
    economy: new Decimal(0.5),
    normal: new Decimal(1),
    abundant: new Decimal(1.5)
};

/** Порог полной забастовки из дизайна v1 (docs/game-design_v1.md §8.6). */
const FULL_STRIKE_THRESHOLD = new Decimal(0.6);
/** Доля доступных рабочих при полной забастовке. */
const FULL_STRIKE_WORKER_FACTOR = new Decimal(0.5);

interface PopulationState {
    data: Population;
    /** Накопительное состояние. */
    count: Decimal;
    currentRebellion: Decimal;
    civilWarCooldown: Decimal;
    foodPolicy: FoodPolicy;
    defeatReason: DefeatReason;
    /** Производные значения последнего хода. */
    foodCoverage: Decimal;
    waterCoverage: Decimal;
    housingCoverage: Decimal;
    satisfaction: Decimal;
    currentGrowth: Decimal;
    currentMortality: Decimal;
    housingCapacity: Decimal;
    workerDemand: Decimal;
    warnings: PopulationWarning[];
}

interface CoverageEvaluation {
    required: Record<string, Decimal>;
    foodCoverage: Decimal;
    waterCoverage: Decimal;
    housingCoverage: Decimal;
    satisfaction: Decimal;
    housingRequiredTotal: Decimal;
    /** Вместимость жилья, переданная в текущий ход. */
    housingCapacity: Decimal;
}

/**
 * Население: потребление, жильё, рост/смертность, бунт и гражданская война.
 * Фаза выполняется до производства зданий (docs/game-design_v1.md §4.2).
 */
export class PopulationSystem implements Saveable {
    private states: Record<string, PopulationState> = {};
    private resourceManager: ResourceManager;
    private random: () => number;
    private housingCapacityProvider?: () => Decimal;
    private workerDemandProvider?: () => Decimal;

    constructor(
        populationData: Population[],
        resourceManager: ResourceManager,
        options: PopulationSystemOptions = {}
    ) {
        this.resourceManager = resourceManager;
        this.random = options.random ?? Math.random;
        this.housingCapacityProvider = options.housingCapacityProvider;
        this.workerDemandProvider = options.workerDemandProvider;

        const housingCapacity = this.getProvidedHousingCapacity();
        const workerDemand = this.getProvidedWorkerDemand();

        for (const data of populationData ?? []) {
            const count = new Decimal(data.count);
            const state: PopulationState = {
                data,
                count,
                currentRebellion: new Decimal(0),
                civilWarCooldown: new Decimal(0),
                foodPolicy: "normal",
                defeatReason: count.lte(0) ? "extinction" : null,
                foodCoverage: new Decimal(1),
                waterCoverage: new Decimal(1),
                housingCoverage: new Decimal(1),
                satisfaction: new Decimal(1),
                currentGrowth: new Decimal(0),
                currentMortality: new Decimal(0),
                housingCapacity,
                workerDemand,
                warnings: []
            };
            this.states[data.id] = state;
            this.recomputeDerived(state, housingCapacity, workerDemand);
        }
    }

    /**
     * Фаза населения. Выполняется до фазы зданий.
     * @param housingCapacity Суммарная вместимость жилья из BuildingManager.
     * @param workerDemand Суммарная потребность зданий в рабочих.
     */
    public tick(
        housingCapacity: Decimal,
        workerDemand: Decimal = new Decimal(0)
    ): void {
        for (const state of Object.values(this.states)) {
            if (state.defeatReason !== null) {
                state.housingCapacity = housingCapacity;
                state.workerDemand = workerDemand;
                continue;
            }

            if (state.count.lte(0)) {
                state.count = new Decimal(0);
                state.defeatReason = "extinction";
                state.housingCapacity = housingCapacity;
                state.workerDemand = workerDemand;
                this.recomputeDerived(state, housingCapacity, workerDemand);
                continue;
            }

            this.runPopulationTurn(state, housingCapacity, workerDemand);
        }
    }

    /** Политика питания: экономия 50%, норма 100%, вдоволь 150% еды. */
    public setFoodPolicy(policy: FoodPolicy): void {
        if (!this.isFoodPolicy(policy)) {
            return;
        }
        for (const state of Object.values(this.states)) {
            state.foodPolicy = policy;
        }
    }

    /** Доступные рабочие после забастовки: population × workerAvailability. */
    public getAvailableWorkers(): Decimal {
        let total = new Decimal(0);
        for (const state of Object.values(this.states)) {
            total = total.plus(this.getAvailableWorkersFor(state));
        }
        return total;
    }

    public isDefeated(): boolean {
        return this.getDefeatReason() !== null;
    }

    public getDefeatReason(): DefeatReason {
        for (const state of Object.values(this.states)) {
            if (state.defeatReason !== null) {
                return state.defeatReason;
            }
        }
        return null;
    }

    public serializeForStore(): { population: Record<string, PopulationSnapshot> } {
        const population: Record<string, PopulationSnapshot> = {};

        for (const [id, state] of Object.entries(this.states)) {
            const available = this.getAvailableWorkersFor(state);
            const employed = Decimal.min(available, state.workerDemand);
            const unemployed = Decimal.max(
                available.minus(employed),
                new Decimal(0)
            );

            population[id] = {
                id: state.data.id,
                name: state.data.name,
                icon: state.data.icon,
                count: state.count.toFixed(2),
                housingRequired: state.count
                    .times(new Decimal(state.data.housingRequired))
                    .toFixed(2),
                housingCapacity: state.housingCapacity.toFixed(2),
                foodPolicy: state.foodPolicy,
                foodCoverage: state.foodCoverage.toFixed(6),
                waterCoverage: state.waterCoverage.toFixed(6),
                housingCoverage: state.housingCoverage.toFixed(6),
                satisfaction: state.satisfaction.toFixed(6),
                currentGrowth: state.currentGrowth.toFixed(6),
                currentMortality: state.currentMortality.toFixed(6),
                currentRebellion: state.currentRebellion.toFixed(6),
                availableWorkers: available.toFixed(2),
                employedWorkers: employed.toFixed(2),
                unemployedWorkers: unemployed.toFixed(2),
                civilWarCooldown: state.civilWarCooldown.toFixed(0),
                isDefeated: state.defeatReason !== null,
                defeatReason: state.defeatReason,
                warnings: [...state.warnings]
            };
        }

        return { population };
    }

    public serializeForSave(): {
        population: Record<string, SavedPopulationState>;
    } {
        const population: Record<string, SavedPopulationState> = {};

        for (const [id, state] of Object.entries(this.states)) {
            population[id] = {
                count: state.count.toString(),
                currentRebellion: state.currentRebellion.toString(),
                civilWarCooldown: state.civilWarCooldown.toString(),
                foodPolicy: state.foodPolicy,
                defeatReason: state.defeatReason
            };
        }

        return { population };
    }

    public deserializeForSave(data: Record<string, unknown>): void {
        const populationData = data?.population as
            | Record<string, unknown>
            | undefined;
        if (!populationData) {
            return;
        }

        const housingCapacity = this.getProvidedHousingCapacity();
        const workerDemand = this.getProvidedWorkerDemand();

        for (const [id, state] of Object.entries(this.states)) {
            const saved = populationData[id] as
                | Record<string, unknown>
                | undefined;
            if (!saved) {
                continue;
            }

            state.count = this.readDecimal(saved.count, state.data.count);
            state.currentRebellion = this.clamp01(
                this.readDecimal(saved.currentRebellion, "0")
            );
            state.civilWarCooldown = Decimal.max(
                this.readDecimal(saved.civilWarCooldown, "0"),
                new Decimal(0)
            );
            state.foodPolicy = this.isFoodPolicy(saved.foodPolicy)
                ? saved.foodPolicy
                : "normal";
            state.defeatReason = this.readDefeatReason(saved.defeatReason, state.count);

            this.recomputeDerived(state, housingCapacity, workerDemand);
        }
    }

    // ─── Ход населения ───────────────────────────────────────────────────────

    private runPopulationTurn(
        state: PopulationState,
        housingCapacity: Decimal,
        workerDemand: Decimal
    ): void {
        const evaluation = this.evaluate(state, housingCapacity);

        // Покрытия независимы: нехватка еды не уменьшает потребление воды.
        const actualConsumes: Record<string, Decimal> = {};
        for (const [resourceId, required] of Object.entries(evaluation.required)) {
            const available = this.getResourceCount(resourceId);
            const actual = Decimal.min(required, available);
            if (actual.gt(0)) {
                actualConsumes[resourceId] = actual;
            }
        }
        if (Object.keys(actualConsumes).length > 0) {
            this.resourceManager.reduceResources(actualConsumes);
        }

        const growthRate = this.computeGrowthRate(state, evaluation);
        const mortalityRate = this.computeMortalityRate(state, evaluation);

        const growthFactor = new Decimal(1).plus(growthRate);
        const mortalityFactor = new Decimal(1).minus(mortalityRate);
        state.count = Decimal.max(
            state.count.times(growthFactor).times(mortalityFactor),
            new Decimal(0)
        );

        this.updateRebellion(state, evaluation);

        if (state.count.gt(0)) {
            this.applyCivilWar(state);
        }

        if (state.count.lte(0)) {
            state.count = new Decimal(0);
            if (state.defeatReason === null) {
                state.defeatReason = "extinction";
            }
        }

        state.foodCoverage = evaluation.foodCoverage;
        state.waterCoverage = evaluation.waterCoverage;
        state.housingCoverage = evaluation.housingCoverage;
        state.satisfaction = evaluation.satisfaction;
        state.currentGrowth = growthRate;
        state.currentMortality = mortalityRate;
        state.housingCapacity = housingCapacity;
        state.workerDemand = workerDemand;
        state.warnings = this.computeWarnings(state);
    }

    private evaluate(
        state: PopulationState,
        housingCapacity: Decimal
    ): CoverageEvaluation {
        const required = this.getRequiredConsumption(state);
        const foodCoverage = this.getCoverage(
            "Food",
            required.Food ?? new Decimal(0)
        );
        const waterCoverage = this.getCoverage(
            "Water",
            required.Water ?? new Decimal(0)
        );

        const housingRequiredTotal = state.count.times(
            new Decimal(state.data.housingRequired)
        );
        const housingCoverage = housingRequiredTotal.gt(0)
            ? Decimal.min(
                  new Decimal(1),
                  housingCapacity.div(housingRequiredTotal)
              )
            : new Decimal(1);

        const satisfaction = Decimal.min(
            foodCoverage,
            Decimal.min(waterCoverage, housingCoverage)
        );

        return {
            required,
            foodCoverage,
            waterCoverage,
            housingCoverage,
            satisfaction,
            housingRequiredTotal,
            housingCapacity
        };
    }

    private recomputeDerived(
        state: PopulationState,
        housingCapacity: Decimal,
        workerDemand: Decimal
    ): void {
        const evaluation = this.evaluate(state, housingCapacity);

        state.foodCoverage = evaluation.foodCoverage;
        state.waterCoverage = evaluation.waterCoverage;
        state.housingCoverage = evaluation.housingCoverage;
        state.satisfaction = evaluation.satisfaction;
        state.currentGrowth = this.computeGrowthRate(state, evaluation);
        state.currentMortality = this.computeMortalityRate(state, evaluation);
        state.housingCapacity = housingCapacity;
        state.workerDemand = workerDemand;
        state.warnings = this.computeWarnings(state);
    }

    private getRequiredConsumption(
        state: PopulationState
    ): Record<string, Decimal> {
        const required: Record<string, Decimal> = {};

        for (const [resourceId, rate] of Object.entries(state.data.consumes)) {
            let amount = state.count.times(new Decimal(rate));
            if (resourceId === "Food") {
                amount = amount.times(FOOD_POLICY_FACTORS[state.foodPolicy]);
            }
            required[resourceId] = amount;
        }

        return required;
    }

    private getCoverage(resourceId: string, required: Decimal): Decimal {
        if (required.lte(0)) {
            return new Decimal(1);
        }
        const available = this.getResourceCount(resourceId);
        return Decimal.min(new Decimal(1), available.div(required));
    }

    private computeGrowthRate(
        state: PopulationState,
        evaluation: CoverageEvaluation
    ): Decimal {
        if (state.count.lte(0)) {
            return new Decimal(0);
        }
        // Рост возможен только при полном покрытии еды и воды и свободном жилье.
        if (evaluation.foodCoverage.lt(1) || evaluation.waterCoverage.lt(1)) {
            return new Decimal(0);
        }
        if (evaluation.housingCoverage.lt(1)) {
            return new Decimal(0);
        }
        if (
            evaluation.housingCapacity.lte(evaluation.housingRequiredTotal)
        ) {
            return new Decimal(0);
        }

        const growth = state.data.growth;
        const rate = new Decimal(growth.baseRate)
            .plus(new Decimal(growth.foodBonus).times(evaluation.foodCoverage))
            .plus(
                new Decimal(growth.housingBonus).times(
                    evaluation.housingCoverage
                )
            );

        return Decimal.min(new Decimal(growth.maxGrowthRate), rate);
    }

    private computeMortalityRate(
        state: PopulationState,
        evaluation: CoverageEvaluation
    ): Decimal {
        if (state.count.lte(0)) {
            return new Decimal(0);
        }

        const mortality = state.data.mortality;
        const one = new Decimal(1);
        const rate = new Decimal(mortality.baseRate)
            .plus(
                new Decimal(mortality.foodPenalty).times(
                    one.minus(evaluation.foodCoverage)
                )
            )
            .plus(
                new Decimal(mortality.waterPenalty).times(
                    one.minus(evaluation.waterCoverage)
                )
            )
            .plus(
                new Decimal(mortality.housingPenalty).times(
                    one.minus(evaluation.housingCoverage)
                )
            );

        return Decimal.min(new Decimal(mortality.maxMortalityRate), rate);
    }

    private updateRebellion(
        state: PopulationState,
        evaluation: CoverageEvaluation
    ): void {
        const rebellion = state.data.rebellion;
        const one = new Decimal(1);
        const pressure = new Decimal(rebellion.foodPenalty)
            .times(one.minus(evaluation.foodCoverage))
            .plus(
                new Decimal(rebellion.waterPenalty).times(
                    one.minus(evaluation.waterCoverage)
                )
            )
            .plus(
                new Decimal(rebellion.housingPenalty).times(
                    one.minus(evaluation.housingCoverage)
                )
            );
        const relief = new Decimal(rebellion.reliefRate).times(
            evaluation.satisfaction
        );

        state.currentRebellion = this.clamp01(
            state.currentRebellion.plus(pressure).minus(relief)
        );
    }

    private applyCivilWar(state: PopulationState): void {
        if (state.civilWarCooldown.gt(0)) {
            state.civilWarCooldown = state.civilWarCooldown.minus(1);
            return;
        }

        const rebellion = state.data.rebellion;
        if (
            state.currentRebellion.lt(
                new Decimal(rebellion.civilWarThreshold)
            )
        ) {
            return;
        }

        const chance = new Decimal(rebellion.civilWarChance);
        if (new Decimal(this.random()).lt(chance)) {
            state.defeatReason = "civilWar";
            return;
        }

        const loss = new Decimal(rebellion.civilWarLoss);
        state.count = state.count.times(new Decimal(1).minus(loss));
        state.civilWarCooldown = new Decimal(rebellion.civilWarCooldown);
    }

    private computeWarnings(state: PopulationState): PopulationWarning[] {
        const warnings: PopulationWarning[] = [];

        if (state.foodCoverage.lt(1)) {
            warnings.push("hunger");
        }
        if (state.waterCoverage.lt(1)) {
            warnings.push("waterShortage");
        }

        const threshold = new Decimal(state.data.rebellion.threshold);
        const civilWarThreshold = new Decimal(
            state.data.rebellion.civilWarThreshold
        );

        if (
            state.currentRebellion.gt(0) &&
            state.currentRebellion.lt(threshold)
        ) {
            warnings.push("rebellion");
        }
        if (state.currentRebellion.gte(threshold)) {
            warnings.push("strike");
        }
        if (state.currentRebellion.gte(civilWarThreshold)) {
            warnings.push("civilWar");
        }

        return warnings;
    }

    // ─── Рабочие ─────────────────────────────────────────────────────────────

    private getAvailableWorkersFor(state: PopulationState): Decimal {
        return state.count.times(this.getWorkerAvailability(state));
    }

    /**
     * Порог забастовки — контентный, верхняя граница 0.6 — правило дизайна v1.
     * Гражданская война начинается по `civilWarThreshold` отдельно, поэтому
     * контент может отключить событие, не меняя шкалу забастовки.
     */
    private getWorkerAvailability(state: PopulationState): Decimal {
        const threshold = new Decimal(state.data.rebellion.threshold);
        const rebellion = state.currentRebellion;

        if (rebellion.lt(threshold)) {
            return new Decimal(1);
        }
        if (rebellion.gte(FULL_STRIKE_THRESHOLD)) {
            return FULL_STRIKE_WORKER_FACTOR;
        }

        const span = FULL_STRIKE_THRESHOLD.minus(threshold);
        if (span.lte(0)) {
            return FULL_STRIKE_WORKER_FACTOR;
        }

        const factor = new Decimal(state.data.rebellion.strikeWorkerFactor);
        const progress = rebellion.minus(threshold).div(span);

        return factor.minus(
            factor.minus(FULL_STRIKE_WORKER_FACTOR).times(progress)
        );
    }

    // ─── Вспомогательное ─────────────────────────────────────────────────────

    private getProvidedHousingCapacity(): Decimal {
        return this.housingCapacityProvider
            ? this.housingCapacityProvider()
            : new Decimal(0);
    }

    private getProvidedWorkerDemand(): Decimal {
        return this.workerDemandProvider
            ? this.workerDemandProvider()
            : new Decimal(0);
    }

    private getResourceCount(resourceId: string): Decimal {
        return this.resourceManager.getResourceCount(resourceId) ?? new Decimal(0);
    }

    private clamp01(value: Decimal): Decimal {
        return Decimal.max(
            Decimal.min(value, new Decimal(1)),
            new Decimal(0)
        );
    }

    private readDecimal(value: unknown, fallback: string): Decimal {
        if (typeof value === "string" || typeof value === "number") {
            return new Decimal(value);
        }
        return new Decimal(fallback);
    }

    private readDefeatReason(
        value: unknown,
        count: Decimal
    ): DefeatReason {
        if (count.lte(0)) {
            return "extinction";
        }
        if (value === "civilWar" || value === "extinction") {
            return value;
        }
        return null;
    }

    private isFoodPolicy(value: unknown): value is FoodPolicy {
        return value === "economy" || value === "normal" || value === "abundant";
    }
}
