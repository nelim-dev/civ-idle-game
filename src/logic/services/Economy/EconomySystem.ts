import { EventBus } from "@/logic/EventBus";
import { useGameStore } from "@/store/gameStore";


export class EconomySystem {
    private clickSubscriveOff: () => void;
    private tickSubscribeOff: () => void;
    private store: typeof useGameStore;
    constructor(eventBus: EventBus, store: typeof useGameStore){
        this.clickSubscriveOff = eventBus.on("click", this.click);
        this.tickSubscribeOff = eventBus.on("tick", this.tick);
        this.store = store;
    }


    private click = () => {
        this.store.setState((state) => ({coins: state.coins +1}));
    }

    private tick = () => {
        this.store.setState((state) => ({coins: state.coins + state.income}));
    }
}