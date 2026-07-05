'use client'
import Image from "next/image";
import { useGame } from "@/hooks/useGameState";
import { use } from "react";


export default function Home() {

  const {state, gameSpeed, click, setGameSpeed, startFastForward} = useGame();
  function Pause(){
    setGameSpeed(0);
  }
  function FirstSpeed(){
    setGameSpeed(1);
  }
  function SecondSpeed(){
    setGameSpeed(2);
  }
  function ThirdSpeed(){
    setGameSpeed(5);
  }
  function ForwardSteps(){
    startFastForward(100,100);
  }
  return (
    <div className="flex flex-col flex-1 bg-zinc-50 font-sans dark:bg-black">
   <div >

    </div>
      <h1>Монеты: {state.coins}</h1>
      <button onClick={click}> Клик </button>
      <div>
        <button onClick = {Pause}>Пауза</button>
        <button onClick = {FirstSpeed}>х1</button>
        <button onClick = {SecondSpeed}>х2</button>
        <button onClick = {ThirdSpeed}>х5</button>
        <button onClick = {ForwardSteps}>100 шагов</button>
      </div>
    </div>
  );
}
