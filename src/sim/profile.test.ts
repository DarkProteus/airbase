import { describe, expect, test } from 'vitest';
import { CONTENT, DEFAULT_ZONES, GROUPS, LINEUP_SIZE, MISSIONS, START_PROFILE } from '../content';
import { buyGroup, buyRejection, createSim, groupStats, lineupRejection, profileLineup, sortieRejection, toggleLineup, upgradeGroup, upgradeRejection } from '.';
import type { Profile } from '.';

const buy = (p: Profile, id: string) => buyGroup(p, GROUPS, id);
const up = (p: Profile, id: string) => upgradeGroup(p, GROUPS, id);
const toggle = (p: Profile, id: string) => toggleLineup(p, GROUPS, id, LINEUP_SIZE);

describe('покупка и улучшение', () => {
  test('покупка списывает ровно цену группы, группа в профиле на уровне 0', () => {
    const p = buy(START_PROFILE, 'c130');
    expect(p.currency).toBe(START_PROFILE.currency - GROUPS.c130!.cost);
    expect(p.levels.c130).toBe(0);
    expect(START_PROFILE.levels.c130).toBeUndefined(); // исходный профиль не мутирован
  });

  test('улучшение списывает ровно цену следующего уровня', () => {
    const p = up(START_PROFILE, 'f16');
    expect(p.currency).toBe(START_PROFILE.currency - GROUPS.f16!.upgrades[0]!.cost);
    expect(p.levels.f16).toBe(1);
    const rich = { ...p, currency: 500 };
    expect(up(rich, 'f16').currency).toBe(500 - GROUPS.f16!.upgrades[1]!.cost);
  });

  test('отказ: нехватка валюты, повторная покупка, неизвестная группа — профиль не меняется', () => {
    const poor: Profile = { ...START_PROFILE, currency: 99 };
    expect(buyRejection(poor, GROUPS, 'growler')).toBe('notEnoughCurrency');
    expect(buy(poor, 'growler')).toBe(poor);
    expect(buyRejection(START_PROFILE, GROUPS, 'f16')).toBe('alreadyOwned');
    expect(buy(START_PROFILE, 'f16')).toBe(START_PROFILE);
    expect(buyRejection(START_PROFILE, GROUPS, 'nope')).toBe('unknownGroup');
    expect(buy(START_PROFILE, 'nope')).toBe(START_PROFILE);
  });

  test('отказ улучшения: не куплена, нехватка валюты, максимальный уровень', () => {
    expect(upgradeRejection(START_PROFILE, GROUPS, 'c130')).toBe('notOwned');
    expect(up(START_PROFILE, 'c130')).toBe(START_PROFILE);
    const poor: Profile = { ...START_PROFILE, currency: 79 };
    expect(upgradeRejection(poor, GROUPS, 'f16')).toBe('notEnoughCurrency');
    expect(up(poor, 'f16')).toBe(poor);
    const rich: Profile = { ...START_PROFILE, currency: 10_000 };
    const maxed = up(up(rich, 'f16'), 'f16');
    expect(maxed.levels.f16).toBe(GROUPS.f16!.upgrades.length);
    expect(upgradeRejection(maxed, GROUPS, 'f16')).toBe('maxLevel');
    expect(up(maxed, 'f16')).toBe(maxed);
    expect(upgradeRejection(rich, GROUPS, 'nope')).toBe('unknownGroup');
  });

  test('сценарий базы на 200 валюты: C-130 за 90, улучшение за 100, в состав', () => {
    // 200 - 90 = 110, 110 - 100 = 10: хватает ровно на оба шага.
    const bought = buy(START_PROFILE, 'c130');
    const upgraded = up(bought, 'c130');
    expect(upgraded.currency).toBe(10);
    expect(upgraded.levels.c130).toBe(1);
    const full = toggle(upgraded, 'c130');
    expect(full.lineup).toEqual(['f16', 'a10', 'c130']);
    expect(sortieRejection(full, LINEUP_SIZE)).toBeUndefined();
  });
});

describe('состав на вылет', () => {
  test('в состав попадают только купленные группы', () => {
    expect(lineupRejection(START_PROFILE, GROUPS, 'growler', LINEUP_SIZE)).toBe('notOwned');
    expect(toggle(START_PROFILE, 'growler')).toBe(START_PROFILE);
    expect(lineupRejection(START_PROFILE, GROUPS, 'nope', LINEUP_SIZE)).toBe('unknownGroup');
  });

  test('не больше размера состава; снять группу можно всегда', () => {
    const owned: Profile = { currency: 0, levels: { f16: 0, a10: 0, growler: 0, c130: 0 }, lineup: [] };
    let p = owned;
    for (const id of ['f16', 'a10', 'growler']) p = toggle(p, id);
    expect(p.lineup).toEqual(['f16', 'a10', 'growler']);
    expect(lineupRejection(p, GROUPS, 'c130', LINEUP_SIZE)).toBe('lineupFull');
    expect(toggle(p, 'c130')).toBe(p);
    const removed = toggle(p, 'a10');
    expect(removed.lineup).toEqual(['f16', 'growler']);
    expect(toggle(removed, 'c130').lineup).toEqual(['f16', 'growler', 'c130']);
  });

  test('вылет недоступен при неполном составе и доступен при ровно 3', () => {
    expect(sortieRejection(START_PROFILE, LINEUP_SIZE)).toBe('lineupIncomplete');
    expect(sortieRejection({ ...START_PROFILE, lineup: [] }, LINEUP_SIZE)).toBe('lineupIncomplete');
    expect(sortieRejection({ ...START_PROFILE, lineup: ['f16', 'a10', 'c130'] }, LINEUP_SIZE)).toBeUndefined();
  });
});

describe('уровень профиля в бою', () => {
  const mission = Object.values(MISSIONS)[0]!;
  const lineupOf = (f16Level: number) => {
    const profile: Profile = { currency: 0, levels: { f16: f16Level, a10: 0, growler: 0 }, lineup: ['f16', 'a10', 'growler'] };
    return createSim(mission, CONTENT, 1, profileLineup(profile, DEFAULT_ZONES));
  };

  test('profileLineup берёт уровни из профиля, зоны по слотам', () => {
    const profile: Profile = { currency: 0, levels: { f16: 1, a10: 2 }, lineup: ['a10', 'f16'] };
    expect(profileLineup(profile, DEFAULT_ZONES)).toEqual([
      { group: 'a10', level: 2, zone: DEFAULT_ZONES[0] },
      { group: 'f16', level: 1, zone: DEFAULT_ZONES[1] },
    ]);
    expect(() => profileLineup(profile, [])).toThrow();
  });

  test('уровень улучшения меняет боевые параметры группы по модификаторам конфига', () => {
    const [base, upgraded] = [0, 1].map((lv) => lineupOf(lv).state.groups[0]!);
    expect([base!.type, base!.level, upgraded!.level]).toEqual(['f16', 0, 1]);
    const stats = (g: typeof base) => groupStats({ content: CONTENT }, g!);
    const dmg0 = stats(base).weapons[0]!.damage;
    const dmg1 = stats(upgraded).weapons[0]!.damage;
    expect(dmg0).toBe(GROUPS.f16!.weapons[0]!.damage);
    expect(dmg1).toBeCloseTo(dmg0 * 1.3);
    // Уровень 2 даёт запас боекомплекта сразу в матче.
    const lvl2 = lineupOf(2).state.groups[0]!;
    expect(lvl2.ammo).toBe(base!.ammo + 16);
  });
});

describe('START_PROFILE', () => {
  test('валиден: id из реестра, уровни в пределах, состав из купленных без повторов', () => {
    for (const [id, level] of Object.entries(START_PROFILE.levels)) {
      expect(GROUPS[id]).toBeDefined();
      expect(level).toBeGreaterThanOrEqual(0);
      expect(level).toBeLessThanOrEqual(GROUPS[id]!.upgrades.length);
    }
    for (const id of START_PROFILE.lineup) expect(START_PROFILE.levels[id]).toBeDefined();
    expect(new Set(START_PROFILE.lineup).size).toBe(START_PROFILE.lineup.length);
    expect(START_PROFILE.lineup.length).toBeLessThan(LINEUP_SIZE);
    expect(DEFAULT_ZONES.length).toBeGreaterThanOrEqual(LINEUP_SIZE);
  });
});
