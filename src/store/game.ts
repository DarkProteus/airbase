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
  /** Выбранная авиагруппа (GroupState.id): следующий клик по карте ставит ей зону. Выбор групп, юнита и магазина взаимоисключающие. */
  selectedGroup: number | null;
  notice: Notice | null;
  selectGroup: (group: number | null) => void;
  selectShop: (unit: string | null) => void;
  selectUnit: (unit: number | null) => void;
  setNotice: (text: string | null) => void;
}

export const useGameStore = create<GameState>((set) => ({
  snapshot: null,
  setSnapshot: (snapshot) => set({ snapshot }),
  shopSelection: null,
  selectedUnit: null,
  selectedGroup: null,
  notice: null,
  selectShop: (unit) => set({ shopSelection: unit, selectedUnit: null, selectedGroup: null }),
  selectUnit: (unit) => set({ selectedUnit: unit, shopSelection: null, selectedGroup: null }),
  selectGroup: (group) => set({ selectedGroup: group, shopSelection: null, selectedUnit: null }),
  setNotice: (text) => set((s) => ({ notice: text === null ? null : { text, seq: (s.notice?.seq ?? 0) + 1 } })),
}));
