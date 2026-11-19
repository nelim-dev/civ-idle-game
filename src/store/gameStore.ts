import { create } from 'zustand';
import type { EconomySnapshot } from '@/shared/types/Economy';

export interface GameState{
gameStep: number;
gameSpeed: number;

economy: EconomySnapshot;
}

export const useGameStore = create<GameState>((set,get) => ({
gameStep: 0,
gameSpeed: 1,
economy: {
    resources: {},
    balanceHistory: {},
    balanceHistoryLength: 0
}
}))