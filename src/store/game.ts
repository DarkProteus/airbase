import { create } from 'zustand';
import type { SimState } from '../sim';

/** Только снапшот симуляции для UI/рендера; логики и мутаций матча здесь нет. */
interface GameState {
  snapshot: SimState | null;
  setSnapshot: (snapshot: SimState | null) => void;
}

export const useGameStore = create<GameState>((set) => ({
  snapshot: null,
  setSnapshot: (snapshot) => set({ snapshot }),
}));
