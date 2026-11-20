import { EventBus } from "./EventBus";
import { EconomySystem } from "./services/Economy/EconomySystem";
import generatorsData from "@/data/generators.json"
import resourceData from "@/data/resource.json"
import { SaveManager } from "./services/GameSave/SaveManager";
import type { EconomySnapshot } from "@/shared/types/Economy";
export class GameManager{
    private static instance: GameManager;
    private eventBus: EventBus;
    private economySystem: EconomySystem;
    private saveManager: SaveManager;
    private constructor(){
        this.eventBus = new EventBus();
        this.economySystem = new EconomySystem(this.eventBus, generatorsData, resourceData);
        this.saveManager = new SaveManager(this.eventBus);
        this.saveManager.register(this.economySystem);
    }


    static getInstance(){
         if (!GameManager.instance) {
            GameManager.instance = new GameManager();
        }
        return GameManager.instance;
    }


    send(command:string, payload?:any){
        this.eventBus.emit(command,payload);
    }


    serializeEconomy(): EconomySnapshot{
        return this.economySystem.serialize();
    }


    getEventBus(): EventBus{

        return this.eventBus;
    }

}

export const gameManager = GameManager.getInstance();