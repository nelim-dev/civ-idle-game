import Decimal from "break_infinity.js"
import { ISaveable } from "../../GameSave/Isaveable"

export interface BuildingData {
    id: string,
    name: string,
    description: string,
    icon: string,
    category: string,
    produces: Record<string, string>,
    consumes: Record<string, string>,
    workersRequired: string,
    hp: string,
    maxHp: string,
    hpSum: string,
    maxHpSum: string,
    decayLevel: string,
    decayPerTurn: string,
    cost: Record<string, string>,
    priority: string,
    efficiency: string,
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

export class Building implements Building, ISaveable {
    id: string;
    name: string;
    description: string;
    icon: string;
    category: string;
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
        this.produces = Object.fromEntries(Object.entries(data.produces).map(([key, value]) => ([key, new Decimal(value)])));
        this.consumes = Object.fromEntries(Object.entries(data.consumes).map(([key, value]) => ([key, new Decimal(value)])));
        this.workersRequired = new Decimal(data.workersRequired);
        this.hp = new Decimal(data.hp);
        this.maxHp = new Decimal(data.maxHp);
        this.hpSum = new Decimal(data.hpSum);
        this.maxHpSum = new Decimal(data.maxHpSum);
        this.decayLevel = new Decimal(data.decayLevel);
        this.decayPerTurn = new Decimal(data.decayPerTurn);
        this.cost = Object.fromEntries(Object.entries(data.cost).map(([key, value]) => ([key, new Decimal(value)])));
        this.priority = new Decimal(data.priority);
        this.efficiency = new Decimal(data.efficiency);
        this.power = new Decimal(data.power);
        this.level = new Decimal(data.level);
        this.maxLevel = new Decimal(data.maxLevel);
        this.open = data.open;
        this.storageBonus = Object.fromEntries(Object.entries(data.storageBonus).map(([key, value]) => ([key, new Decimal(value)])));
        this.housingCapacity = new Decimal(data.housingCapacity);
        this.owned = new Decimal(data.owned);
    }

    public getId(): string{
        return this.id;
    }

    public getName(): string{
        return this.name;
    }

    public getDescription(): string
    {
        return this.description;
    }

    public getIcon(): string
    {
        return this.icon;
    }

    public getCategory(): string
    {
        return this.category;
    }

    public getProduces(): Record<string, Decimal>
    {
        return this.produces;
    }

    public getConsumes(): Record<string, Decimal>
    {
        return this.consumes;
    }

    public getWorkersRequired(): Decimal
    {
        return this.workersRequired;
    }

    public getHp(): Decimal
    {
        return this.hp;
    }

    public getMaxHp(): Decimal
    {
        return this.maxHp;
    }

    public getHpSum(): Decimal {
        return this.hpSum;
    }

    public getMaxHpSum(): Decimal {
        return this.maxHpSum;
    }

    public getSumBuildHp(): Decimal{
        return this.hp.times(this.owned);
    }

    /*public addBuildHp(count: Decimal): boolean {
        if (count.gt(0)) {
            this.hp = this.hp.plus(count);
            return true;
        }
        return false;
    }
    Переделать функцию.    
    */

    public removeBuildHp(count: Decimal): boolean {
        if (count.gt(0)) {
            this.hp = this.hp.minus(count);
            return true;
        }
        return false;
    }

    public getSumBuildMaxHp(): Decimal{
        return this.maxHp.times(this.owned);
    }

    public getDecayLevel(): Decimal{
        return this.decayLevel;
    }

    public getDecayPerTurn(): Decimal{
        return this.decayPerTurn;
    }

    public BuildingDecayTurn(): void{
        if(this.decayLevel.lt(100)){
            const decayLevel = this.decayLevel.plus(this.decayPerTurn);
            if(decayLevel.gt(100)){
                this.decayLevel = new Decimal(100);
            }else{
                this.decayLevel = decayLevel;
            }
        }else{
            this.decayLevel = new Decimal(100);
        }
    }

    public getCost(){
        
    }




    serializeForStore(){
                return {
            id: this.id,
            name: this.name,
            description: this.description,
            icon: this.icon,
            category: this.category,
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