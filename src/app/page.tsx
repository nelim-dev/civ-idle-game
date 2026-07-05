'use client'
import Image from "next/image";
import { use } from "react";
import { gameManager } from "@/logic/GameManager";
import { useGameStore } from "@/store/gameStore";
import { GameLoop } from '@/logic/GameLoop';
import {gameLoop} from '@/logic/GameLoop'
import { useRef, useEffect } from "react"; 
export default function Home() {

  function Pause(){
    gameLoop.setSpeed(0);
  }
  function FirstSpeed(){
    gameLoop.setSpeed(1);
  }
  function SecondSpeed(){
    gameLoop.setSpeed(2);
  }
  function ThirdSpeed(){
    gameLoop.setSpeed(5);
  }
  function ForwardSteps(){
    gameLoop.startFastForward(100,100);
  }
  const coins = useGameStore((state) => state.coins)
    function sendClick(){
      gameManager.send("click");
    }
  return (
    <div className="flex flex-col flex-1 bg-zinc-50 font-sans dark:bg-black">
   <div >

    </div>
      <h1>Монеты: {coins}</h1>
      <button onClick={sendClick}> Клик </button>
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
