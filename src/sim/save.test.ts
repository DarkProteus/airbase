import { describe, expect, test } from 'vitest';
import { GROUPS, LINEUP_SIZE, START_PROFILE } from '../content';
import { parseProfile, SAVE_VERSION, serializeProfile } from '.';
import type { Profile } from '.';

const parse = (raw: string | null | undefined) => parseProfile(raw, GROUPS, LINEUP_SIZE);
const save = (profile: unknown, version: unknown = SAVE_VERSION) => JSON.stringify({ version, profile });

const RICH: Profile = { currency: 1234, levels: { f16: 2, a10: 0, c130: 1 }, lineup: ['c130', 'f16', 'a10'] };

describe('сериализация профиля', () => {
  test('serialize -> parse возвращает тот же профиль (стартовый и накопленный)', () => {
    expect(parse(serializeProfile(START_PROFILE))).toEqual(START_PROFILE);
    expect(parse(serializeProfile(RICH))).toEqual(RICH);
  });

  test('формат версионирован: { version, profile }', () => {
    expect(JSON.parse(serializeProfile(START_PROFILE))).toEqual({ version: SAVE_VERSION, profile: START_PROFILE });
  });
});

describe('мусор и чужие данные -> undefined, без исключений', () => {
  const garbage: [string, string | null | undefined][] = [
    ['null', null],
    ['undefined', undefined],
    ['пустая строка', ''],
    ['не JSON', '{oops'],
    ['примитив', '42'],
    ['null в JSON', 'null'],
    ['массив', '[]'],
    ['без профиля', JSON.stringify({ version: SAVE_VERSION })],
  ];
  test.each(garbage)('%s', (_name, raw) => {
    expect(parse(raw)).toBeUndefined();
  });

  test('неизвестная версия (старше и новее) и отсутствующая версия', () => {
    expect(parse(save(START_PROFILE, 0))).toBeUndefined();
    expect(parse(save(START_PROFILE, SAVE_VERSION + 1))).toBeUndefined();
    expect(parse(save(START_PROFILE, '1'))).toBeUndefined();
    expect(parse(JSON.stringify({ profile: START_PROFILE }))).toBeUndefined();
  });

  test('неверная форма профиля', () => {
    const bad: unknown[] = [
      null,
      [],
      { ...START_PROFILE, currency: -1 },
      { ...START_PROFILE, currency: '200' },
      { ...START_PROFILE, currency: null }, // NaN/Infinity в JSON превращаются в null
      { ...START_PROFILE, currency: undefined },
      { ...START_PROFILE, levels: [] },
      { ...START_PROFILE, levels: null },
      { ...START_PROFILE, levels: { f16: -1 } },
      { ...START_PROFILE, levels: { f16: 1.5 } },
      { ...START_PROFILE, levels: { f16: '1' } },
      { ...START_PROFILE, lineup: 'f16' },
      { ...START_PROFILE, lineup: ['f16', 3] },
      { ...START_PROFILE, lineup: undefined },
    ];
    for (const profile of bad) expect(parse(save(profile)), JSON.stringify(profile)).toBeUndefined();
  });

  test('нечисловая валюта, которой нет в JSON, — тоже отказ', () => {
    expect(parseProfile('{"version":1,"profile":{"currency":1e999,"levels":{},"lineup":[]}}', GROUPS, LINEUP_SIZE)).toBeUndefined();
  });
});

describe('устаревшее по контенту: прогресс сохраняется, лишнее выкидывается', () => {
  test('группы, которых нет в реестре, убираются из уровней и состава; остальное цело', () => {
    const stale = { currency: 50, levels: { f16: 1, gone: 3 }, lineup: ['gone', 'f16'] };
    expect(parse(save(stale))).toEqual({ currency: 50, levels: { f16: 1 }, lineup: ['f16'] });
  });

  test('имена из прототипа и __proto__ не считаются группами', () => {
    const raw = '{"version":1,"profile":{"currency":1,"levels":{"toString":0,"constructor":0,"__proto__":0,"f16":0},"lineup":["toString","f16"]}}';
    const p = parse(raw)!;
    expect(p.levels).toEqual({ f16: 0 });
    expect(Object.getPrototypeOf(p.levels)).toBe(Object.prototype);
    expect(p.lineup).toEqual(['f16']);
  });

  test('уровень выше максимума срезается до максимума', () => {
    const p = parse(save({ currency: 0, levels: { f16: 99 }, lineup: [] }))!;
    expect(p.levels.f16).toBe(GROUPS.f16!.upgrades.length);
  });

  test('в составе: нет непокупных групп, дублей и слотов сверх размера', () => {
    const all = Object.keys(GROUPS);
    const levels = Object.fromEntries(all.map((id) => [id, 0]));
    const p = parse(save({ currency: 0, levels: { ...levels }, lineup: [all[0], all[0], ...all] }))!;
    expect(p.lineup).toEqual(all.slice(0, LINEUP_SIZE));
    const notOwned = parse(save({ currency: 0, levels: { f16: 0 }, lineup: ['a10', 'f16'] }))!;
    expect(notOwned.lineup).toEqual(['f16']);
  });

  test('исходный объект ввода не нужен: результат — новый профиль', () => {
    const raw = serializeProfile(START_PROFILE);
    expect(parse(raw)).not.toBe(START_PROFILE);
  });
});

describe('флаг обучения (tutorialDone)', () => {
  test('сохранение старого формата (без флага) читается целиком, обучение не пройдено', () => {
    const old = '{"version":1,"profile":{"currency":1234,"levels":{"f16":2,"a10":0,"c130":1},"lineup":["c130","f16","a10"]}}';
    const p = parse(old)!;
    expect(p).toEqual(RICH);
    expect(p.tutorialDone).toBeUndefined();
  });

  test('флаг пишется и читается; версия формата прежняя', () => {
    const done: Profile = { ...RICH, tutorialDone: true };
    expect(parse(serializeProfile(done))).toEqual(done);
    expect(JSON.parse(serializeProfile(done)).version).toBe(1);
  });

  test('мусор вместо флага не отбрасывает прогресс: обучение считается не пройденным', () => {
    for (const bad of ['yes', 1, null, [], {}, false]) {
      const p = parse(save({ ...RICH, tutorialDone: bad }))!;
      expect(p, JSON.stringify(bad)).toEqual(RICH);
      expect('tutorialDone' in p).toBe(false);
    }
  });
});
