import { defaultStorage } from '../audio/storage';
import { GROUPS, LINEUP_SIZE } from '../content';
import { parseProfile, serializeProfile } from '../sim';
import type { Profile } from '../sim';

/** Ключ сохранения: префикс `airbase:` — localStorage на github.io общий для всех проектов домена. */
export const SAVE_KEY = 'airbase:save';

type Store = Pick<Storage, 'getItem' | 'setItem'>;

/** Сохранённый профиль; нет записи, мусор, чужая версия или недоступное хранилище -> undefined (старт с нуля). */
export function loadProfile(storage: Pick<Storage, 'getItem'> | undefined = defaultStorage()): Profile | undefined {
  try {
    return parseProfile(storage?.getItem(SAVE_KEY), GROUPS, LINEUP_SIZE);
  } catch {
    return undefined;
  }
}

/** Запись профиля; квота, приватный режим и т.п. игру не ломают — прогресс живёт до перезагрузки. */
export function saveProfile(profile: Profile, storage: Pick<Store, 'setItem'> | undefined = defaultStorage()): void {
  try {
    storage?.setItem(SAVE_KEY, serializeProfile(profile));
  } catch {
    // Не удалось сохранить — профиль действует до перезагрузки.
  }
}
