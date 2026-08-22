import { EventBus } from "@/logic/EventBus";
import { useGameStore } from "@/store/gameStore";
import { Generator, GeneratorData } from "./Generator";
import { GameState } from "@/store/gameStore";
import Decimal from 'break_infinity.js';
import { ISaveable } from "@/logic/services/GameSave/Isaveable";
import { ResourceManager } from "./ResourceSystem/ResourceManager"; 
import { ResourceData } from "./ResourceSystem/Resource"; 

export class EconomySystem implements ISaveable{
    private clickSubscribeOff: () => void;
    private tickSubscribeOff: () => void;
    private buildGeneratorOff: () => void;
    private store: typeof useGameStore;
    private resourcesManager: ResourceManager;
    constructor(eventBus: EventBus, store: typeof useGameStore, generatorsData: any[], resourcesData: ResourceData[]){
        this.clickSubscribeOff = eventBus.on("click", this.handleClick);
        this.tickSubscribeOff = eventBus.on("tick", this.handleTick);
        this.buildGeneratorOff = eventBus.on("buildGenerator", this.handleBuildGenerator);
        this.store = store;
        this.resourcesManager = new ResourceManager(resourcesData);
        this.syncStore({ resources: true});

    }

    private handleBuildGenerator = (payload: {id: string, count?: number}) =>{
    }


    private handleClick = () => {
    }

    private handleTick = () => {
        this.resourcesManager.tick();
        console.log('ResourceManager.tick()');
        this.syncStore({resources: true});
    }

    syncStore(options?: {resources? : boolean, generators?: boolean}){
        const update: Partial<GameState['economy']> = {}

        if (options?.resources !== false) {
            const data = this.resourcesManager.serializeForStore();
            update.resources = data.resourcesManager.resources;
            update.balanceHistory = data.resourcesManager.balanceHistory;
            update.balanceHistoryLength = Number(data.resourcesManager.balanceHistoryLength);
        }

        this.store.setState({
            economy:{
                ...this.store.getState().economy,
                ...update,
            }
        });
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
        // После загрузки синхронизируем Zustand, чтобы UI обновился
        this.syncStore({ resources: true});
    }
}