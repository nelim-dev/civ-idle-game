import { Saveable } from "./Isaveable";
import { EventBus } from "@/logic/EventBus";
export class SaveManager{
    private saveables: Saveable[] = [];

    private readonly SAVE_KEY = 'gameSave';
    private saveSubscribeOff: () => void;
    private loadSubscribeOff: () => void;
    constructor(eventBus: EventBus){
    this.saveSubscribeOff = eventBus.on("saveGame", this.save);
    this.loadSubscribeOff = eventBus.on("loadGame", this.load);
    }

    register(module: Saveable): void {
        this.saveables.push(module);
    }

    save = (): void => {
        const saveData = this.saveables.reduce((acc, module) => {
            return { ...acc, ...module.serializeForSave() };
        }, {});
        localStorage.setItem(this.SAVE_KEY, JSON.stringify(saveData));
                console.log("Игра Сохранена");
    }


   load = (): void => {
        const saveString = localStorage.getItem(this.SAVE_KEY);
        if (!saveString) return;

        try {
            const saveData = JSON.parse(saveString);
            this.saveables.forEach(module => {
                module.deserializeForSave(saveData);
            });
        } catch (error) {
            console.error('Failed to load save:', error);
        }
        console.log("Сохранение загружено");
    }
}