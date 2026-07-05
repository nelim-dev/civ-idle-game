
import { GameState } from "./GameState";

export class GameManager{
    private state : GameState;
    private onChange: (()=>void) | undefined



    constructor(onChange : (()=>void) | undefined){
     this.state = {coins: 1};

     this.onChange = onChange;

    }

    
    public click() {
        this.state = {...this.state, coins: this.state.coins + 1};
        this.onChange?.();
    }
    
    public tick(){
        this.state = {...this.state, coins: this.state.coins + 1};
        console.log("tick");
        this.onChange?.();
    }

    public getState(){
        return {...this.state};
    }



}