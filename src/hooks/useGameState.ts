/*import { GameLoop } from "@/logic/GameLoop";
import { GameManager } from "@/logic/GameManager";
import { GameState } from "@/logic/GameState";
import { useState, useRef, useEffect } from "react";

export function useGame(){
let initialState : GameState = {coins: 1};
const [gameState, setGameState]  = useState(initialState);
const [gameSpeedState, setGameSpeed] = useState(1);
const managerRef = useRef<GameManager | null>(null);
const loopRef = useRef<GameLoop>(undefined);

useEffect(() => {

    function onChange(){
        if(managerRef.current){
        const currentState = managerRef.current.getState();
        setGameState(currentState);
        }
    }
    const manager = new GameManager(onChange);
    managerRef.current = manager;
    
    setGameState(manager.getState());

    function onGameSpeedChange(){
        if(loopRef.current){
            const currentSpeed = loopRef.current.getSpeed();
            setGameSpeed(currentSpeed);
        }
    }
    const loop = new GameLoop(1000, manager, onGameSpeedChange);
    loopRef.current = loop;

    return () => {
        if(loopRef.current != undefined){
        loopRef.current.stop();
        }
    }
},[])

    function handleClick(){
        managerRef.current?.click();
    }
    function handleSetGameSpeed(speed: number){
        loopRef.current?.setSpeed(speed);
    }

    function handleStartFastForward(speed: number, steps: number){
        loopRef.current?.startFastForward(speed,steps);
    }
    function handleGetGameSpeed(){
        return loopRef.current?.getSpeed();
    }
    return {
        state: gameState,
        gameSpeed: gameSpeedState,
        click: handleClick,
        setGameSpeed: handleSetGameSpeed,
        startFastForward: handleStartFastForward,
        getGameSpeed: handleGetGameSpeed
    }
}
*/