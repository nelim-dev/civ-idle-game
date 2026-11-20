import { EventBus } from "./EventBus";
import { EconomySystem } from "./services/Economy/EconomySystem";
import generatorsData from "@/data/generators.json"
import resourceData from "@/data/resource.json"
import { SaveManager } from "./services/GameSave/SaveManager";
import type { EconomySnapshot } from "@/shared/types/Economy";

declare global {
    var __gameManager: GameManager | undefined;
}
export class GameManager{
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
        if (!globalThis.__gameManager) {
            globalThis.__gameManager = new GameManager();
        }
        return globalThis.__gameManager;
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

export function getGameManager(): GameManager {
    return GameManager.getInstance();
}