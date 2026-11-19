import { EventBus } from "@/logic/EventBus";
import { Generator, GeneratorData } from "./Generator";
import Decimal from 'break_infinity.js';
import { Saveable } from "@/logic/services/GameSave/Isaveable";
import { ResourceManager } from "./ResourceSystem/ResourceManager";
import type { ResourceData } from "@/shared/types/Resource";
import type { EconomySnapshot } from "@/shared/types/Economy";

export class EconomySystem implements Saveable{
    private clickSubscribeOff: () => void;
    private tickSubscribeOff: () => void;
    private buildGeneratorOff: () => void;
    private resourcesManager: ResourceManager;
    constructor(eventBus: EventBus, generatorsData: any[], resourcesData: ResourceData[]){
        this.clickSubscribeOff = eventBus.on("click", this.handleClick);
        this.tickSubscribeOff = eventBus.on("tick", this.handleTick);
        this.buildGeneratorOff = eventBus.on("buildGenerator", this.handleBuildGenerator);
        this.resourcesManager = new ResourceManager(resourcesData);
    }

    private handleBuildGenerator = (payload: {id: string, count?: number}) =>{
    }


    private handleClick = () => {
    }
// нереализованные методы, к будущей реализации для менеджера построек
    /*handleBuildBuilding(payload: { buildingId: string; count: Decimal }): void

    handleBuildingRepair(payload: { buildingId: string; amount: Decimal }): void

    handleBuildingDestroy(payload: { buildingId: string; count: Decimal }): void

    handleSetBuildingPower(payload: { buildingId: string; power: Decimal }): void

    handleSetBuildingPriority(payload: { buildingId: string; priority: Decimal }): void*/
    

    private handleTick = () => {
        this.resourcesManager.tick();
        console.log('ResourceManager.tick()');
    }

    public serialize(): EconomySnapshot {
        const data = this.resourcesManager.serializeForStore();
        return {
            resources: data.resourcesManager.resources,
            balanceHistory: data.resourcesManager.balanceHistory,
            balanceHistoryLength: Number(data.resourcesManager.balanceHistoryLength),
        };
    }
    public serializeForSave(): Record<string, any>{
        return{
            economy:{
            "resourcesManager": this.resourcesManager.serializeForSave()
            }
        }
    }
    public deserializeForSave(data: Record<string, any>): void{
        const economyData = data.economy;
        if (!economyData) return;

        if (economyData.resourcesManager) {
        this.resourcesManager.deserializeForSave(economyData.resourcesManager);
        }
        // Синхронизация store после загрузки — задача bridge (шаг 2).
    }
}