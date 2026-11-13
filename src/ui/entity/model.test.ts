import { expect, test } from 'vitest';
import type { Modifier, UnitConfig } from '../../sim';
import { describeFields, viewUnit, visualOf } from './model';

const aura: Modifier = { stat: 'damage', op: 'add', value: 5, scope: 'aura', radius: 2, tags: ['air'] };

const unit: UnitConfig = {
  id: 't',
  name: 'T',
  role: 'r',
  cost: 100,
  tags: ['air'],
  stats: { damage: 10, range: 3 },
  modifiers: [{ stat: 'range', op: 'add', value: 1, scope: 'self' }],
  upgrades: [
    { cost: 50, modifiers: [{ stat: 'damage', op: 'mul', value: 2, scope: 'self' }] },
    { cost: 80, modifiers: [{ stat: 'damage', op: 'add', value: 4, scope: 'self' }] },
  ],
};

test('уровень улучшения применяет upgrades[0..level-1] через applyModifiers', () => {
  expect(viewUnit(unit, 0).stats).toEqual({ damage: 10, range: 4 });
  expect(viewUnit(unit, 1).stats.damage).toBe(20);
  expect(viewUnit(unit, 2).stats.damage).toBe(28); // (10 + 4) * 2
  expect(viewUnit(unit, 2).totalCost).toBe(230);
  expect(viewUnit(unit, 1).nextUpgradeCost).toBe(80);
  expect(viewUnit(unit, 2).nextUpgradeCost).toBeUndefined();
});

test('уровень зажимается в диапазон 0..upgrades.length', () => {
  expect(viewUnit(unit, 99).level).toBe(2);
  expect(viewUnit(unit, -3).level).toBe(0);
});

test('внешние модификаторы применяются только если подходят по тегам', () => {
  expect(viewUnit(unit, 0, [aura]).stats.damage).toBe(15);
  const ground = { ...unit, tags: ['ground'] };
  expect(viewUnit(ground, 0, [aura]).stats.damage).toBe(10);
  // включённый тег делает модификатор применимым и попадает в итоговые теги
  const v = viewUnit(ground, 0, [aura], ['air']);
  expect(v.stats.damage).toBe(15);
  expect(v.tags).toEqual(['ground', 'air']);
});

test('describeFields обобщённо выводит поля любого конфига без id/name', () => {
  const rows = describeFields({ id: 'x', name: 'X', hp: 5, speed: 1.23456, tags: ['a', 'b'], newField: 7, waves: [{}, {}] });
  expect(rows).toEqual([
    { key: 'hp', value: '5' },
    { key: 'speed', value: '1.235' },
    { key: 'tags', value: 'a, b' },
    { key: 'newField', value: '7' },
    { key: 'waves', value: '2 шт.' },
  ]);
});

test('visualOf детерминирован; air => flying; роль задаёт цвет', () => {
  const a = visualOf({ role: 'r', tags: ['air', 'light'] });
  expect(visualOf({ role: 'r', tags: ['light', 'air'] })).toEqual(a);
  expect(a.flying).toBe(true);
  expect(visualOf({ tags: ['ground'] }).flying).toBe(false);
  expect(visualOf({ role: 'other', tags: ['air'] }).color).not.toBe(visualOf({ role: 'r', tags: ['air'] }).color);
});
