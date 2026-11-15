import { create } from 'zustand';
import type { Flow } from '../sim';

/** Поток экранов (база/бой/итог) с профилем: только хранение; переходы — чистая `flowStep` из sim, её вызывает UI-слой. */
interface FlowState {
  /** null — поток ещё не менялся, UI берёт стартовый (с профилем из контента). */
  flow: Flow | null;
  setFlow: (flow: Flow) => void;
}

export const useFlowStore = create<FlowState>((set) => ({
  flow: null,
  setFlow: (flow) => set({ flow }),
}));
