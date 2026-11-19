import { expect, test } from 'vitest';
import type { SimEvent } from '../sim';
import { GROUPS } from '../content';
import { shotKindOf } from '../view/shots';
import { loadMuted, MUTE_KEY, saveMuted } from './storage';
import { createThrottle, outcomeSound, pickSounds, shotKindFor, soundsForEvents, VOICES, WAVE_ALERT_SECONDS, waveAlertDue } from './sounds';
import type { SoundId } from './sounds';

const shot = (n: number): SimEvent => ({ type: 'groupShot', group: n, enemy: 1, damage: 1 });

const ALL_EVENTS = [
  shot(1),
  { type: 'kill', enemy: 1, reward: 1 },
  { type: 'leak', enemy: 1, damage: 1 },
  { type: 'waveStart', wave: 0 },
] as SimEvent[];

test('события -> звуки: groupShot(gun), kill, leak(baseHit), waveStart; прочее и будущие события игнорируются', () => {
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
  expect(soundsForEvents(events)).toEqual(['gun', 'kill', 'baseHit', 'wave']);
  expect(soundsForEvents([])).toEqual([]);
});

test('выстрелы: ракета и пушка звучат по-разному, вид берётся из resolver', () => {
  const kind = (ev: { group: number }) => (ev.group === 2 ? 'missile' : 'gun');
  expect(soundsForEvents([shot(1)], kind)).toEqual(['gun']);
  expect(soundsForEvents([shot(2)], kind)).toEqual(['missile']);
  expect(soundsForEvents([shot(1), shot(2)], kind)).toEqual(['gun', 'missile']);
  expect(soundsForEvents([shot(2)], () => undefined)).toEqual(['gun']);
});

test('вид выстрела по оружию группы: поле shot из конфига и запасное правило по числам', () => {
  const w = (shot: 'gun' | 'missile' | undefined, damage: number, fireRate: number) => ({ damage, fireRate, targetTags: ['air'], shot });
  expect(shotKindFor([w('missile', 5, 5)], ['air'], 5)).toBe('missile');
  expect(shotKindFor([w(undefined, 40, 1)], ['air'], 40)).toBe('missile');
  expect(shotKindFor([w(undefined, 3, 8)], ['air'], 3)).toBe('gun');
  expect(shotKindFor([w('missile', 5, 5)], ['ground'], 5)).toBeUndefined();
  // Реальный контент: у групп с оружием у каждого выстрела определился вид, ракета и пушка встречаются обе.
  const kinds = new Set(Object.values(GROUPS).flatMap((g) => g.weapons.map((x) => shotKindOf(x))));
  expect(kinds).toEqual(new Set(['gun', 'missile']));
});

test('исход и тревога: победа и поражение — разные звуки, тревога раз на волну за WAVE_ALERT_SECONDS до старта', () => {
  expect(outcomeSound('running')).toBeNull();
  expect(outcomeSound('won')).toBe('win');
  expect(outcomeSound('lost')).toBe('lose');
  expect(waveAlertDue(WAVE_ALERT_SECONDS + 0.5, 1, -1)).toBe(false);
  expect(waveAlertDue(WAVE_ALERT_SECONDS, 1, -1)).toBe(true);
  expect(waveAlertDue(1, 1, 1)).toBe(false);
  expect(waveAlertDue(1, 2, 1)).toBe(true);
  expect(waveAlertDue(null, 1, -1)).toBe(false);
});

test('все звуки описаны голосами и различимы: у каждого свой набор нот/шума, шумовые у выстрелов и взрыва', () => {
  const ids = Object.keys(VOICES) as SoundId[];
  for (const id of ids) expect(VOICES[id].notes.length + (VOICES[id].noises?.length ?? 0)).toBeGreaterThan(0);
  const fingerprints = ids.map((id) => JSON.stringify([VOICES[id].notes, VOICES[id].noises]));
  expect(new Set(fingerprints).size).toBe(ids.length);
  for (const id of ['gun', 'missile', 'kill', 'baseHit'] as const) expect(VOICES[id].noises?.length, id).toBeGreaterThan(0);
  // Взрыв: шум со скольжением среза вниз и низкий тон-хвост; победа и поражение — разные огибающие длиннее секунды.
  const kill = VOICES.kill;
  expect(kill.noises![0]!.cutoffTo).toBeLessThan(kill.noises![0]!.cutoff);
  expect(Math.min(...kill.notes.map((n) => n.to))).toBeLessThan(60);
  const span = (id: SoundId) => Math.max(...VOICES[id].notes.map((n) => n.at + n.duration));
  expect(span('win')).toBeGreaterThan(1);
  expect(span('lose')).toBeGreaterThan(1);
  expect(VOICES.win.notes.map((n) => n.wave)).not.toEqual(VOICES.lose.notes.map((n) => n.wave));
  // Исход и тревоги — важные: играют даже при перегрузе голосов.
  for (const id of ['win', 'lose', 'waveAlert', 'wave'] as const) expect(VOICES[id].essential, id).toBe(true);
});

test('троттлинг: частый звук не чаще minInterval, разные звуки независимы; очередь пушки не плотнее лимита', () => {
  const none = { minInterval: 0 };
  const allow = createThrottle({ ...VOICES, gun: { minInterval: 100 }, kill: { minInterval: 50 }, baseHit: none, wave: none });
  expect(allow('gun', 0)).toBe(true);
  expect(allow('gun', 99)).toBe(false);
  expect(allow('kill', 99)).toBe(true);
  expect(allow('gun', 100)).toBe(true);
  expect(allow('gun', 150)).toBe(false);
  // Реальные интервалы: пушка не чаще ~9 раз в секунду, ракета реже.
  expect(VOICES.gun.minInterval).toBeGreaterThanOrEqual(100);
  expect(VOICES.missile.minInterval).toBeGreaterThan(VOICES.gun.minInterval);
});

test('pickSounds: mute глушит всё и не расходует троттлер; иначе фильтрует по троттлеру; extra добавляются', () => {
  const allow = createThrottle();
  const ev = [shot(1)];
  expect(pickSounds(ev, true, allow, 0)).toEqual([]);
  expect(pickSounds(ev, true, allow, 0, { extra: ['win'] })).toEqual([]);
  expect(pickSounds(ev, false, allow, 0)).toEqual(['gun']);
  expect(pickSounds(ev, false, allow, 1)).toEqual([]);
  expect(pickSounds(ev, false, allow, 1000)).toEqual(['gun']);
  expect(pickSounds(ALL_EVENTS, false, createThrottle(), 0, { extra: ['waveAlert', 'win'] })).toEqual(['gun', 'kill', 'baseHit', 'wave', 'waveAlert', 'win']);
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
