import type { GameManager } from "./GameManager";
import { getGameManager } from "./GameManager";

declare global {
    var __gameLoop: GameLoop | undefined;
}
/* Главный игровой цикл. */
export class GameLoop{
private tickMs: number = 100;
private gameManager: GameManager;
private intervalID: NodeJS.Timeout | number | undefined;
private currentSpeed: number = 1;
private savedSpeed: number = 1;
private fastForwardRemaining: number | null = null;
private step : number = 0;

constructor (tickMs: number|undefined, gameManager: GameManager){
    if(tickMs != undefined){
    this.tickMs = tickMs;
    }
    this.gameManager = gameManager;
}

public setSpeed(speed: number){

    if(speed == 0){
        this.currentSpeed = 0;
        this.fastForwardRemaining = null;
        this.stop();
    }else{
        this.currentSpeed = speed;
        this.setTickMS(1000/speed);
        this.fastForwardRemaining = null;
        this.start();
    }
    this.gameManager.send("speed:changed", { speed });
}

public start(): void {
    if (typeof window === "undefined") return;
    if (this.intervalID !== undefined) return;
    if (this.currentSpeed === 0) return;
    this.gameTick();
}

getSpeed(){
    return this.currentSpeed;
}

startFastForward(speed:number, steps: number){
    if(speed > 0 && steps > 0){
    this.savedSpeed = this.currentSpeed;
    this.setSpeed(speed);
    this.fastForwardRemaining = steps;
    }
}

restoreSpeed(){
    this.setSpeed(this.savedSpeed);
}

private gameTick() {
    this.intervalID = setInterval(() => {
        this.gameManager.send("tick", { step: this.step + 1 });
        this.step = this.step + 1;
        if( this.fastForwardRemaining != null){
            this.fastForwardRemaining -= 1;
            if(this.fastForwardRemaining == 0){
                this.restoreSpeed();
            }
        }
        
    }, this.tickMs);
}



public stop(){
    clearInterval(this.intervalID);
    this.intervalID = undefined;
    this.fastForwardRemaining = null;
}

private  setTickMS(tickMS: number){
this.tickMs = tickMS;
if(this.intervalID!= undefined){
this.stop();
this.gameTick();
}
}

public getTickMS(): number{
    return this.tickMs;
}

}

export function getGameLoop(): GameLoop {
    if (!globalThis.__gameLoop) {
        globalThis.__gameLoop = new GameLoop(1000, getGameManager());
    }
    return globalThis.__gameLoop;
}
