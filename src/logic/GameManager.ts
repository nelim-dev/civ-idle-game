import { EventBus } from "./EventBus"; 
import { EconomySystem } from "./services/Economy/EconomySystem";
import { useGameStore } from "@/store/gameStore";
export class GameManager{
    private static instance: GameManager;
    private eventBus: EventBus;
    private economySystem: EconomySystem;
    private constructor(){
        this.eventBus = new EventBus();
        this.economySystem = new EconomySystem(this.eventBus, useGameStore);
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