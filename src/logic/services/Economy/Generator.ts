

export interface GeneratorData{
id: string;
name: string;
income: number;
baseIncome: number;
cost: number;
costMultiplier: number;
owned: number; 
}


export class Generator{

id: string;
name: string;
baseIncome: number;
cost: number;
costMultiplier: number;
owned: number;


constructor(data: GeneratorData){
    this.id = data.id;
    this.name = data.name;
    this.baseIncome = data.baseIncome;
    this.cost = data.cost;
    this.costMultiplier = data.costMultiplier;
    this.owned = 0;

}

public getOwned() {
    return this.owned;
}

public getCost(){
 return this.cost;
}

public getBaseIncome(){
    return this.baseIncome;
}

public getIncome(){
    return this.owned*this.baseIncome;
}

public build(){
this.owned += 1;
 this.cost = this.cost*this.costMultiplier;
}

}