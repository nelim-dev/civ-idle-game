import { create } from 'zustand';

interface GameState{
coins: number;
gameSpeed: number;
income: number;
}

export const useGameStore = create<GameState>((set,get) => ({

coins: 0,
gameSpeed: 1,
income: 1,
}))