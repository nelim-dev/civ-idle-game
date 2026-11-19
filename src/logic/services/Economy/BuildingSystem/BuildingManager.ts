import { Saveable } from "../../GameSave/Isaveable"
import { Building } from "./Building"
import { BuildingData } from "./Building"
import { ResourceManager, ResourceRequest, ResourceResult } from "../ResourceSystem/ResourceManager"
import Decimal from "break_infinity.js"


interface ConstructionProject {
  buildingId: string;        // id здания
  count: Decimal;            // сколько ещё нужно построить (может быть >1)
  progress: Decimal;         // накопленная buildPower
  requiredPower: Decimal;    // buildPower, необходимая для одного здания (из cost)
  priority: number;
}

export class BuildingManager implements Saveable{

    private buildings: Record<string, Building> = {};
    private constructionProjects: ConstructionProject[] = [];
    private resourceManager: ResourceManager;
    constructor(buildingsData: BuildingData[], resourceManager: ResourceManager){
            this.buildings = (buildingsData ?? []).reduce((acc, element) => {
                acc[element.id] = new Building(element);
                return acc;
            }, {} as Record<string,Building>);
            this.resourceManager = resourceManager;
    }

    public build(buildingId: string, count: Decimal): boolean{
        return true;
    }

    public destroyBuilding(buildingId: string, count: Decimal): boolean{
        return true;
    }

    public dealBuildingDamage(buildingId: string, count: Decimal){

    }

    public setConstructionPriority(buildingId: string, newPriority: Decimal): void
    {

    }

    public tick(): void {

    }

    private Produce(){

    }

    public setPower(buildingId: string, newPower: Decimal){

    }

    public setPriority(buildingId: string, newPriority: Decimal){

    }

    private repairBuilding(buildingId: string, amount: Decimal){

    }

    private calculateEfficiency(): Decimal{
        return new Decimal(0);
    }

    private processConstructionQueue(buildPower: Decimal): void{

    }

    private addTier(){
        
    }

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
                "buildings": Object.fromEntries(Object.entries(this.buildings).map(([key,value])=>[key, value.serializeForSave()])),
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
        };
    }

}