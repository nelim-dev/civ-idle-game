'use client'
import { getGameManager } from "@/logic/GameManager";
import { useGameStore} from "@/store/gameStore";

export function LoadGameButton(){
    return(
    <div className="border border-gray-300 p-2.5 m-1.5">
        <button 
        onClick={() => getGameManager().send('loadGame')}
        >
            Загрузить игру
        </button>
    </div>);
}