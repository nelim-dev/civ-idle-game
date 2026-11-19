'use client';

import { useState } from 'react';
import type { ResourceData } from "@/shared/types/Resource";
import { ResourceItem } from './ResourceItem';

interface ResourceGroupProps {
  title: string;
  resources: ResourceData[];
}

export function ResourceGroup({ title, resources }: ResourceGroupProps) {
  const [isOpen, setIsOpen] = useState(true);

  // Сортировка по алфавиту
  const sortedResources = [...resources].sort((a, b) => a.name.localeCompare(b.name));

  if (resources.length === 0) return null; // не показываем пустые группы

  return (
    <div className="mb-4">
      <div
        className="flex items-center gap-2 cursor-pointer font-bold text-lg"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span>{isOpen ? '▼' : '▶'}</span>
        <span>{title}</span>
        <span className="text-sm font-normal text-gray-500">({resources.length})</span>
      </div>
      {isOpen && (
        <div className="flex flex-col gap-2 mt-2">
          {sortedResources.map((res) => (
            <ResourceItem key={res.id} resource={res} />
          ))}
        </div>
      )}
    </div>
  );
}