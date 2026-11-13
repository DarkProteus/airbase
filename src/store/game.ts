import { create } from 'zustand';
import type { SimState } from '../sim';

/** Сообщение игроку (например, причина отказа); seq отличает повтор того же текста. */
export interface Notice {
  text: string;
  seq: number;
}

/** Снапшот симуляции + UI-состояние выбора; игровой логики и мутаций матча здесь нет. */
interface GameState {
  snapshot: SimState | null;
  setSnapshot: (snapshot: SimState | null) => void;
  /** Выбранная авиагруппа (GroupState.id): следующий клик по карте ставит ей зону. */
  selectedGroup: number | null;
  notice: Notice | null;
  selectGroup: (group: number | null) => void;
  setNotice: (text: string | null) => void;
}

export const useGameStore = create<GameState>((set) => ({
  snapshot: null,
  setSnapshot: (snapshot) => set({ snapshot }),
  selectedGroup: null,
  notice: null,
  selectGroup: (group) => set({ selectedGroup: group }),
  setNotice: (text) => set((s) => ({ notice: text === null ? null : { text, seq: (s.notice?.seq ?? 0) + 1 } })),
}));
