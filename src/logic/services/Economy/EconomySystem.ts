import { EventBus } from "@/logic/EventBus";
import { Saveable } from "@/logic/services/GameSave/Isaveable";
import { ResourceManager } from "./ResourceSystem/ResourceManager";
import { BuildingManager } from "./BuildingSystem/BuildingManager";
import type { BuildingData } from "./BuildingSystem/Building";
import { PopulationSystem } from "./PopulationSystem/PopulationSystem";
import type { Population } from "./PopulationSystem/PopulationSystem";
import type { ResourceData } from "@/shared/types/Resource";
import type { EconomySnapshot, PopulationWarning } from "@/shared/types/Economy";

export class EconomySystem implements Saveable{
    private tickSubscribeOff: () => void;
    private resourcesManager: ResourceManager;
    private buildingManager: BuildingManager;
    private populationSystem: PopulationSystem;
    constructor(
        eventBus: EventBus,
        resourcesData: ResourceData[],
        buildingsData: BuildingData[] = [],
        populationData: Population[] = []
    ){
        this.tickSubscribeOff = eventBus.on("tick", this.handleTick);
        this.resourcesManager = new ResourceManager(resourcesData);
        this.buildingManager = new BuildingManager(buildingsData, this.resourcesManager);
        // Провайдеры позволяют пересчитать производные значения населения
        // после загрузки сейва, не меняя ресурсы и здания.
        this.populationSystem = new PopulationSystem(
            populationData,
            this.resourcesManager,
            {
                housingCapacityProvider: () =>
                    this.buildingManager.getTotalHousingCapacity(),
                workerDemandProvider: () =>
                    this.buildingManager.getTotalWorkerDemand()
            }
        );
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
     */
    private runTurn(): void {
        const housingCapacity = this.buildingManager.getTotalHousingCapacity();
        const workerDemand = this.buildingManager.getTotalWorkerDemand();

        this.populationSystem.tick(housingCapacity, workerDemand);
        this.buildingManager.tick(this.populationSystem.getAvailableWorkers());
        this.resourcesManager.tick();
    }

    public serialize(): EconomySnapshot {
        const resourcesData = this.resourcesManager.serializeForStore();
        const buildingsData = this.buildingManager.serializeForStore().buildingsManager;
        const population = this.populationSystem.serializeForStore().population;
        const warnings = this.collectWarnings(population);

        return {
            resources: resourcesData.resourcesManager.resources,
            balanceHistory: resourcesData.resourcesManager.balanceHistory,
            balanceHistoryLength: Number(resourcesData.resourcesManager.balanceHistoryLength),
            buildings: buildingsData.buildings,
            constructionProjects: buildingsData.constructionProjects,
            population,
            warnings
        };
    }

    public serializeForSave(): Record<string, any>{
        return{
            economy:{
            "resourcesManager": this.resourcesManager.serializeForSave(),
            ...this.buildingManager.serializeForSave(),
            population: this.populationSystem.serializeForSave().population
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

        // Население загружается после зданий: провайдеры жилья и спроса на
        // рабочих должны видеть восстановленные здания.
        if (economyData.population) {
            this.populationSystem.deserializeForSave({
                population: economyData.population
            });
        }
    }

    /** Агрегирует предупреждения населения для верхней панели без дублей. */
    private collectWarnings(
        population: Record<string, { warnings: PopulationWarning[] }>
    ): PopulationWarning[] {
        const warnings = new Set<PopulationWarning>();
        for (const snapshot of Object.values(population)) {
            for (const warning of snapshot.warnings) {
                warnings.add(warning);
            }
        }
        return Array.from(warnings);
    }
}
