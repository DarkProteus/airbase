import type { UnitConfig } from '../sim';

/** Универсал: дёшев, стабильный урон по одной цели. */
const f16: UnitConfig = {
  id: 'f16',
  name: 'F-16',
  role: 'fighter',
  cost: 100,
  tags: ['air', 'strike'],
  visual: { shape: 'pyramid', color: '#4f9de8', scale: 1 },
  stats: { damage: 12, range: 3, fireRate: 1.5 },
  modifiers: [],
  upgrades: [
    { cost: 80, modifiers: [{ stat: 'damage', op: 'mul', value: 1.4, scope: 'self' }] },
    { cost: 140, modifiers: [{ stat: 'range', op: 'add', value: 1, scope: 'self' }] },
  ],
};

/** Поддержка: сам почти не бьёт; РЭБ ускоряет стрельбу ударных союзников в зоне и глушит (замедляет) врагов. */
const growler: UnitConfig = {
  id: 'growler',
  name: 'EA-18G Growler',
  role: 'support',
  cost: 120,
  tags: ['air', 'ew'],
  visual: { shape: 'cylinder', color: '#a56fe0', scale: 1 },
  stats: { damage: 2, range: 3, fireRate: 0.5 },
  modifiers: [
    { stat: 'fireRate', op: 'mul', value: 1.5, scope: 'aura', radius: 3, tags: ['strike'] },
    { stat: 'speed', op: 'mul', value: 0.8, scope: 'aura', radius: 3, side: 'enemy' },
  ],
  upgrades: [{ cost: 120, modifiers: [{ stat: 'damage', op: 'mul', value: 1.2, scope: 'aura', radius: 3, tags: ['strike'] }] }],
};

/** Экономика: не воюет, приносит кредиты при старте каждой волны. */
const c130: UnitConfig = {
  id: 'c130',
  name: 'C-130',
  role: 'economy',
  cost: 90,
  tags: ['air', 'logistics'],
  visual: { shape: 'cube', color: '#d9c25c', scale: 1.2 },
  stats: { income: 35 },
  modifiers: [],
  upgrades: [{ cost: 100, modifiers: [{ stat: 'income', op: 'add', value: 25, scope: 'self' }] }],
};

export const UNITS: Record<string, UnitConfig> = { [f16.id]: f16, [growler.id]: growler, [c130.id]: c130 };
