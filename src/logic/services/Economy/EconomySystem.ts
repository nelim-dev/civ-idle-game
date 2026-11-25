import { EventBus } from "@/logic/EventBus";
import { Saveable } from "@/logic/services/GameSave/Isaveable";
import { ResourceManager } from "./ResourceSystem/ResourceManager";
import type { ResourceData } from "@/shared/types/Resource";
import type { EconomySnapshot } from "@/shared/types/Economy";

export class EconomySystem implements Saveable{
    private tickSubscribeOff: () => void;
    private resourcesManager: ResourceManager;
    constructor(eventBus: EventBus, resourcesData: ResourceData[]){
        this.tickSubscribeOff = eventBus.on("tick", this.handleTick);
        this.resourcesManager = new ResourceManager(resourcesData);
    }

    private handleTick = () => {
        this.runTurn();
    }

    /**
     * Один ход. Порядок фаз фиксирован дизайном (docs/game-design_v1.md, 4.2):
     * 1. потребление населения;
     * 2. производство и потребление зданий;
     * 3. строительство;
     * 4. износ и ремонт;
     * 5. исследования и прочее;
     * 6. конец хода.
     *
     * Фазы 1–5 подключаются вместе с PopulationSystem и BuildingManager.
     * Сейчас выполняется только конец хода: восстановление природы, порча
     * излишков, обрезка природных пулов и запись истории баланса.
     */
    private runTurn(): void {
        this.resourcesManager.tick();
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