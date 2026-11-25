import Decimal from "break_infinity.js"
import { Saveable } from "../../GameSave/Isaveable"

export interface BuildingData {
    id: string,
    name: string,
    description: string,
    icon: string,
    category: string,
    era?: string,
    extraction?: boolean,
    produces: Record<string, string>,
    consumes: Record<string, string>,
    workersRequired: string,
    hp: string,
    maxHp: string,
    decayPerTurn: string,
    cost: Record<string, string>,
    priority: string,
    power: string,
    level: string,
    maxLevel: string,
    open: boolean,
    storageBonus: Record<string, string>,
    housingCapacity: string,
    owned: string
}

export interface Building {
    id: string,
    name: string,
    description: string,
    icon: string,
    category: string,
    era: Decimal,
    extraction: boolean,
    produces: Record<string, Decimal>,
    consumes: Record<string, Decimal>,
    workersRequired: Decimal,
    hp: Decimal,
    maxHp: Decimal,
    hpSum: Decimal,
    maxHpSum: Decimal,
    decayLevel: Decimal,
    decayPerTurn: Decimal,
    cost: Record<string, Decimal>,
    priority: Decimal,
    efficiency: Decimal,
    power: Decimal,
    level: Decimal,
    maxLevel: Decimal,
    open: boolean,
    storageBonus: Record<string, Decimal>,
    housingCapacity: Decimal,
    owned: Decimal
}

export class Building implements Building, Saveable {
    id: string;
    name: string;
    description: string;
    icon: string;
    category: string;
    era: Decimal;
    extraction: boolean;
    produces: Record<string, Decimal>;
    consumes: Record<string, Decimal>;
    workersRequired: Decimal;
    hp: Decimal;
    maxHp: Decimal;
    hpSum: Decimal;
    maxHpSum: Decimal;
    decayLevel: Decimal;
    decayPerTurn: Decimal;
    cost: Record<string, Decimal>;
    priority: Decimal;
    efficiency: Decimal;
    power: Decimal;
    level: Decimal;
    maxLevel: Decimal;
    open: boolean;
    storageBonus: Record<string, Decimal>;
    housingCapacity: Decimal;
    owned: Decimal;

    constructor(data: BuildingData) {
        this.id = data.id;
        this.name = data.name;
        this.description = data.description;
        this.icon = data.icon;
        this.category = data.category;
        this.era = new Decimal(data.era ?? "1");
        this.extraction = data.extraction ?? false;
        this.produces = Object.fromEntries(Object.entries(data.produces).map(([key, value]) => ([key, new Decimal(value)])));
        this.consumes = Object.fromEntries(Object.entries(data.consumes).map(([key, value]) => ([key, new Decimal(value)])));
        this.workersRequired = new Decimal(data.workersRequired);
        this.hp = new Decimal(data.hp);
        this.maxHp = new Decimal(data.maxHp);
        this.decayPerTurn = new Decimal(data.decayPerTurn);
        this.cost = Object.fromEntries(Object.entries(data.cost).map(([key, value]) => ([key, new Decimal(value)])));
        this.priority = new Decimal(data.priority);
        this.power = new Decimal(data.power);
        this.level = new Decimal(data.level);
        this.maxLevel = new Decimal(data.maxLevel);
        this.open = data.open;
        this.storageBonus = Object.fromEntries(Object.entries(data.storageBonus).map(([key, value]) => ([key, new Decimal(value)])));
        this.housingCapacity = new Decimal(data.housingCapacity);
        this.owned = new Decimal(data.owned);

        // hpSum, maxHpSum, decayLevel и efficiency — производные значения
        // состояния. В контенте их нет, поэтому стартовые значения считаются здесь.
        this.maxHpSum = this.maxHp.times(this.owned);
        this.hpSum = this.maxHpSum;
        this.decayLevel = new Decimal(0);
        this.efficiency = new Decimal(1);
    }

    public getId(): string {
        return this.id;
    }

    public getName(): string {
        return this.name;
    }

    public getDescription(): string {
        return this.description;
    }

    public getIcon(): string {
        return this.icon;
    }

    public getCategory(): string {
        return this.category;
    }

    public getProduces(): Record<string, Decimal> {
        return this.produces;
    }

    public getTotalProduce(): Record<string, Decimal> {
        return Object.fromEntries(Object.entries(this.produces).map(([key, value]) => ([key, value.times(this.owned)])))
    }

    public getConsumes(): Record<string, Decimal> {
        return this.consumes;
    }

    public getTotalConsumes() {
        return Object.fromEntries(Object.entries(this.consumes).map(([key, value]) => ([key, value.times(this.owned)])))
    }

    public getWorkersRequired(): Decimal {
        return this.workersRequired;
    }

    public getHp(): Decimal {
        return this.hp;
    }

    public getMaxHp(): Decimal {
        return this.maxHp;
    }

    public getHpSum(): Decimal {
        return this.hpSum;
    }

    public getMaxHpSum(): Decimal {
        return this.maxHpSum;
    }

    // ─── Константы распределения урона ───────────────────────────────────────
    // Каждый уровень: [доля зданий, доля общего урона]
    // Последний уровень получает остаток автоматически.
    private static readonly DAMAGE_TIERS: { buildingFraction: number; damageFraction: number }[] = [
        { buildingFraction: 0.001, damageFraction: 0.02 },   // 0.1% зданий ← 2% урона
        { buildingFraction: 0.009, damageFraction: 0.05 },   // 0.9% зданий ← 5% урона
        { buildingFraction: 0.09, damageFraction: 0.08 },   // 9%   зданий ← 8% урона
        // остальные 90% зданий ← 85% урона (неявно)
    ];
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Лечение зданий: добавляет к hpSum, пересчитывает среднее hp.
     * @param healAmount Сколько HP добавить в общий пул.
     * @returns true если лечение применено.
     */
    public addBuildHp(healAmount: Decimal): boolean {
        if (healAmount.lte(0) || this.owned.lte(0)) return false;

        // Не можем вылечить больше максимума
        const newHpSum = Decimal.min(this.hpSum.plus(healAmount), this.maxHpSum);
        this.hpSum = newHpSum;
        this.hp = this.hpSum.div(this.owned);
        return true;
    }

    /**
     * Нанесение урона зданиям: вычитает из hpSum, пересчитывает среднее hp.
     * @param damageAmount Сколько HP вычесть из общего пула.
     * @returns true если урон применён.
     */
    public reduceBuildHp(damageAmount: Decimal): boolean {
        if (damageAmount.lte(0) || this.owned.lte(0)) return false;

        // Не можем уйти ниже 0
        const newHpSum = Decimal.max(this.hpSum.minus(damageAmount), new Decimal(0));
        this.hpSum = newHpSum;
        this.hp = this.hpSum.div(this.owned);
        return true;
    }

    /**
     * Распределённый урон: небольшая часть зданий получает непропорционально
     * большую долю урона. Это вызывает разрушения даже при скромном общем уроне.
     *
     * Распределение (настраивается через DAMAGE_TIERS):
     *   Уровень 0: 0.1% зданий получают 2%  урона
     *   Уровень 1: 0.9% зданий получают 5%  урона
     *   Уровень 2: 9%   зданий получают 8%  урона
     *   Уровень 3: 90%  зданий получают 85% урона (остаток)
     *
     * Урон каждого уровня концентрируется на минимальном количестве зданий
     * (исходя из их индивидуального maxHp), поэтому здания из ранних уровней
     * чаще полностью уничтожаются.
     *
     * @param totalDamage Общий урон для распределения.
     * @returns Количество полностью уничтоженных зданий (hp достигло 0).
     */
    public damageBuild(totalDamage: Decimal): Decimal {
        if (totalDamage.lte(0) || this.owned.lte(0) || this.hpSum.lte(0)) return new Decimal(0);

        const maxHpPerBuilding = this.maxHp;
        let remainingDamage = Decimal.min(totalDamage, this.hpSum);
        let destroyedCount = new Decimal(0);

        // Работаем с копией hpSum, в конце присвоим финальные значения.
        let currentHpSum = this.hpSum;

        for (let tierIndex = 0; tierIndex < Building.DAMAGE_TIERS.length; tierIndex++) {
            const tier = Building.DAMAGE_TIERS[tierIndex];
            const buildingsInTier = Decimal.max(1, this.owned.times(tier.buildingFraction).floor());
            const damageForTier = totalDamage.times(tier.damageFraction);

            if (damageForTier.lte(0)) continue;

            // Урон уровня не может превысить суммарный maxHp зданий в этом уровне
            const maxPossibleInTier = maxHpPerBuilding.times(buildingsInTier);
            const actualDamageInTier = Decimal.min(damageForTier, maxPossibleInTier);

            // Вычитаем из пула
            currentHpSum = Decimal.max(currentHpSum.minus(actualDamageInTier), new Decimal(0));
            remainingDamage = remainingDamage.minus(actualDamageInTier);

            // Считаем уничтоженные здания в уровне
            if (damageForTier.gte(maxPossibleInTier)) {
                destroyedCount = destroyedCount.plus(buildingsInTier);
            } else {
                const destroyedInTier = damageForTier.div(maxHpPerBuilding).floor();
                destroyedCount = destroyedCount.plus(Decimal.min(destroyedInTier, buildingsInTier));
            }

            if (currentHpSum.lte(0)) break;
        }

        // Остаток урона применяем к оставшимся зданиям (неявный уровень 90%)
        if (remainingDamage.gt(0) && currentHpSum.gt(0)) {
            const remainingBuildings = Decimal.max(0, this.owned.minus(destroyedCount));
            if (remainingBuildings.gt(0)) {
                const maxRemainingHp = maxHpPerBuilding.times(remainingBuildings);
                const actualRemainingDamage = Decimal.min(remainingDamage, maxRemainingHp);
                currentHpSum = Decimal.max(currentHpSum.minus(actualRemainingDamage), new Decimal(0));

                const destroyedInRemaining = remainingDamage.div(maxHpPerBuilding).floor();
                destroyedCount = destroyedCount.plus(Decimal.min(destroyedInRemaining, remainingBuildings));
            }
        }

        // Применяем финальные значения
        this.hpSum = currentHpSum;
        this.maxHpSum = this.maxHpSum.minus(destroyedCount.times(this.maxHp));
        this.owned = this.owned.minus(destroyedCount);
        this.hp = this.owned.gt(0) ? this.hpSum.div(this.owned) : new Decimal(0);

        return destroyedCount;
    }

    public getSumBuildMaxHp(): Decimal {
        return this.maxHp.times(this.owned);
    }

    public getDecayLevel(): Decimal {
        return this.decayLevel;
    }

    public getDecayPerTurn(): Decimal {
        return this.decayPerTurn;
    }

    public BuildingDecayTurn(): void {
        if (this.decayLevel.lt(100)) {
            const decayLevel = this.decayLevel.plus(this.decayPerTurn);
            if (decayLevel.gt(100)) {
                this.decayLevel = new Decimal(100);
            } else {
                this.decayLevel = decayLevel;
            }
        } else {
            this.decayLevel = new Decimal(100);
        }
    }

    public getCost() {
        return this.cost;
    }

    public setCost(cost: Record<string, Decimal>) {
        this.cost = cost;
    }

    public getPriority() {
        return this.priority;
    }

    public setPriority(newPriority: Decimal) {
        this.priority = newPriority;
    }

    public getEfficiency(): Decimal {
        return this.efficiency;
    }

    public setEfficiency(newEfficiency: Decimal) {
        if (newEfficiency.lt(0)) {
            this.efficiency = new Decimal(0);
        } else {
            this.efficiency = newEfficiency;
        }
    }

    public getPower(): Decimal {
        return this.power;
    }

    public setPower(newPower: Decimal) {
        if (newPower.lt(0)) {
            this.power = new Decimal(0);
            return;
        }
        if (newPower.gt(100)) {
            this.power = new Decimal(100);
            return;
        }
        this.power = newPower;
    }

    public getLevel(): Decimal {
        return this.level;
    }

    public setLevel(newLevel: Decimal) {
        if (newLevel.gt(0)) {
            if (newLevel.lte(this.maxLevel)) {
                this.level = newLevel;
            }
        }
    }

    public levelUp() {
        if (this.level.lt(this.maxLevel)) {
            this.level = this.level.plus(1);
        }
    }

    public getMaxLevel(): Decimal {
        return this.maxLevel;
    }

    public setMaxLevel(newMaxLevel: Decimal) {
        if (newMaxLevel.gt(0)) {
            this.maxLevel = newMaxLevel;
        }
    }

    public getOpen(): boolean {
        return this.open;
    }

    public setOpen(newOpen: boolean) {
        this.open = newOpen;
    }

    public getStorageBonus(): Record<string, Decimal> {
        return this.storageBonus;
    }

    public getTotalStorageBonus(): Record<string, Decimal> {
        return Object.fromEntries(Object.entries(this.storageBonus).map(([key, value]) => ([key, value.times(this.owned)])));
    }

    public setStorageBonus(newStorageBonus: Record<string, Decimal>) {
        this.storageBonus = newStorageBonus;
    }

    public getHousingCapacity(): Decimal {
        return this.housingCapacity;
    }

    public getTotalHousingCapacity(): Decimal {
        return this.housingCapacity.times(this.owned);
    }

    public setHousingCapacity(newHousingCapacity: Decimal) {
        if (newHousingCapacity.gt(0)) {
            this.housingCapacity = newHousingCapacity;
        }
    }

    public getOwned() {
        return this.owned;
    }

    public build(count: Decimal) {
        if (count.gt(0)) {
            this.hpSum = this.hpSum.plus(count.times(this.maxHp));
            this.maxHpSum = this.maxHpSum.plus(count.times(this.maxHp));
            this.decayLevel = this.decayLevel.times(this.owned).plus(count.times(0)).dividedBy(this.owned.plus(count));
            this.owned = this.owned.plus(count);
            this.hp = this.hpSum.div(this.owned);
        }
    }

    public destroy(count: Decimal): void {
        if (count.lte(0) || this.owned.lte(0)) return;
        const countToDestroy = Decimal.min(count, this.owned);

        // Если удаляем все здания
        if (countToDestroy.eq(this.owned)) {
            this.hpSum = new Decimal(0);
            this.maxHpSum = new Decimal(0);
            this.decayLevel = new Decimal(0);
            this.owned = new Decimal(0);
            this.hp = new Decimal(0);
            return;
        }

        // Вычисляем среднее HP на одно здание
        const avgHp = this.hpSum.div(this.owned);

        // Уменьшаем hpSum и maxHpSum пропорционально
        this.hpSum = this.hpSum.minus(countToDestroy.times(avgHp));
        this.maxHpSum = this.maxHpSum.minus(countToDestroy.times(this.maxHp));
        this.owned = this.owned.minus(countToDestroy);
        this.hp = this.hpSum.div(this.owned);
    }


    serializeForStore() {
        return {
            id: this.id,
            name: this.name,
            description: this.description,
            icon: this.icon,
            category: this.category,
            era: this.era.toFixed(0),
            extraction: this.extraction,
            produces: Object.fromEntries(Object.entries(this.produces).map(([key, value]) => ([key, value.toFixed(2)]))),
            consumes: Object.fromEntries(Object.entries(this.consumes).map(([key, value]) => ([key, value.toFixed(2)]))),
            workersRequired: this.workersRequired.toFixed(0),
            hp: this.hp.toFixed(0),
            maxHp: this.maxHp.toFixed(0),
            hpSum: this.hpSum.toFixed(0),
            maxHpSum: this.maxHpSum.toFixed(0),
            decayLevel: this.decayLevel.toFixed(2),
            decayPerTurn: this.decayPerTurn.toFixed(6),
            cost: Object.fromEntries(Object.entries(this.cost).map(([key, value]) => ([key, value.toFixed(0)]))),
            priority: this.priority.toFixed(0),
            efficiency: this.efficiency.toFixed(2),
            power: this.power.toFixed(0),
            level: this.level.toFixed(0),
            maxLevel: this.maxLevel.toFixed(0),
            open: this.open,
            storageBonus: Object.fromEntries(Object.entries(this.storageBonus).map(([key, value]) => ([key, value.toFixed(2)]))),
            housingCapacity: this.housingCapacity.toFixed(0),
            owned: this.owned.toFixed(0)
        }
    }
    serializeForSave(): Record<string, any> {
        return {
            id: this.id,
            name: this.name,
            description: this.description,
            icon: this.icon,
            category: this.category,
            era: this.era.toString(),
            extraction: this.extraction,
            produces: Object.fromEntries(Object.entries(this.produces).map(([key, value]) => ([key, value.toString()]))),
            consumes: Object.fromEntries(Object.entries(this.consumes).map(([key, value]) => ([key, value.toString()]))),
            workersRequired: this.workersRequired.toString(),
            hp: this.hp.toString(),
            maxHp: this.maxHp.toString(),
            hpSum: this.hpSum.toString(),
            maxHpSum: this.maxHpSum.toString(),
            decayLevel: this.decayLevel.toString(),
            decayPerTurn: this.decayPerTurn.toString(),
            cost: Object.fromEntries(Object.entries(this.cost).map(([key, value]) => ([key, value.toString()]))),
            priority: this.priority.toString(),
            efficiency: this.efficiency.toString(),
            power: this.power.toString(),
            level: this.level.toString(),
            maxLevel: this.maxLevel.toString(),
            open: this.open,
            storageBonus: Object.fromEntries(Object.entries(this.storageBonus).map(([key, value]) => ([key, value.toString()]))),
            housingCapacity: this.housingCapacity.toString(),
            owned: this.owned.toString()
        }
    }
    deserializeForSave(data: Record<string, any>): void {
        this.id = data.id;
        this.name = data.name;
        this.description = data.description;
        this.icon = data.icon;
        this.category = data.category;
        this.era = new Decimal(data.era ?? "1");
        this.extraction = data.extraction ?? false;
        this.produces = Object.fromEntries(Object.entries(data.produces).map(([key, value]) => ([key, new Decimal(value as string)])));
        this.consumes = Object.fromEntries(Object.entries(data.consumes).map(([key, value]) => ([key, new Decimal(value as string)])));
        this.workersRequired = new Decimal(data.workersRequired);
        this.hp = new Decimal(data.hp);
        this.maxHp = new Decimal(data.maxHp);
        this.hpSum = new Decimal(data.hpSum);
        this.maxHpSum = new Decimal(data.maxHpSum);
        this.decayLevel = new Decimal(data.decayLevel);
        this.decayPerTurn = new Decimal(data.decayPerTurn);
        this.cost = Object.fromEntries(Object.entries(data.cost).map(([key, value]) => ([key, new Decimal(value as string)])));
        this.priority = new Decimal(data.priority);
        this.efficiency = new Decimal(data.efficiency);
        this.power = new Decimal(data.power);
        this.level = new Decimal(data.level);
        this.maxLevel = new Decimal(data.maxLevel);
        this.open = data.open;
        this.storageBonus = Object.fromEntries(Object.entries(data.storageBonus).map(([key, value]) => ([key, new Decimal(value as string)])));
        this.housingCapacity = new Decimal(data.housingCapacity);
        this.owned = new Decimal(data.owned);
    }

}