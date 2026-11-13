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
  /** Выбранная карточка магазина (id юнита из конфигов). */
  shopSelection: string | null;
  /** Выбранный юнит на карте (UnitState.id). Выбор магазина и юнита взаимоисключающие. */
  selectedUnit: number | null;
  notice: Notice | null;
  selectShop: (unit: string | null) => void;
  selectUnit: (unit: number | null) => void;
  setNotice: (text: string | null) => void;
}

export const useGameStore = create<GameState>((set) => ({
  snapshot: null,
  setSnapshot: (snapshot) => set({ snapshot }),
  shopSelection: null,
  selectedUnit: null,
  notice: null,
  selectShop: (unit) => set({ shopSelection: unit, selectedUnit: null }),
  selectUnit: (unit) => set({ selectedUnit: unit, shopSelection: null }),
  setNotice: (text) => set((s) => ({ notice: text === null ? null : { text, seq: (s.notice?.seq ?? 0) + 1 } })),
}));
