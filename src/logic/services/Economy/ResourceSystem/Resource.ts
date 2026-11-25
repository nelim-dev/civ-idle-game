import Decimal from "break_infinity.js"
import { Saveable } from "../../GameSave/Isaveable";
import type { ResourceData } from "@/shared/types/Resource";

export interface IResource {
    id: string,
    name: string,
    description: string,
    count: Decimal,
    storage: Decimal,
    icon: string,
    open: boolean,
    owner: string,
    renewable: boolean,
    renewRate: Decimal,
    spoilRate: Decimal
}


export class Resource implements IResource, Saveable {
    id: string;
    name: string;
    description: string;
    count: Decimal;
    storage: Decimal;
    icon: string;
    open: boolean;
    owner: string;
    renewable: boolean;
    renewRate: Decimal;
    spoilRate: Decimal;

    constructor(data: ResourceData) {
        this.id = data.id;
        this.name = data.name;
        this.description = data.description;
        this.count = new Decimal(data.count);
        this.storage = new Decimal(data.storage);
        this.icon = data.icon;
        this.open = data.open;
        this.owner = data.owner;
        this.renewable = data.renewable;
        this.renewRate = new Decimal(data.renewRate);
        // spoilRate необязателен в wire-формате: старые сейвы и фикстуры
        // получают документированное значение по умолчанию.
        this.spoilRate = new Decimal(data.spoilRate ?? "0.01");
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

    public addResource(count: Decimal): boolean {
        if (count.lt(0)) {
            return false;
        }
        this.count = this.count.plus(count);
        return true
    }

    public reduceResource(count: Decimal): boolean {//на входе положительное число, если итоговая сумма < 0 - оставляем 0.
        if (count.lt(0)) {
            return false;
        }
        const newCount = this.count.minus(count);
        if (newCount.lt(0)) {
            this.count = new Decimal(0);
            return true;
        }
        this.count = newCount;
        return true
    }

    public setResourceCount(count: Decimal): boolean{
        if(count.lt(0)){
            return false;
        }
        this.count = count;
        return true;
    }

    public pruneResource() {//всё что больше лимита складов обрезаем до лимита складов
        if (this.count.gt(this.storage)) {
            this.count = this.storage;
        }
    }

    public getSpoilRate(): Decimal {
        return this.spoilRate;
    }

    /**
     * Порча излишка сверх склада по формуле дизайна:
     * excess = max(0, count - storage); lost = excess × spoilRate;
     * count = count - lost.
     * @returns Сколько единиц ресурса потеряно за ход.
     */
    public spoilExcess(): Decimal {
        const excess = Decimal.max(this.count.minus(this.storage), new Decimal(0));
        if (excess.lte(0) || this.spoilRate.lte(0)) {
            return new Decimal(0);
        }
        const lost = excess.times(this.spoilRate);
        this.count = this.count.minus(lost);
        return lost;
    }

    public hasEnough(required: Decimal): boolean{
        if(this.count.gte(required)){
            return true
        }else{
            return false;
        }
    }

    public canAdd(count: Decimal): boolean{
        if(count.lt(0)){
            return false;
        }
        if(this.count.plus(count).lte(this.storage)){
            return true;
        }else{
            return false;
        }
    }

    public getResourceCount(): Decimal {
        return this.count;
    }

    public addStorage(count: Decimal): boolean {
        if (count.lt(0)) {
            return false;
        }
        this.storage = this.storage.plus(count);
        return true;
    }

    public reduceStorage(count: Decimal): boolean {//уменьшаем storage. Если новое значение < 0, то хранилище = 0
        if (count.lt(0)) {
            return false;
        }
        const newCount = this.storage.minus(count);
        if (newCount.lt(0)) {
            this.storage = new Decimal(0);
            return true;
        }
        this.storage = newCount;
        return true;
    }

    public setStorage(count: Decimal): boolean{
        if(count.lt(0)){
            return false;
        }
        this.storage = count;
        return true;
    }

    public canReduce(count: Decimal):boolean{
        if(count.lt(0)){
            return false;
        }
        if(this.count.minus(count).gte(new Decimal(0))){
            return true;
        }else{
            return false;
        }
    }
    public getStorage(): Decimal {
        return this.storage;
    }

    public isFull(): boolean{
        if(this.count.gte(this.storage)){
            return true;
        }else{
            return false;
        }
    }

    public isEmpty(): boolean{
        if(this.count.eq(0)){
            return true;
        }else{
            return false;
        }
    }

    public getAvailableSpace(): Decimal{
        return this.storage.minus(this.count);
    }

    public getIcon(): string {
        return this.icon;
    }
    public getOpenStatus(): boolean {
        return this.open;
    }

    public setOpenStatus(newStatus: boolean) {
        this.open = newStatus;
    }

    public getRenewable(): boolean {
        return this.renewable;
    }

    public getOwner(): string{
        return this.owner;
    }

    public setRenewable(newRenewable: boolean) {
        this.renewable = newRenewable;
    }

    public setRenewableRate(newRate: Decimal) {
        this.renewRate = newRate;
    }

    public getRenewableRate(): Decimal {
        return this.renewRate;
    }

    public serializeForStore() {
        return {
            id: this.id,
            name: this.name,
            description: this.description,
            count: this.count.toFixed(2),
            storage: this.storage.toFixed(2),
            icon: this.icon,
            open: this.open,
            owner: this.owner,
            renewable: this.renewable,
            renewRate: this.renewRate.toFixed(6),
            spoilRate: this.spoilRate.toFixed(6)
        }
    }

    public serializeForSave(): Record<string, any> {
        return {
            id: this.id,
            name: this.name,
            description: this.description,
            count: this.count.toString(),
            storage: this.storage.toString(),
            icon: this.icon,
            open: this.open,
            owner: this.owner,
            renewable: this.renewable,
            renewRate: this.renewRate.toString(),
            spoilRate: this.spoilRate.toString()
        }
    }


    public deserializeForSave(data: Record<string, any>): void {
        this.id = data.id;
        this.name = data.name;
        this.description = data.description;
        this.count = new Decimal(data.count);
        this.storage = new Decimal(data.storage);
        this.icon = data.icon;
        this.open = data.open;
        this.owner = data.owner;
        this.renewable = data.renewable;
        this.renewRate = new Decimal(data.renewRate);
        this.spoilRate = new Decimal(data.spoilRate ?? "0.01");
    }

}