import { EventBus } from "./EventBus"; 
import { EconomySystem } from "./services/Economy/EconomySystem";
import { useGameStore } from "@/store/gameStore";
import generatorsData from "@/data/generators.json"
import resourcesData from "@/data/resources.json"
import { SaveManager } from "./services/GameSave/SaveManager";
export class GameManager{
    private static instance: GameManager;
    private eventBus: EventBus;
    private economySystem: EconomySystem;
    private saveManager: SaveManager;
    private constructor(){
        this.eventBus = new EventBus();
        this.economySystem = new EconomySystem(this.eventBus, useGameStore,generatorsData, resourcesData);
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


    getEventBus(): EventBus{

        return this.eventBus;
    }

}

export const gameManager = GameManager.getInstance();