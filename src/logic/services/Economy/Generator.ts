
import Decimal from 'break_infinity.js';
import { Saveable } from '../GameSave/Isaveable';
export interface GeneratorData {
id: string;
name: string;
income: string;
baseIncome: string;
cost: string;
costMultiplier: string;
owned: string; 
}


export class Generator implements Saveable{

id: string;
name: string;
income: Decimal;
baseIncome: Decimal;
cost: Decimal;
costMultiplier: Decimal;
owned: Decimal;


constructor(data: GeneratorData){
    this.id = data.id;
    this.name = data.name;
    this.income = new Decimal(data.income);
    this.baseIncome = new Decimal(data.baseIncome);
    this.cost = new Decimal(data.cost);
    this.costMultiplier = new Decimal(data.costMultiplier);
    this.owned = data.owned ? new Decimal(data.owned) : new Decimal(0);

}

public getOwned(): Decimal {
    return this.owned;
}

public getCost(): Decimal{
 return this.cost;
}

public getBaseIncome(): Decimal{
    return this.baseIncome;
}

public getIncome(): Decimal{
    return this.income;
}

public build(){
this.owned  = this.owned.plus(1);
this.cost = this.cost.times(this.costMultiplier);
this.calculateIncome();
}

private calculateIncome(){
    this.income = this.baseIncome.times(this.owned);
}

public getCostMultiplier(): Decimal{
    return this.costMultiplier;
}

public serializeForStore(): GeneratorData{
    return{
        id: this.id,
        name: this.name,
        income: this.income.toFixed(2).toString(),
        baseIncome: this.baseIncome.toFixed(2).toString(),
        cost: this.cost.toFixed(2).toString(),
        costMultiplier: this.costMultiplier.toString(),
        owned: this.owned.toFixed(0).toString(),
    }
}

public serializeForSave(): Record<string, any>{
        return{
        id: this.id,
        name: this.name,
        income: this.income.toString(),
        baseIncome: this.baseIncome.toString(),
        cost: this.cost.toString(),
        costMultiplier: this.costMultiplier.toString(),
        owned: this.owned.toString(),
    }
}

public deserializeForSave(data: Record<string, any>): void{
    this.id = data.id;
    this.name = data.name;
    this.income = new Decimal(data.income);
    this.baseIncome = new Decimal(data.baseIncome);
    this.cost = new Decimal(data.cost);
    this.costMultiplier = new Decimal(data.costMultiplier);
    this.owned = new Decimal(data.owned);
}

}