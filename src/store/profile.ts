import { create } from 'zustand';
import type { Profile } from '../sim';

/** Профиль игрока: только хранение; операции над ним — в sim (src/sim/profile.ts). */
interface ProfileState {
  /** null — профиль ещё не менялся, экраны берут стартовый из контента. */
  profile: Profile | null;
  setProfile: (profile: Profile) => void;
}

export const useProfileStore = create<ProfileState>((set) => ({
  profile: null,
  setProfile: (profile) => set({ profile }),
}));
