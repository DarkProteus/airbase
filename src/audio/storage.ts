/** Сохранение mute в localStorage; любые обращения к хранилищу — в try/catch (приватный режим, node, запрет). */

export const MUTE_KEY = 'airbase.muted';

type ReadStorage = Pick<Storage, 'getItem'>;
type WriteStorage = Pick<Storage, 'setItem'>;

/** localStorage может бросать при самом обращении к свойству. */
export function defaultStorage(): Storage | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

export function loadMuted(storage: ReadStorage | undefined = defaultStorage()): boolean {
  try {
    return storage?.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

export function saveMuted(muted: boolean, storage: WriteStorage | undefined = defaultStorage()): void {
  try {
    storage?.setItem(MUTE_KEY, muted ? '1' : '0');
  } catch {
    // Не удалось сохранить — mute действует до перезагрузки.
  }
}
