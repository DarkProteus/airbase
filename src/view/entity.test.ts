import { describe, expect, test } from 'vitest';
import type { AirGroupConfig, Modifier } from '../sim';
import { configStats } from '../sim';
import { ENEMIES, GROUPS } from '../content';
import { describeFields, hslToHex, viewGroup, viewGroupWhatIf, visualOf, whatIfAuras } from './entity';

const aura: Modifier = { stat: 'damage', op: 'add', value: 5, scope: 'aura', tags: ['air'] };

const group: AirGroupConfig = {
  id: 't',
  name: 'T',
  role: 'r',
  cost: 100,
  tags: ['air'],
  speed: 3,
  fuel: 20,
  ammo: 4,
  takeoffTime: 1,
  rearmTime: 2,
  zoneRadius: 3,
  weapons: [{ damage: 10, fireRate: 1, targetTags: ['ground'] }],
  auras: [{ stat: 'range', op: 'add', value: 1, scope: 'self' }],
  upgrades: [
    { cost: 50, modifiers: [{ stat: 'damage', op: 'mul', value: 2, scope: 'self' }] },
    { cost: 80, modifiers: [{ stat: 'damage', op: 'add', value: 4, scope: 'self' }] },
  ],
};
const damage = (v: ReturnType<typeof viewGroup>) => v.stats.weapons[0]!.damage;

test('уровень улучшения применяет upgrades[0..level-1] теми же функциями, что sim', () => {
  expect(viewGroup(group, 0).stats).toEqual(configStats(group, 0));
  expect(viewGroup(group, 0).stats).toMatchObject({ speed: 3, fuel: 20, ammo: 4, rearmTime: 2, zoneRadius: 4, income: 0 });
  expect(damage(viewGroup(group, 1))).toBe(20);
  expect(damage(viewGroup(group, 2))).toBe(28); // (10 + 4) * 2
  expect(viewGroup(group, 2).totalCost).toBe(230);
  expect(viewGroup(group, 1).nextUpgradeCost).toBe(80);
  expect(viewGroup(group, 2).nextUpgradeCost).toBeUndefined();
});

test('уровень зажимается в диапазон 0..upgrades.length', () => {
  expect(viewGroup(group, 99).level).toBe(2);
  expect(viewGroup(group, -3).level).toBe(0);
});

test('внешние модификаторы применяются только если подходят по тегам', () => {
  expect(damage(viewGroup(group, 0, [aura]))).toBe(15);
  const ground = { ...group, tags: ['ground'] };
  expect(damage(viewGroup(ground, 0, [aura]))).toBe(10);
  // включённый тег делает модификатор применимым и попадает в итоговые теги
  const v = viewGroup(ground, 0, [aura], ['air']);
  expect(damage(v)).toBe(15);
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

test('свои ауры и вражеские модификаторы не меняют параметры владельца (как в sim)', () => {
  const support: AirGroupConfig = {
    ...group,
    tags: ['strike'],
    auras: [
      { stat: 'fireRate', op: 'mul', value: 2, scope: 'aura', tags: ['strike'] },
      { stat: 'speed', op: 'mul', value: 0.5, scope: 'aura', side: 'enemy' },
    ],
    upgrades: [],
  };
  expect(viewGroup(support).stats).toMatchObject({ speed: 3, weapons: [{ fireRate: 1 }] });
  expect(viewGroup(support).appliedModifiers).toHaveLength(2);
  // Та же аура от союзника — применяется; вражеский модификатор — нет.
  expect(viewGroup(support, 0, support.auras).stats).toMatchObject({ speed: 3, weapons: [{ fireRate: 2 }] });
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

test('весь контент задаёт visual явно: корректный цвет, масштаб > 0, сущности различимы формой или цветом', () => {
  const all = [...Object.values(GROUPS), ...Object.values(ENEMIES)];
  for (const c of all) {
    expect(c.visual, c.id).toBeDefined();
    expect(c.visual!.color, c.id).toMatch(/^#[0-9a-f]{6}$/);
    expect(c.visual!.scale ?? 1, c.id).toBeGreaterThan(0);
  }
  const sigs = all.map((c) => `${c.visual!.shape}/${c.visual!.color}`);
  expect(new Set(sigs).size).toBe(all.length);
});

describe('«что-если»: ауры других групп', () => {
  const support: AirGroupConfig = {
    ...group,
    id: 's',
    tags: ['ew'],
    weapons: [],
    auras: [
      { stat: 'damage', op: 'mul', value: 2, scope: 'aura', tags: ['strike'] },
      { stat: 'fuel', op: 'add', value: 10, scope: 'aura', tags: ['strike'], radius: 1 },
      { stat: 'speed', op: 'mul', value: 0.5, scope: 'aura', side: 'enemy' },
      { stat: 'range', op: 'add', value: 1, scope: 'self' },
    ],
    upgrades: [{ cost: 1, modifiers: [{ stat: 'ammo', op: 'add', value: 3, scope: 'global', tags: ['strike'] }] }],
  };
  const striker: AirGroupConfig = { ...group, id: 'k', tags: ['air', 'strike'] };
  const sources = (level: number) => [{ group: support, level }];

  test('ауры отбираются так же, как в sim: сторона, scope, теги; своя аура на владельца не действует', () => {
    const mods = whatIfAuras(striker, striker.tags, sources(0));
    expect(mods.map((m) => m.stat)).toEqual(['damage', 'fuel']);
    expect(whatIfAuras(group, group.tags, sources(0))).toEqual([]);
    expect(whatIfAuras(support, support.tags, sources(1))).toEqual([]);
    expect(whatIfAuras(striker, striker.tags, [])).toEqual([]);
  });

  test('уровень источника добавляет ауры его улучшений', () => {
    expect(whatIfAuras(striker, striker.tags, sources(1)).map((m) => m.stat)).toEqual(['damage', 'fuel', 'ammo']);
  });

  test('карточка показывает «было» (own) и «стало» (stats); без источников они равны', () => {
    const v = viewGroupWhatIf(striker, 0, sources(1));
    expect(v.own).toEqual(configStats(striker, 0));
    expect(v.stats.weapons[0]!.damage).toBe(20);
    expect(v.own.weapons[0]!.damage).toBe(10);
    expect(v.stats.fuel).toBe(30);
    expect(v.stats.ammo).toBe(7);
    const plain = viewGroupWhatIf(striker, 0, []);
    expect(plain.stats).toEqual(plain.own);
  });

  test('дополнительный тег песочницы делает группу целью ауры', () => {
    expect(viewGroupWhatIf(group, 0, sources(0)).stats).toEqual(configStats(group, 0));
    expect(viewGroupWhatIf(group, 0, sources(0), ['strike']).stats.weapons[0]!.damage).toBe(20);
  });
});
