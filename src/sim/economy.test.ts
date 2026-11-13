import { expect, test } from 'vitest';
import { GROUPS } from '../content';
import { invested, maxLevel, nextUpgradeCost } from '.';
import type { AirGroupConfig } from '.';

const group: AirGroupConfig = {
  id: 'g',
  name: 'G',
  role: 'test',
  cost: 100,
  tags: [],
  speed: 1,
  fuel: 1,
  ammo: 0,
  takeoffTime: 0,
  rearmTime: 0,
  zoneRadius: 1,
  weapons: [],
  auras: [],
  upgrades: [
    { cost: 50, modifiers: [] },
    { cost: 80, modifiers: [] },
  ],
};

test('цена следующего уровня идёт по upgrades; на максимуме улучшать некуда', () => {
  expect(maxLevel(group)).toBe(2);
  expect(nextUpgradeCost(group, 0)).toBe(50);
  expect(nextUpgradeCost(group, 1)).toBe(80);
  expect(nextUpgradeCost(group, 2)).toBeUndefined();
});

test('вложено = покупка + купленные уровни', () => {
  expect(invested(group, 0)).toBe(100);
  expect(invested(group, 1)).toBe(150);
  expect(invested(group, 2)).toBe(230);
});

test.each(Object.values(GROUPS))('$id: цены покупки и улучшений положительны', (cfg) => {
  expect(cfg.cost).toBeGreaterThan(0);
  for (let lv = 0; lv < maxLevel(cfg); lv++) expect(nextUpgradeCost(cfg, lv)).toBeGreaterThan(0);
  expect(invested(cfg, maxLevel(cfg))).toBeGreaterThan(cfg.cost);
});
