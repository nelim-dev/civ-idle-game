'use client'
//import { gameManager } from "@/logic/GameManager";
import { useGameStore } from "@/store/gameStore";
import { gameLoop } from '@/logic/GameLoop'
import { ResourcePanel } from "@/components/resources/ResourcePanel";

//import { GeneratorList } from "@/components/GeneratorList";
import { SaveButton } from "@/components/SaveButton";
import { LoadGameButton } from "@/components/LoadGameButton";
export default function Home() {
  //const money = useGameStore((state) => state.economy.resources.money);
  const step = useGameStore((state) => state.gameStep);
  function Pause() {
    gameLoop.setSpeed(0);
  }
  function FirstSpeed() {
    gameLoop.setSpeed(1);
  }
  function SecondSpeed() {
    gameLoop.setSpeed(2);
  }
  function ThirdSpeed() {
    gameLoop.setSpeed(5);
  }
  function ForwardSteps() {
    gameLoop.startFastForward(100, 100);
  }

  /*   function sendClick(){
       gameManager.send("click");
     }*/

  return (
    <div className="flex flex-col h-64 h-screen bg-zinc-50 font-sans dark:bg-black">
      <div>
        <h1>Шаг: {step}</h1>
        <div className="flex gap-2">
          <button className="border border-gray-300 p-2.5 m-1.5" onClick={Pause}>Пауза</button>
          <button className="border border-gray-300 p-2.5 m-1.5" onClick={FirstSpeed}>х1</button>
          <button className="border border-gray-300 p-2.5 m-1.5" onClick={SecondSpeed}>х2</button>
          <button className="border border-gray-300 p-2.5 m-1.5" onClick={ThirdSpeed}>х5</button>
          <button className="border border-gray-300 p-2.5 m-1.5" onClick={ForwardSteps}>100 шагов</button>
          <SaveButton />
          <LoadGameButton />
        </div>
      </div>
      <div className="flex flex-1 overflow-hidden">
        <ResourcePanel />

      </div>
    </div>
  );
}
