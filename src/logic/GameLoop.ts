import { GameManager } from "./GameManager";

export class GameLoop{


private tickMs: number = 100;
private gameManager: GameManager;
private intervalID: NodeJS.Timeout | number | undefined;
private onGameSpeedChange : (()=>void) | undefined;
private currentSpeed: number = 1;
private savedSpeed: number = 1;
private fastForwardRemaining: number | null = null;


constructor (tickMs: number|undefined, gameManager: GameManager, onGameSpeedChange : (()=>void)){
    if(tickMs != undefined){
    this.tickMs = tickMs;
    }
    this.gameManager = gameManager;
    this.gameTick();
    this.onGameSpeedChange = onGameSpeedChange;
}

public setSpeed(speed: number){

    if(speed == 0){
    this.stop();    
    }else{
        this.setTickMS(1000/speed);
    }
    this.currentSpeed = speed;
    this.fastForwardRemaining = null;
    this.onGameSpeedChange?.();
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
        this.gameManager.tick();
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
}

if( this.intervalID == undefined){
this.gameTick();
}
}

public getTickMS(): number{
    return this.tickMs;
}

}