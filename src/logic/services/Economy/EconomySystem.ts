import { EventBus } from "@/logic/EventBus";
import { useGameStore } from "@/store/gameStore";
import { Generator, GeneratorData } from "./Generator";
import { GameState } from "@/store/gameStore";
import Decimal from 'break_infinity.js';
import { ISaveable } from "@/logic/services/GameSave/Isaveable";


export class EconomySystem implements ISaveable{
    private resources: Record<string, Decimal>;
    private clickSubscriveOff: () => void;
    private tickSubscribeOff: () => void;
    private buildGeneratorOff: () => void;
    private generators: Generator[];
    private store: typeof useGameStore;
    constructor(eventBus: EventBus, store: typeof useGameStore, generatorsData: any[], resourcesData: Record<string,string>){
        this.clickSubscriveOff = eventBus.on("click", this.click);
        this.tickSubscribeOff = eventBus.on("tick", this.tick);
        this.buildGeneratorOff = eventBus.on("buildGenerator", this.buildGenerator);
        this.store = store;
        this.generators = generatorsData.map(data => new Generator(data));
        this.resources = Object.fromEntries(Object.entries(resourcesData).map(([key,value]) => [key, new Decimal(value)]));
        this.syncStore({ resources: true, generators: true });

    }

    private buildGenerator = (payload: {id: string, count?: number}) =>{
        
        const generator = this.generators.find(g => g.id === payload.id)
        if(!generator){
        console.warn(`Generator with id ${payload.id} not found`);
        return;
        }

        if(payload.count){
            
            for( let i = 0; i < payload.count; i++){
                if(this.resources.money.gte(generator.getCost())){
                    this.resources.money = this.resources.money.minus(generator.getCost());
                    generator.build();

                }
            }
        }else{
            if(this.resources.money.gte(generator.getCost())){
            this.resources.money = this.resources.money.minus(generator.getCost());
            generator.build();
            }
        }
        this.syncStore({resources: true, generators: true});
    }


    private click = () => {
        this.resources.money = this.resources.money.plus(1);
        this.syncStore({resources: true, generators: false});
    }

    private tick = () => {
        this.generators.forEach(element => {
            this.resources.money = this.resources.money.plus(element.getIncome());
        });
        this.syncStore({resources: true, generators: false});
    }

    syncStore(options?: {resources? : boolean, generators?: boolean}){
        const update: Partial<GameState['economy']> = {}

        if(options?.resources !== false){
            update.resources = Object.fromEntries(Object.entries(this.resources).map(([key,value]) => [key, value.toFixed(2).toString()]));
        }

        if(options?.generators !== false){
            update.generators = this.generators.map(g => g.serializeForStore());
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
            "resources": Object.fromEntries(Object.entries(this.resources).map(([key,value]) => [key,value.toString()])),
            "generators": this.generators.map(g => g.serializeForSave())
            }
        }
    }
    public deserializeForSave(data: Record<string, any>): void{
        const economyData = data.economy;
        if (!economyData) return;

        if (economyData.resources) {
        this.resources = Object.fromEntries(
            Object.entries(economyData.resources).map(([key, value]) => [key, new Decimal(value as string)])
        );
        }
        if (economyData.generators) {
        economyData.generators.forEach((savedGen: any) => {
            const existingGen = this.generators.find(g => g.id === savedGen.id);
            if (existingGen) {
                existingGen.deserializeForSave(savedGen);
            }
        });
        }
        // После загрузки синхронизируем Zustand, чтобы UI обновился
        this.syncStore({ resources: true, generators: true });
    }
}