import { create } from 'zustand';

/** Только UI-состояние галереи; расчёты — в src/ui/entity/model.ts. */
interface GalleryState {
  /** Уровень улучшения по id группы. */
  levels: Record<string, number>;
  /** Включённые «что-если» источники аур (id групп). */
  activeSources: string[];
  /** Дополнительные теги, добавленные всем превью. */
  activeTags: string[];
  setLevel: (groupId: string, level: number) => void;
  toggleSource: (groupId: string) => void;
  toggleTag: (tag: string) => void;
  reset: () => void;
}

const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

export const useGalleryStore = create<GalleryState>((set) => ({
  levels: {},
  activeSources: [],
  activeTags: [],
  setLevel: (groupId, level) => set((s) => ({ levels: { ...s.levels, [groupId]: level } })),
  toggleSource: (id) => set((s) => ({ activeSources: toggle(s.activeSources, id) })),
  toggleTag: (tag) => set((s) => ({ activeTags: toggle(s.activeTags, tag) })),
  reset: () => set({ levels: {}, activeSources: [], activeTags: [] }),
}));
