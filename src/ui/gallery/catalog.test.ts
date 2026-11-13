import { expect, test } from 'vitest';
import { ENEMIES, GROUPS } from '../../content';
import type { AirGroupConfig, EnemyConfig } from '../../sim';
import { collectTags, listEnemies, listGroups, modifierPool } from './catalog';

test('галерея перечисляет ровно то, что в реестрах контента', () => {
  expect(listGroups().map((u) => u.id)).toEqual(Object.values(GROUPS).map((u) => u.id));
  expect(listEnemies().map((e) => e.id)).toEqual(Object.values(ENEMIES).map((e) => e.id));
  expect(listGroups()).toHaveLength(Object.keys(GROUPS).length);
  expect(listEnemies()).toHaveLength(Object.keys(ENEMIES).length);
  for (const u of listGroups()) expect(GROUPS[u.id]).toBe(u);
  for (const e of listEnemies()) expect(ENEMIES[e.id]).toBe(e);
});

test('новый конфиг в реестре появляется в галерее без правок', () => {
  const enemy: EnemyConfig = { id: 'zz', name: 'ZZ', hp: 1, speed: 1, reward: 1, leakDamage: 1, tags: ['zz-tag'] };
  const group: AirGroupConfig = {
    id: 'uu',
    name: 'UU',
    role: 'r',
    cost: 1,
    tags: [],
    speed: 1,
    fuel: 1,
    ammo: 0,
    takeoffTime: 0,
    rearmTime: 0,
    zoneRadius: 1,
    weapons: [{ damage: 1, fireRate: 1, targetTags: ['target-tag'] }],
    auras: [{ stat: 'damage', op: 'add', value: 1, scope: 'global', tags: ['mod-tag'] }],
    upgrades: [{ cost: 1, modifiers: [{ stat: 'range', op: 'mul', value: 2, scope: 'self' }] }],
  };
  const reg = { groups: { uu: group }, enemies: { zz: enemy } };
  expect(listEnemies(reg)).toEqual([enemy]);
  expect(listGroups(reg)).toEqual([group]);
  expect(collectTags(reg)).toEqual(['mod-tag', 'target-tag', 'zz-tag']);
  expect(modifierPool(reg).map((p) => p.key)).toEqual(['uu/base/0', 'uu/up1/0']);
});

test('теги и пул модификаторов собираются из реестров', () => {
  const tags = collectTags();
  for (const e of [...listGroups(), ...listEnemies()]) for (const t of e.tags) expect(tags).toContain(t);
  const total = listGroups().reduce((s, u) => s + u.auras.length + u.upgrades.reduce((a, g) => a + g.modifiers.length, 0), 0);
  expect(modifierPool()).toHaveLength(total);
});
