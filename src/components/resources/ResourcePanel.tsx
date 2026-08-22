'use client';

import { useGameStore } from '@/store/gameStore';
import { ResourceGroup } from './ResourceGroup';

export function ResourcePanel() {
  const resources = useGameStore((state) => state.economy.resources);
  const resourcesArray = Object.values(resources);

  // Фильтруем по владельцу
  const playerResources = resourcesArray.filter((r) => r.owner === 'player');
  const natureResources = resourcesArray.filter((r) => r.owner === 'nature');

  return (
    <div className="w-1/5 h-full bg-black-100 p-4 overflow-y-auto border-r">
      <h2 className="text-xl font-bold mb-4">Ресурсы</h2>
      <ResourceGroup title="Ресурсы игрока" resources={playerResources} />
      <ResourceGroup title="Природные запасы" resources={natureResources} />
    </div>
  );
}