import { create } from 'zustand';
import { GeneratorData } from '@/logic/services/Economy/Generator';
export interface GameState{
gameStep: number;
gameSpeed: number;

economy: {
    resources: Record<string,string>;
    generators: GeneratorData[];
}
}

export const useGameStore = create<GameState>((set,get) => ({
gameStep: 0,
gameSpeed: 1,
economy: {
    income: 1,
    generators: [],
    resources: {}
}
}))