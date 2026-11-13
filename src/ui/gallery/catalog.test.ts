import { expect, test } from 'vitest';
import { ENEMIES, UNITS } from '../../content';
import type { EnemyConfig, UnitConfig } from '../../sim';
import { collectTags, listEnemies, listUnits, modifierPool } from './catalog';

test('галерея перечисляет ровно то, что в реестрах контента', () => {
  expect(listUnits().map((u) => u.id)).toEqual(Object.values(UNITS).map((u) => u.id));
  expect(listEnemies().map((e) => e.id)).toEqual(Object.values(ENEMIES).map((e) => e.id));
  expect(listUnits()).toHaveLength(Object.keys(UNITS).length);
  expect(listEnemies()).toHaveLength(Object.keys(ENEMIES).length);
  for (const u of listUnits()) expect(UNITS[u.id]).toBe(u);
  for (const e of listEnemies()) expect(ENEMIES[e.id]).toBe(e);
});

test('новый конфиг в реестре появляется в галерее без правок', () => {
  const enemy: EnemyConfig = { id: 'zz', name: 'ZZ', hp: 1, speed: 1, reward: 1, leakDamage: 1, tags: ['zz-tag'] };
  const unit: UnitConfig = {
    id: 'uu',
    name: 'UU',
    role: 'r',
    cost: 1,
    tags: [],
    stats: {},
    modifiers: [{ stat: 'damage', op: 'add', value: 1, scope: 'global', tags: ['mod-tag'] }],
    upgrades: [{ cost: 1, modifiers: [{ stat: 'range', op: 'mul', value: 2, scope: 'self' }] }],
  };
  const reg = { units: { uu: unit }, enemies: { zz: enemy } };
  expect(listEnemies(reg)).toEqual([enemy]);
  expect(listUnits(reg)).toEqual([unit]);
  expect(collectTags(reg)).toEqual(['mod-tag', 'zz-tag']);
  expect(modifierPool(reg).map((p) => p.key)).toEqual(['uu/base/0', 'uu/up1/0']);
});

test('теги и пул модификаторов собираются из реестров', () => {
  const tags = collectTags();
  for (const e of [...listUnits(), ...listEnemies()]) for (const t of e.tags) expect(tags).toContain(t);
  const total = listUnits().reduce((s, u) => s + u.modifiers.length + u.upgrades.reduce((a, g) => a + g.modifiers.length, 0), 0);
  expect(modifierPool()).toHaveLength(total);
});
