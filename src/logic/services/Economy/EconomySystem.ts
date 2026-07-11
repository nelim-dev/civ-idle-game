import { EventBus } from "@/logic/EventBus";
import { useGameStore } from "@/store/gameStore";
import { Generator, GeneratorData } from "./Generator";
import { GameState } from "@/store/gameStore";
export class EconomySystem {
    private resources: Record<string, number>;
    private clickSubscriveOff: () => void;
    private tickSubscribeOff: () => void;
    private buildGeneratorOff: () => void;
    private generators: Generator[];
    private store: typeof useGameStore;
    constructor(eventBus: EventBus, store: typeof useGameStore, generatorsData: any[], resourcesData: Record<string,number>){
        this.clickSubscriveOff = eventBus.on("click", this.click);
        this.tickSubscribeOff = eventBus.on("tick", this.tick);
        this.buildGeneratorOff = eventBus.on("buildGenerator", this.buildGenerator);
        this.store = store;
        this.generators = generatorsData.map(data => new Generator(data));
        this.resources = resourcesData;
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
                if(generator.getCost() <= this.resources.money){
                    this.resources.money = this.resources.money - generator.getCost();
                    generator.build();

                }
            }
        }else{
            if(generator.getCost() <= this.resources.money){
            this.resources.money = this.resources.money - generator.getCost();
            generator.build();
            }
        }
        this.syncStore({resources: true, generators: true});
    }


    private click = () => {
        this.resources.money = (this.resources.money || 0) + 1;
        this.syncStore({resources: true, generators: false});
    }

    private tick = () => {
        this.generators.forEach(element => {
            this.resources.money += element.getIncome();
        });
        this.syncStore({resources: true, generators: false});
    }

    syncStore(options?: {resources? : boolean, generators?: boolean}){
        const update: Partial<GameState['economy']> = {}

        if(options?.resources !== false){
            update.resources = {...this.resources};
        }

        if(options?.generators !== false){
            update.generators = this.generators.map(g => ({
                id: g.id,
                name: g.name,
                income: g.getIncome(),
                baseIncome: g.getBaseIncome(),
                cost: g.getCost(),
                costMultiplier: g.costMultiplier,
                owned: g.getOwned()
            }))
        }

        this.store.setState({
            economy:{
                ...this.store.getState().economy,
                ...update,
            }
        });
    }
}