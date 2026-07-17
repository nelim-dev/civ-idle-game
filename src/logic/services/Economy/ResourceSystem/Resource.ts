import Decimal from "break_infinity.js"
import { ISaveable } from "../../GameSave/Isaveable";
export interface ResourceData {
    id: string,
    name: string,
    description: string,
    count: string,
    storage: string,
    icon: string,
    open: boolean,
    owner: string,
    renewable: boolean,
    renewRate: string
}

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
    renewRate: Decimal
}


export class Resource implements IResource, ISaveable {
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

    public pruneResource() {
        if (this.count.gt(this.storage)) {
            this.count = this.storage;
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

    public reduceStorage(count: Decimal): boolean {
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

    public getStorage(): Decimal {
        return this.storage;
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
            renewRate: this.renewRate.toFixed(6)
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
            renewRate: this.renewRate.toString()
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
    }

}