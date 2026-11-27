import { EventBus } from "@/logic/EventBus";
import { Saveable } from "@/logic/services/GameSave/Isaveable";
import { ResourceManager } from "./ResourceSystem/ResourceManager";
import { BuildingManager } from "./BuildingSystem/BuildingManager";
import type { BuildingData } from "./BuildingSystem/Building";
import type { ResourceData } from "@/shared/types/Resource";
import type { EconomySnapshot } from "@/shared/types/Economy";

export class EconomySystem implements Saveable{
    private tickSubscribeOff: () => void;
    private resourcesManager: ResourceManager;
    private buildingManager: BuildingManager;
    constructor(
        eventBus: EventBus,
        resourcesData: ResourceData[],
        buildingsData: BuildingData[] = []
    ){
        this.tickSubscribeOff = eventBus.on("tick", this.handleTick);
        this.resourcesManager = new ResourceManager(resourcesData);
        this.buildingManager = new BuildingManager(buildingsData, this.resourcesManager);
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
     * BuildingManager выполняет фазы 2–4, ResourceManager — конец хода.
     * Фазы населения и исследований подключаются на этапах 3 и далее.
     */
    private runTurn(): void {
        this.buildingManager.tick();
        this.resourcesManager.tick();
    }

    public serialize(): EconomySnapshot {
        const resourcesData = this.resourcesManager.serializeForStore();
        const buildingsData = this.buildingManager.serializeForStore().buildingsManager;
        return {
            resources: resourcesData.resourcesManager.resources,
            balanceHistory: resourcesData.resourcesManager.balanceHistory,
            balanceHistoryLength: Number(resourcesData.resourcesManager.balanceHistoryLength),
            buildings: buildingsData.buildings,
            constructionProjects: buildingsData.constructionProjects,
        };
    }
    public serializeForSave(): Record<string, any>{
        return{
            economy:{
            "resourcesManager": this.resourcesManager.serializeForSave(),
            ...this.buildingManager.serializeForSave()
            }
        }
    }
    public deserializeForSave(data: Record<string, any>): void{
        const economyData = data.economy;
        if (!economyData) return;

        if (economyData.resourcesManager) {
        this.resourcesManager.deserializeForSave(economyData.resourcesManager);
        }

        if (economyData.buildingsManager) {
            this.buildingManager.deserializeForSave({
                buildingsManager: economyData.buildingsManager
            });
        }
        // Синхронизация store после загрузки — задача bridge (шаг 2).
    }
}
