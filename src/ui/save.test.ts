import { expect, test } from 'vitest';
import { START_PROFILE } from '../content';
import { SAVE_VERSION } from '../sim';
import { loadProfile, SAVE_KEY, saveProfile } from './save';

const memory = (initial?: string) => {
  const mem = new Map<string, string>(initial === undefined ? [] : [[SAVE_KEY, initial]]);
  return { mem, getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) };
};
const broken = {
  getItem: () => {
    throw new Error('denied');
  },
  setItem: () => {
    throw new Error('quota');
  },
};

test('ключ хранилища с префиксом airbase:, формат версионирован', () => {
  expect(SAVE_KEY.startsWith('airbase:')).toBe(true);
  const s = memory();
  saveProfile(START_PROFILE, s);
  expect(JSON.parse(s.mem.get(SAVE_KEY)!)).toEqual({ version: SAVE_VERSION, profile: START_PROFILE });
});

test('сохранённый профиль читается обратно', () => {
  const s = memory();
  const profile = { currency: 77, levels: { f16: 1, a10: 0, c130: 0 }, lineup: ['f16', 'a10', 'c130'] };
  saveProfile(profile, s);
  expect(loadProfile(s)).toEqual(profile);
});

test('нет записи, мусор или старая версия -> undefined (старт со стартовым профилем)', () => {
  expect(loadProfile(memory())).toBeUndefined();
  expect(loadProfile(memory('{oops'))).toBeUndefined();
  expect(loadProfile(memory(JSON.stringify({ version: SAVE_VERSION + 1, profile: START_PROFILE })))).toBeUndefined();
  expect(loadProfile(memory(JSON.stringify({ version: SAVE_VERSION, profile: { currency: 'x' } })))).toBeUndefined();
});

test('недоступное хранилище не бросает ни при чтении, ни при записи', () => {
  expect(loadProfile(broken)).toBeUndefined();
  expect(() => saveProfile(START_PROFILE, broken)).not.toThrow();
  expect(loadProfile(undefined)).toBeUndefined();
  expect(() => saveProfile(START_PROFILE, undefined)).not.toThrow();
});
