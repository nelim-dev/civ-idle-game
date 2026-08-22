import { create } from 'zustand';
import { ResourceData } from '@/logic/services/Economy/ResourceSystem/Resource';

interface IBalanceHistoryUI {
    count: string,
    income: string,
    expense: string
}

export interface GameState{
gameStep: number;
gameSpeed: number;

economy: {
    resources: Record<string,ResourceData>;
    balanceHistory: Record<string, IBalanceHistoryUI[]>;
    balanceHistoryLength: number;
}
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