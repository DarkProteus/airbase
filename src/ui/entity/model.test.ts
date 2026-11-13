import { expect, test } from 'vitest';
import type { Modifier, UnitConfig } from '../../sim';
import { ENEMIES, UNITS } from '../../content';
import { describeFields, hslToHex, viewUnit, visualOf } from './model';

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

test('свои ауры и вражеские модификаторы не меняют статы владельца (как в sim)', () => {
  const unit: UnitConfig = {
    id: 's',
    name: 'S',
    role: 'support',
    cost: 1,
    tags: ['strike'],
    stats: { fireRate: 1 },
    modifiers: [
      { stat: 'fireRate', op: 'mul', value: 2, scope: 'aura', radius: 3, tags: ['strike'] },
      { stat: 'speed', op: 'mul', value: 0.5, scope: 'aura', radius: 3, side: 'enemy' },
    ],
    upgrades: [],
  };
  expect(viewUnit(unit).stats).toEqual({ fireRate: 1 });
  expect(viewUnit(unit).appliedModifiers).toHaveLength(2);
  // Та же аура от союзника — применяется; вражеский модификатор — нет.
  expect(viewUnit(unit, 0, unit.modifiers).stats).toEqual({ fireRate: 2 });
});

test('visualOf берёт форму, цвет, масштаб и высоту из visual конфига; теги влияют только на запасной вариант', () => {
  const v = visualOf({ tags: ['ground'], visual: { shape: 'sphere', color: '#112233', scale: 1.5, altitude: 2 } });
  expect(v).toEqual({ shape: 'sphere', color: '#112233', size: 1.5, altitude: 2, flying: true });
  // Без altitude: air парит на высоте по умолчанию, наземный — нет; scale по умолчанию 1.
  expect(visualOf({ tags: ['air'], visual: { shape: 'cube', color: '#000000' } })).toMatchObject({ altitude: 0.9, flying: true, size: 1 });
  expect(visualOf({ tags: [], visual: { shape: 'cube', color: '#000000' } })).toMatchObject({ altitude: 0, flying: false });
});

test('запасной визуал отдаёт цвет в #rrggbb (годится и CSS, и THREE.Color)', () => {
  expect(visualOf({ role: 'x', tags: ['air'] }).color).toMatch(/^#[0-9a-f]{6}$/);
  expect(hslToHex(0, 1, 0.5)).toBe('#ff0000');
  expect(hslToHex(120, 1, 0.5)).toBe('#00ff00');
  expect(hslToHex(240, 1, 0.5)).toBe('#0000ff');
});

test('весь контент задаёт visual явно: корректный цвет, масштаб > 0, юниты различимы формой или цветом', () => {
  const all = [...Object.values(UNITS), ...Object.values(ENEMIES)];
  for (const c of all) {
    expect(c.visual, c.id).toBeDefined();
    expect(c.visual!.color, c.id).toMatch(/^#[0-9a-f]{6}$/);
    expect(c.visual!.scale ?? 1, c.id).toBeGreaterThan(0);
  }
  const sigs = all.map((c) => `${c.visual!.shape}/${c.visual!.color}`);
  expect(new Set(sigs).size).toBe(all.length);
});
