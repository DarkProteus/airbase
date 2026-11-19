import { expect, test } from 'vitest';
import { GROUPS } from '../content';
import type { WeaponConfig } from '../sim';
import { shotKindOf, shotWeapon } from './shots';

test('вид выстрела берётся из данных оружия: явное поле, иначе тяжёлый редкий выстрел — ракета', () => {
  expect(shotKindOf({ damage: 12, fireRate: 2.5 })).toBe('gun');
  expect(shotKindOf({ damage: 45, fireRate: 1.2 })).toBe('missile');
  expect(shotKindOf({ damage: 45, fireRate: 1.2, shot: 'gun' })).toBe('gun');
  expect(shotKindOf({ damage: 5, fireRate: 9, shot: 'missile' })).toBe('missile');
  // контент: оружие разных групп различается
  expect(shotKindOf(GROUPS.f16!.weapons[0]!)).toBe('gun');
  expect(shotKindOf(GROUPS.a10!.weapons[0]!)).toBe('missile');
});

test('shotWeapon: из оружия группы выбирается то, что бьёт цель и ближе по урону (с учётом модификаторов)', () => {
  const gun: WeaponConfig = { damage: 10, fireRate: 5, targetTags: ['air'], shot: 'gun' };
  const rocket: WeaponConfig = { damage: 60, fireRate: 0.5, targetTags: ['air', 'ground'], shot: 'missile' };
  expect(shotWeapon([gun, rocket], ['air'], 12)).toBe(gun);
  expect(shotWeapon([gun, rocket], ['air'], 70)).toBe(rocket);
  expect(shotWeapon([gun, rocket], ['ground'], 12)).toBe(rocket); // пушка по земле не бьёт
  expect(shotWeapon([gun], ['ground'], 12)).toBeUndefined();
  expect(shotWeapon([], ['air'], 5)).toBeUndefined();
});
