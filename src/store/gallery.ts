import { create } from 'zustand';

/** Только UI-состояние галереи; расчёты — в src/ui/entity/model.ts. */
interface GalleryState {
  /** Уровень улучшения по id группы. */
  levels: Record<string, number>;
  /** Включённые «что-если» модификаторы (ключи пула). */
  activeModifiers: string[];
  /** Дополнительные теги, добавленные всем превью. */
  activeTags: string[];
  setLevel: (groupId: string, level: number) => void;
  toggleModifier: (key: string) => void;
  toggleTag: (tag: string) => void;
  reset: () => void;
}

const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

export const useGalleryStore = create<GalleryState>((set) => ({
  levels: {},
  activeModifiers: [],
  activeTags: [],
  setLevel: (groupId, level) => set((s) => ({ levels: { ...s.levels, [groupId]: level } })),
  toggleModifier: (key) => set((s) => ({ activeModifiers: toggle(s.activeModifiers, key) })),
  toggleTag: (tag) => set((s) => ({ activeTags: toggle(s.activeTags, tag) })),
  reset: () => set({ levels: {}, activeModifiers: [], activeTags: [] }),
}));
