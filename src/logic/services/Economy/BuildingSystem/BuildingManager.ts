import { Saveable } from "../../GameSave/Isaveable"
import { Building } from "./Building"
import { BuildingData } from "./Building"
import { ResourceManager, ResourceRequest } from "../ResourceSystem/ResourceManager"
import Decimal from "break_infinity.js"

interface ConstructionProject {
  buildingId: string;        // id здания
  count: Decimal;            // сколько ещё нужно построить (может быть >1)
  progress: Decimal;         // накопленная buildPower
  requiredPower: Decimal;    // buildPower, необходимая для одного здания (из cost)
  priority: number;
}

/** Базовые коэффициенты уровня из docs/game-design_v1.md §6.6, §16.3. */
const PRODUCTION_GROWTH_PER_LEVEL = new Decimal(0.10);
const COST_GROWTH_PER_LEVEL = new Decimal(0.08);
/** Доля стоимости постройки, расходуемая на поддержание за ход (§6.7). */
const MAINTENANCE_RATE = new Decimal(0.01);
/** Ключ строительных мощностей; регистр значим (docs/architecture.md §4.4). */
const BUILD_POWER_ID = "BuildPower";

export class BuildingManager implements Saveable {

    private buildings: Record<string, Building> = {};
    private constructionProjects: ConstructionProject[] = [];
    private resourceManager: ResourceManager;
    /** Поддержание включено по умолчанию для каждой группы зданий. */
    private maintenanceEnabled: Record<string, boolean> = {};
    /** Уже применённый бонус складов, чтобы не накапливать его повторно. */
    private appliedStorageBonus: Record<string, Decimal> = {};

    /**
     * Порядок приоритетов дизайна: 1 — самый высокий, далее 2..30, 0 — самый
     * низкий (docs/game-design_v1.md §9.2).
     */
    private static readonly PRIORITY_ORDER: readonly number[] =
        Array.from({ length: 30 }, (_, index) => index + 1).concat(0);

    constructor(buildingsData: BuildingData[], resourceManager: ResourceManager){
        this.buildings = (buildingsData ?? []).reduce((acc, element) => {
            acc[element.id] = new Building(element);
            return acc;
        }, {} as Record<string, Building>);
        this.resourceManager = resourceManager;
    }

    /**
     * Один ход зданий в порядке фаз дизайна (§4.2):
     * производство и потребление → строительство → износ и ремонт.
     * Бонусы складов применяются до производства, чтобы конец хода видел
     * актуальную вместимость.
     *
     * @param availableWorkers Доступные рабочие; до этапа 3 приходят извне.
     */
    public tick(availableWorkers: Decimal = new Decimal(0)): void {
        this.applyStorageBonuses();
        const workerFills = this.distributeWorkers(availableWorkers);
        this.updateEfficiency(workerFills);
        this.produce();
        this.processConstructionQueue(this.getResourceCount(BUILD_POWER_ID));
        this.processDecayAndRepair();
    }

    public build(buildingId: string, count: Decimal): boolean {
        const building = this.buildings[buildingId];
        if (!building || !building.getOpen() || count.lte(0)) {
            return false;
        }

        const requiredPower = building.getCost()[BUILD_POWER_ID] ?? new Decimal(0);
        const existing = this.constructionProjects.find(
            (project) => project.buildingId === buildingId
        );
        if (existing) {
            existing.count = existing.count.plus(count);
            return true;
        }

        this.constructionProjects.push({
            buildingId,
            count,
            progress: new Decimal(0),
            requiredPower,
            priority: 0
        });
        return true;
    }

    public destroyBuilding(buildingId: string, count: Decimal): boolean {
        const building = this.buildings[buildingId];
        if (!building || count.lte(0)) {
            return false;
        }
        building.destroy(count);
        return true;
    }

    public dealBuildingDamage(buildingId: string, amount: Decimal): void {
        const building = this.buildings[buildingId];
        if (!building) {
            return;
        }
        building.damageBuild(amount);
    }

    public setConstructionPriority(buildingId: string, newPriority: Decimal): void {
        const priority = this.clampPriority(newPriority);
        for (const project of this.constructionProjects) {
            if (project.buildingId === buildingId) {
                project.priority = priority;
            }
        }
    }

    public setPower(buildingId: string, newPower: Decimal): void {
        this.buildings[buildingId]?.setPower(newPower);
    }

    public setPriority(buildingId: string, newPriority: Decimal): void {
        this.buildings[buildingId]?.setPriority(new Decimal(this.clampPriority(newPriority)));
    }

    public setMaintenanceEnabled(buildingId: string, enabled: boolean): boolean {
        if (!this.buildings[buildingId]) {
            return false;
        }
        this.maintenanceEnabled[buildingId] = enabled;
        return true;
    }

    public cancelBuild(buildingId: string): boolean {
        const before = this.constructionProjects.length;
        this.constructionProjects = this.constructionProjects.filter(
            (project) => project.buildingId !== buildingId
        );
        return this.constructionProjects.length !== before;
    }

    // ─── Производство и потребление ──────────────────────────────────────────

    private produce(): void {
        const requests: ResourceRequest[] = [];

        for (const [id, building] of Object.entries(this.buildings)) {
            const owned = building.getOwned();
            if (owned.lte(0)) continue;
            if (building.getPower().lte(0)) continue;

            const effectiveRate = building.getPower().div(100)
                .times(building.getEfficiency())
                .times(this.getLevelProductionFactor(building));

            const consumes = this.scaleRates(building.getConsumes(), owned, effectiveRate);
            const produces = this.scaleRates(building.getProduces(), owned, effectiveRate);

            if (
                Object.keys(consumes).length === 0 &&
                Object.keys(produces).length === 0
            ) {
                continue;
            }

            requests.push({
                id,
                priority: building.getPriority().toNumber(),
                consumes,
                produces,
                metadata: id
            });
        }

        if (requests.length === 0) {
            return;
        }

        const results = this.resourceManager.processRequests(requests);
        this.resourceManager.applyRequests(results);
    }

    private scaleRates(
        rates: Record<string, Decimal>,
        owned: Decimal,
        effectiveRate: Decimal
    ): Record<string, Decimal> {
        const result: Record<string, Decimal> = {};
        for (const [resourceId, baseAmount] of Object.entries(rates)) {
            result[resourceId] = baseAmount.times(owned).times(effectiveRate);
        }
        return result;
    }

    private getLevelProductionFactor(building: Building): Decimal {
        return new Decimal(1).plus(
            PRODUCTION_GROWTH_PER_LEVEL.times(building.getLevel().minus(1))
        );
    }

    private getLevelCostFactor(building: Building): Decimal {
        return new Decimal(1).plus(
            COST_GROWTH_PER_LEVEL.times(building.getLevel().minus(1))
        );
    }

    // ─── Население: жильё и рабочие ──────────────────────────────────────────

    /**
     * Σ housingCapacity × owned × levelProductionFactor.
     * Жильё — «продукт» здания, поэтому масштабируется уровнем (§6.6).
     */
    public getTotalHousingCapacity(): Decimal {
        let total = new Decimal(0);

        for (const building of Object.values(this.buildings)) {
            const owned = building.getOwned();
            if (owned.lte(0)) continue;

            total = total.plus(
                building
                    .getHousingCapacity()
                    .times(owned)
                    .times(this.getLevelProductionFactor(building))
            );
        }

        return total;
    }

    /**
     * Σ workersRequired × owned для зданий с power > 0.
     * Выключенное здание не создаёт спрос на рабочих (§6.2).
     */
    public getTotalWorkerDemand(): Decimal {
        let total = new Decimal(0);

        for (const building of Object.values(this.buildings)) {
            const owned = building.getOwned();
            if (owned.lte(0)) continue;
            if (building.getPower().lte(0)) continue;

            total = total.plus(building.getWorkersRequired().times(owned));
        }

        return total;
    }

    // ─── Рабочие ─────────────────────────────────────────────────────────────

    /**
     * Распределяет рабочих по приоритетам: 1, 2, ..., 30, 0. Внутри группы
     * при нехватке доля одинакова и равна remaining / totalDemand, поэтому
     * workerFill = assigned / demand совпадает для всех зданий группы.
     */
    private distributeWorkers(availableWorkers: Decimal): Record<string, Decimal> {
        const fills: Record<string, Decimal> = {};
        const demands: Record<string, Decimal> = {};

        for (const [id, building] of Object.entries(this.buildings)) {
            const owned = building.getOwned();
            if (owned.lte(0)) continue;

            const required = building.getWorkersRequired();
            if (required.lte(0)) {
                fills[id] = new Decimal(1);
                continue;
            }
            if (building.getPower().lte(0)) {
                fills[id] = new Decimal(0);
                continue;
            }
            demands[id] = owned.times(required);
        }

        let remaining = Decimal.max(availableWorkers, new Decimal(0));

        for (const priority of BuildingManager.PRIORITY_ORDER) {
            const ids = Object.keys(demands).filter(
                (id) => this.buildings[id].getPriority().toNumber() === priority
            );
            if (ids.length === 0) continue;

            const totalDemand = ids.reduce(
                (sum, id) => sum.plus(demands[id]),
                new Decimal(0)
            );
            if (totalDemand.lte(0)) continue;

            if (remaining.gte(totalDemand)) {
                for (const id of ids) {
                    fills[id] = new Decimal(1);
                }
                remaining = remaining.minus(totalDemand);
            } else {
                const ratio = remaining.div(totalDemand);
                for (const id of ids) {
                    fills[id] = ratio;
                }
                remaining = new Decimal(0);
            }
        }

        return fills;
    }

    private updateEfficiency(workerFills: Record<string, Decimal>): void {
        for (const [id, building] of Object.entries(this.buildings)) {
            if (building.getOwned().lte(0)) continue;

            const fill = workerFills[id] ?? new Decimal(0);
            const decayFactor = Decimal.max(
                new Decimal(1).minus(building.getDecayLevel().div(100)),
                new Decimal(0)
            );
            building.setEfficiency(fill.times(decayFactor));
        }
    }

    // ─── Склады ──────────────────────────────────────────────────────────────

    private applyStorageBonuses(): void {
        const desired = this.computeDesiredStorageBonus();
        const ids = new Set([
            ...Object.keys(desired),
            ...Object.keys(this.appliedStorageBonus)
        ]);

        for (const resourceId of ids) {
            if (!this.resourceManager.hasResource(resourceId)) continue;

            const next = desired[resourceId] ?? new Decimal(0);
            const previous = this.appliedStorageBonus[resourceId] ?? new Decimal(0);
            const delta = next.minus(previous);

            if (delta.gt(0)) {
                this.resourceManager.addStorage(resourceId, delta);
            } else if (delta.lt(0)) {
                this.resourceManager.reduceStorage(resourceId, delta.times(-1));
            }

            this.appliedStorageBonus[resourceId] = next;
        }
    }

    private computeDesiredStorageBonus(): Record<string, Decimal> {
        const result: Record<string, Decimal> = {};

        for (const building of Object.values(this.buildings)) {
            const owned = building.getOwned();
            if (owned.lte(0)) continue;

            const factor = owned.times(this.getLevelProductionFactor(building));
            for (const [resourceId, value] of Object.entries(building.getStorageBonus())) {
                result[resourceId] = (result[resourceId] ?? new Decimal(0))
                    .plus(value.times(factor));
            }
        }

        return result;
    }

    // ─── Строительство ───────────────────────────────────────────────────────

    private processConstructionQueue(buildPower: Decimal): void {
        if (this.constructionProjects.length === 0) return;

        let availablePower = Decimal.max(buildPower, new Decimal(0));

        for (const priority of BuildingManager.PRIORITY_ORDER) {
            const projects = this.constructionProjects.filter(
                (project) => project.priority === priority
            );
            if (projects.length === 0) continue;

            const works = projects.map((project) => this.remainingWork(project));
            const totalWork = works.reduce(
                (sum, work) => sum.plus(work),
                new Decimal(0)
            );
            if (totalWork.lte(0)) continue;

            let allocations: Decimal[];
            if (availablePower.gte(totalWork)) {
                allocations = works;
                availablePower = availablePower.minus(totalWork);
            } else {
                const ratio = availablePower.div(totalWork);
                allocations = works.map((work) => work.times(ratio));
                availablePower = new Decimal(0);
            }

            projects.forEach((project, index) => {
                this.advanceProject(project, allocations[index]);
            });
        }

        this.constructionProjects = this.constructionProjects.filter(
            (project) => project.count.gt(0)
        );
    }

    private remainingWork(project: ConstructionProject): Decimal {
        if (project.requiredPower.lte(0)) {
            return new Decimal(0);
        }
        const total = project.count.times(project.requiredPower);
        return Decimal.max(total.minus(project.progress), new Decimal(0));
    }

    private advanceProject(project: ConstructionProject, allocated: Decimal): void {
        const building = this.buildings[project.buildingId];
        if (!building || project.count.lte(0)) {
            project.count = new Decimal(0);
            return;
        }

        // Контент v1 всегда задаёт BuildPower в cost; защита от деления на ноль.
        if (project.requiredPower.lte(0)) {
            building.build(project.count);
            project.count = new Decimal(0);
            project.progress = new Decimal(0);
            return;
        }

        const remaining = this.remainingWork(project);
        let progressCapacity = Decimal.min(allocated, remaining);
        if (progressCapacity.lte(0)) return;

        const materialPerProgress = this.getMaterialPerProgress(
            building,
            project.requiredPower
        );
        for (const [resourceId, perProgress] of Object.entries(materialPerProgress)) {
            const available = this.getResourceCount(resourceId);
            progressCapacity = Decimal.min(
                progressCapacity,
                available.div(perProgress)
            );
        }

        const actualProgress = Decimal.max(progressCapacity, new Decimal(0));
        if (actualProgress.lte(0)) return;

        for (const [resourceId, perProgress] of Object.entries(materialPerProgress)) {
            const consumed = perProgress.times(actualProgress);
            if (consumed.gt(0)) {
                this.resourceManager.reduceResourceDirectly(resourceId, consumed);
            }
        }
        this.resourceManager.reduceResourceDirectly(BUILD_POWER_ID, actualProgress);

        project.progress = project.progress.plus(actualProgress);

        while (
            project.count.gt(0) &&
            project.progress.gte(project.requiredPower)
        ) {
            building.build(new Decimal(1));
            project.progress = project.progress.minus(project.requiredPower);
            project.count = project.count.minus(1);
        }

        if (project.count.lte(0)) {
            project.count = new Decimal(0);
            project.progress = new Decimal(0);
        }
    }

    private getMaterialPerProgress(
        building: Building,
        requiredPower: Decimal
    ): Record<string, Decimal> {
        const result: Record<string, Decimal> = {};
        for (const [resourceId, amount] of Object.entries(building.getCost())) {
            if (resourceId === BUILD_POWER_ID) continue;
            if (amount.lte(0)) continue;
            result[resourceId] = amount.div(requiredPower);
        }
        return result;
    }

    // ─── Износ и ремонт ──────────────────────────────────────────────────────

    private processDecayAndRepair(): void {
        for (const [id, building] of Object.entries(this.buildings)) {
            if (building.getOwned().lte(0)) continue;

            // На начало фазы износ >= 100 — вся группа разрушается (§6.7).
            if (building.getDecayLevel().gte(100)) {
                building.destroy(building.getOwned());
                continue;
            }

            building.BuildingDecayTurn();

            if (!this.isMaintenanceEnabled(id)) continue;

            const repairRate = building.getDecayPerTurn();
            if (repairRate.lte(0)) continue;

            const costPerPoint = this.getRepairCostPerPoint(building, repairRate);
            let affordableRepair = repairRate;
            for (const [resourceId, perPoint] of Object.entries(costPerPoint)) {
                const available = this.getResourceCount(resourceId);
                affordableRepair = Decimal.min(affordableRepair, available.div(perPoint));
            }
            affordableRepair = Decimal.max(affordableRepair, new Decimal(0));
            if (affordableRepair.lte(0)) continue;

            for (const [resourceId, perPoint] of Object.entries(costPerPoint)) {
                const consumed = perPoint.times(affordableRepair);
                if (consumed.gt(0)) {
                    this.resourceManager.reduceResourceDirectly(resourceId, consumed);
                }
            }

            building.setDecayLevel(
                Decimal.max(
                    building.getDecayLevel().minus(affordableRepair),
                    new Decimal(0)
                )
            );
        }
    }

    private getRepairCostPerPoint(
        building: Building,
        repairRate: Decimal
    ): Record<string, Decimal> {
        const maintenanceCost = this.getMaintenanceCost(building);
        const result: Record<string, Decimal> = {};
        for (const [resourceId, amount] of Object.entries(maintenanceCost)) {
            if (amount.lte(0)) continue;
            result[resourceId] = amount.div(repairRate);
        }
        return result;
    }

    /**
     * maintenanceCost = constructionCost × maintenanceRate × owned ×
     * levelCostFactor (§6.7). BuildPower — поток, в поддержании не участвует.
     */
    private getMaintenanceCost(building: Building): Record<string, Decimal> {
        const result: Record<string, Decimal> = {};
        const factor = MAINTENANCE_RATE
            .times(building.getOwned())
            .times(this.getLevelCostFactor(building));

        for (const [resourceId, amount] of Object.entries(building.getCost())) {
            if (resourceId === BUILD_POWER_ID) continue;
            if (amount.lte(0)) continue;
            result[resourceId] = amount.times(factor);
        }
        return result;
    }

    private isMaintenanceEnabled(buildingId: string): boolean {
        return this.maintenanceEnabled[buildingId] ?? true;
    }

    // ─── Вспомогательное ─────────────────────────────────────────────────────

    private clampPriority(priority: Decimal): number {
        const value = priority.toNumber();
        if (!Number.isFinite(value)) return 0;
        return Math.max(0, Math.min(30, Math.trunc(value)));
    }

    private getResourceCount(resourceId: string): Decimal {
        return this.resourceManager.getResourceCount(resourceId) ?? new Decimal(0);
    }

    // ─── Сериализация ────────────────────────────────────────────────────────

    public serializeForStore(){
        return {
            "buildingsManager":{
                "buildings": Object.fromEntries(Object.entries(this.buildings).map(([key,value])=>[key, value.serializeForStore()])),
                "constructionProjects": this.constructionProjects.map( element => {
                    return {
                        "buildingId": element.buildingId,
                        "count": element.count.toString(),
                        "progress": element.progress.toString(),
                        "requiredPower": element.requiredPower.toString(),
                        "priority": element.priority.toString(),
                    }
                })
            }
        }
    }

    public serializeForSave(): Record<string, any> {
        return {
            "buildingsManager":{
                "buildings": Object.fromEntries(
                    Object.entries(this.buildings).map(([key, value]) => [
                        key,
                        {
                            ...value.serializeForSave(),
                            maintenanceEnabled: this.isMaintenanceEnabled(key)
                        }
                    ])
                ),
                "constructionProjects": this.constructionProjects.map( element => {
                    return {
                        "buildingId": element.buildingId,
                        "count": element.count.toString(),
                        "progress": element.progress.toString(),
                        "requiredPower": element.requiredPower.toString(),
                        "priority": element.priority.toString(),
                    }
                })
            }
        }
    }

    public deserializeForSave(data: Record<string, any>): void {
        const buildingManagerdata = data.buildingsManager;
        if(!buildingManagerdata){
            return;
        }
        if(buildingManagerdata.buildings){
            const buildingsData = buildingManagerdata.buildings as Record<string,any>;
            for(const [id, buildingData] of Object.entries(buildingsData)){
                const existingBuilding = this.buildings[id];
                if(existingBuilding) {
                    existingBuilding.deserializeForSave(buildingData);
                }
                if (typeof buildingData.maintenanceEnabled === "boolean") {
                    this.maintenanceEnabled[id] = buildingData.maintenanceEnabled;
                }
            }
        }
        if (buildingManagerdata.constructionProjects) {
            const constructionProjectsData = buildingManagerdata.constructionProjects;

            this.constructionProjects = constructionProjectsData.map((element: any) => (
                {
                    "buildingId": element.buildingId,
                    "count": new Decimal(element.count),
                    "progress": new Decimal(element.progress),
                    "requiredPower": new Decimal(element.requiredPower),
                    "priority": Number(element.priority),
                }
            )) as ConstructionProject[];
        }

        // Склад в сейве уже включает бонус зданий, поэтому синхронизируем
        // учтённый бонус, чтобы следующий ход не добавил его повторно.
        this.appliedStorageBonus = this.computeDesiredStorageBonus();
    }

}
