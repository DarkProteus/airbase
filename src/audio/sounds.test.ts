import { expect, test } from 'vitest';
import type { SimEvent } from '../sim';
import { loadMuted, MUTE_KEY, saveMuted } from './storage';
import { createThrottle, pickSounds, soundsForEvents, VOICES } from './sounds';

const shot = (n: number): SimEvent => ({ type: 'groupShot', group: n, enemy: 1, damage: 1 });

test('события -> звуки: groupShot(shot), kill, leak(baseHit), waveStart; прочее и будущие события игнорируются', () => {
  const events = [
    shot(1),
    shot(2),
    { type: 'kill', enemy: 1, reward: 5 },
    { type: 'leak', enemy: 2, damage: 1 },
    { type: 'waveStart', wave: 0 },
    { type: 'income', group: 1, amount: 3 },
    { type: 'sortieDone', group: 1, sortie: 1 },
    { type: 'future' },
  ] as unknown as SimEvent[];
  // Много выстрелов в пакете -> один звук выстрела.
  expect(soundsForEvents(events)).toEqual(['shot', 'kill', 'baseHit', 'wave']);
  expect(soundsForEvents([])).toEqual([]);
});

test('все звуки из маппинга описаны голосами', () => {
  for (const id of soundsForEvents([shot(1), { type: 'kill', enemy: 1, reward: 1 }, { type: 'leak', enemy: 1, damage: 1 }, { type: 'waveStart', wave: 0 }]))
    expect(VOICES[id].notes.length).toBeGreaterThan(0);
});

test('троттлинг: частый звук не чаще minInterval, разные звуки независимы', () => {
  const allow = createThrottle({ shot: { minInterval: 100 }, kill: { minInterval: 50 }, baseHit: { minInterval: 10 }, wave: { minInterval: 10 } });
  expect(allow('shot', 0)).toBe(true);
  expect(allow('shot', 99)).toBe(false);
  expect(allow('kill', 99)).toBe(true);
  expect(allow('shot', 100)).toBe(true);
  expect(allow('shot', 150)).toBe(false);
});

test('pickSounds: mute глушит всё и не расходует троттлер; иначе фильтрует по троттлеру', () => {
  const allow = createThrottle();
  const ev = [shot(1)];
  expect(pickSounds(ev, true, allow, 0)).toEqual([]);
  expect(pickSounds(ev, false, allow, 0)).toEqual(['shot']);
  expect(pickSounds(ev, false, allow, 1)).toEqual([]);
  expect(pickSounds(ev, false, allow, 1000)).toEqual(['shot']);
});

test('mute: сохранение и чтение через localStorage, ошибки хранилища не падают', () => {
  const mem = new Map<string, string>();
  const storage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) };
  expect(loadMuted(storage)).toBe(false);
  saveMuted(true, storage);
  expect(mem.get(MUTE_KEY)).toBe('1');
  expect(loadMuted(storage)).toBe(true);
  saveMuted(false, storage);
  expect(loadMuted(storage)).toBe(false);
  const broken = {
    getItem: () => {
      throw new Error('denied');
    },
    setItem: () => {
      throw new Error('denied');
    },
  };
  expect(loadMuted(broken)).toBe(false);
  expect(() => saveMuted(true, broken)).not.toThrow();
});
