import { create } from 'zustand';
import { loadMuted, saveMuted } from './storage';

/** UI-состояние звука: только mute (с сохранением). Логики воспроизведения здесь нет. */
interface AudioState {
  muted: boolean;
  setMuted: (muted: boolean) => void;
}

export const useAudioStore = create<AudioState>((set) => ({
  muted: loadMuted(),
  setMuted: (muted) => {
    saveMuted(muted);
    set({ muted });
  },
}));
