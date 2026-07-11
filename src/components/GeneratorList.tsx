'use client'
import { useGameStore } from "@/store/gameStore";
import { gameManager } from "@/logic/GameManager";

export function GeneratorList(){
  const money = useGameStore((state) => state.economy.resources.money);
  const generators = useGameStore((state) => state.economy.generators);

  return(
    
    generators.map((gen) => (
        <div key={gen.id} style={{ border: '1px solid #ccc', padding: '10px', margin: '5px' }}>
          <span>{gen.name}</span><br />
          <span>Куплено: {gen.owned}</span><br />
          <span>Доход: {gen.income}</span><br />
          <span>Стоимость: {gen.cost}</span><br />
          <button className="border border-gray-300 p-1"
            onClick={() => gameManager.send('buildGenerator', { id: gen.id })}
            disabled={money < gen.cost}
          >
            Купить
          </button>
        </div>
      ))
      
  )
}