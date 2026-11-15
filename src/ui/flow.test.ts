import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, expect, test, vi } from 'vitest';
import { CAMPAIGN, GROUPS, START_PROFILE } from '../content';
import { buyGroup } from '../sim';
import { SAVE_KEY } from './save';

/** Свежий модуль потока поверх подставного localStorage: стартовый профиль берётся при загрузке модуля. */
async function boot(initial?: string, storage?: object) {
  vi.resetModules();
  const mem = new Map<string, string>(initial === undefined ? [] : [[SAVE_KEY, initial]]);
  vi.stubGlobal(
    'localStorage',
    storage ?? { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) },
  );
  const flow = await import('./flow');
  const store = (await import('../store/flow')).useFlowStore;
  /** Профиль, который показал бы UI: хук useFlow читаем через серверный рендер. */
  const initialProfile = () => {
    let text = '';
    const Probe = () => ((text = JSON.stringify(flow.useFlow().profile)), null);
    renderToString(createElement(Probe));
    return JSON.parse(text);
  };
  return { ...flow, mem, initialProfile, profile: () => (store.getState().flow ?? { profile: null }).profile };
}
const saved = (mem: Map<string, string>) => JSON.parse(mem.get(SAVE_KEY) ?? 'null')?.profile;

afterEach(() => vi.unstubAllGlobals());

test('нет сохранения -> стартовый профиль; мусор или чужая версия в хранилище -> тоже', async () => {
  for (const initial of [undefined, '{oops', '"x"', JSON.stringify({ version: 99, profile: { ...START_PROFILE, currency: 1 } })]) {
    const { initialProfile, mem } = await boot(initial);
    expect(initialProfile()).toEqual(START_PROFILE);
    expect(mem.get(SAVE_KEY)).toBe(initial); // чтение ничего не пишет
  }
});

test('сохранённый профиль становится стартовым', async () => {
  const profile = { ...START_PROFILE, currency: 31 };
  const { initialProfile } = await boot(JSON.stringify({ version: 1, profile }));
  // Сохранение версии 1 мигрирует: профиль цел, первые две миссии кампании открыты.
  expect(initialProfile()).toEqual({ ...profile, unlocked: CAMPAIGN.slice(0, 2) });
  const v2 = await boot(JSON.stringify({ version: 2, profile }));
  expect(v2.initialProfile()).toEqual(profile);
});

test('каждое изменение профиля пишется в хранилище, перезапуск его восстанавливает', async () => {
  const a = await boot();
  expect(a.profile()).toBeNull(); // поток не менялся — записи нет
  expect(a.mem.has(SAVE_KEY)).toBe(false);

  const bought = buyGroup({ ...START_PROFILE, currency: 500 }, GROUPS, 'c130');
  a.send({ type: 'profile', profile: bought });
  expect(saved(a.mem)).toEqual(bought);

  // «перезагрузка»: новый модуль, то же хранилище
  const b = await boot(a.mem.get(SAVE_KEY));
  expect(b.initialProfile()).toEqual(bought);
});

test('недопустимое событие и вылет профиль не пишут; запись, которая бросает, игру не ломает', async () => {
  const a = await boot();
  a.send({ type: 'home' });
  expect(a.mem.has(SAVE_KEY)).toBe(false);

  const broken = await boot(undefined, {
    getItem: () => {
      throw new Error('denied');
    },
    setItem: () => {
      throw new Error('quota');
    },
  });
  expect(() => broken.send({ type: 'profile', profile: { ...START_PROFILE, currency: 1 } })).not.toThrow();
  expect(broken.profile()).toEqual({ ...START_PROFILE, currency: 1 });
});

test('сброс прогресса: стартовый профиль в потоке и в хранилище, и он же после перезапуска', async () => {
  const a = await boot();
  a.send({ type: 'profile', profile: buyGroup({ ...START_PROFILE, currency: 500 }, GROUPS, 'c130') });
  expect(saved(a.mem).levels.c130).toBe(0);

  a.resetProgress();
  expect(a.profile()).toEqual(START_PROFILE);
  expect(saved(a.mem)).toEqual(START_PROFILE);

  const b = await boot(a.mem.get(SAVE_KEY));
  b.resetProgress(); // повторный сброс на свежем старте тоже пишет стартовый профиль
  expect(saved(b.mem)).toEqual(START_PROFILE);
});

test('обучение: флаг сохраняется в хранилище, читается после перезапуска и переживает сброс прогресса', async () => {
  const a = await boot();
  a.send({ type: 'tutorialDone' });
  expect(saved(a.mem).tutorialDone).toBe(true);

  const b = await boot(a.mem.get(SAVE_KEY));
  expect(b.initialProfile().tutorialDone).toBe(true);
  b.resetProgress();
  expect(saved(b.mem)).toEqual({ ...START_PROFILE, tutorialDone: true });
});
