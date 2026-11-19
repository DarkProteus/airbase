import { describe, expect, test } from 'vitest';
import { CONTENT, DEFAULT_ZONES, GROUPS, LINEUP_SIZE, MISSIONS, START_PROFILE } from '../content';
import { buyGroup, buyRejection, createSim, groupStats, lineupRejection, profileLineup, sortieRejection, toggleLineup, upgradeGroup, upgradeRejection } from '.';
import type { Profile } from '.';

/** Профиль для проверок механики базы: две группы из трёх и валюта на покупку — не зависит от баланса стартового профиля. */
const P: Profile = { currency: 200, levels: { f16: 0, a10: 0 }, lineup: ['f16', 'a10'] };

const buy = (p: Profile, id: string) => buyGroup(p, GROUPS, id);
const up = (p: Profile, id: string) => upgradeGroup(p, GROUPS, id);
const toggle = (p: Profile, id: string) => toggleLineup(p, GROUPS, id, LINEUP_SIZE);

describe('покупка и улучшение', () => {
  test('покупка списывает ровно цену группы, группа в профиле на уровне 0', () => {
    const p = buy(P, 'c130');
    expect(p.currency).toBe(P.currency - GROUPS.c130!.cost);
    expect(p.levels.c130).toBe(0);
    expect(P.levels.c130).toBeUndefined(); // исходный профиль не мутирован
  });

  test('улучшение списывает ровно цену следующего уровня', () => {
    const p = up(P, 'f16');
    expect(p.currency).toBe(P.currency - GROUPS.f16!.upgrades[0]!.cost);
    expect(p.levels.f16).toBe(1);
    const rich = { ...p, currency: 500 };
    expect(up(rich, 'f16').currency).toBe(500 - GROUPS.f16!.upgrades[1]!.cost);
  });

  test('отказ: нехватка валюты, повторная покупка, неизвестная группа — профиль не меняется', () => {
    const poor: Profile = { ...P, currency: 99 };
    expect(buyRejection(poor, GROUPS, 'growler')).toBe('notEnoughCurrency');
    expect(buy(poor, 'growler')).toBe(poor);
    expect(buyRejection(P, GROUPS, 'f16')).toBe('alreadyOwned');
    expect(buy(P, 'f16')).toBe(P);
    expect(buyRejection(P, GROUPS, 'nope')).toBe('unknownGroup');
    expect(buy(P, 'nope')).toBe(P);
  });

  test('отказ улучшения: не куплена, нехватка валюты, максимальный уровень', () => {
    expect(upgradeRejection(P, GROUPS, 'c130')).toBe('notOwned');
    expect(up(P, 'c130')).toBe(P);
    const poor: Profile = { ...P, currency: 79 };
    expect(upgradeRejection(poor, GROUPS, 'f16')).toBe('notEnoughCurrency');
    expect(up(poor, 'f16')).toBe(poor);
    const rich: Profile = { ...P, currency: 10_000 };
    const maxed = upgradeGroup(up(up(rich, 'f16'), 'f16'), GROUPS, 'f16', 'hunter');
    expect(maxed.levels.f16).toBe(GROUPS.f16!.upgrades.length);
    expect(upgradeRejection(maxed, GROUPS, 'f16')).toBe('maxLevel');
    expect(up(maxed, 'f16')).toBe(maxed);
    expect(upgradeRejection(rich, GROUPS, 'nope')).toBe('unknownGroup');
  });

  test('сценарий базы на 200 валюты: C-130 за 90, улучшение за 100, в состав', () => {
    // 200 - 90 = 110, 110 - 100 = 10: хватает ровно на оба шага.
    const bought = buy(P, 'c130');
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
    expect(lineupRejection(P, GROUPS, 'growler', LINEUP_SIZE)).toBe('notOwned');
    expect(toggle(P, 'growler')).toBe(P);
    expect(lineupRejection(P, GROUPS, 'nope', LINEUP_SIZE)).toBe('unknownGroup');
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
    expect(sortieRejection(P, LINEUP_SIZE)).toBe('lineupIncomplete');
    expect(sortieRejection({ ...P, lineup: [] }, LINEUP_SIZE)).toBe('lineupIncomplete');
    expect(sortieRejection({ ...P, lineup: ['f16', 'a10', 'c130'] }, LINEUP_SIZE)).toBeUndefined();
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
    // Уровень 2 даёт скорострельность сразу в матче (TASK-43: боекомплект за вылет не кончался, и запас ничего не менял).
    const lvl2 = lineupOf(2).state.groups[0]!;
    expect(stats(lvl2).weapons[0]!.fireRate).toBeCloseTo(GROUPS.f16!.weapons[0]!.fireRate * 1.15);
    expect(lvl2.ammo).toBe(base!.ammo);
  });
});

describe('START_PROFILE', () => {
  test('валиден: id из реестра, уровни в пределах, состав полный, из купленных, без повторов', () => {
    for (const [id, level] of Object.entries(START_PROFILE.levels)) {
      expect(GROUPS[id]).toBeDefined();
      expect(level).toBeGreaterThanOrEqual(0);
      expect(level).toBeLessThanOrEqual(GROUPS[id]!.upgrades.length);
    }
    for (const id of START_PROFILE.lineup) expect(START_PROFILE.levels[id]).toBeDefined();
    expect(new Set(START_PROFILE.lineup).size).toBe(START_PROFILE.lineup.length);
    // Состав полный: первый вылет возможен без покупок.
    expect(START_PROFILE.lineup.length).toBe(LINEUP_SIZE);
    expect(DEFAULT_ZONES.length).toBeGreaterThanOrEqual(LINEUP_SIZE);
  });
});
