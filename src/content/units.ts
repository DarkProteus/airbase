import type { UnitConfig } from '../sim';

/** Заглушка: проверяет конвейер «конфиг → sim → UI». Настоящие юниты — TASK-8. */
const stub: UnitConfig = {
  id: 'stub',
  name: 'Заглушка',
  role: 'placeholder',
  cost: 100,
  tags: ['air'],
  stats: { damage: 10, range: 3, fireRate: 1 },
  modifiers: [],
  upgrades: [{ cost: 75, modifiers: [{ stat: 'damage', op: 'mul', value: 1.5, scope: 'self' }] }],
};

export const UNITS: Record<string, UnitConfig> = { [stub.id]: stub };
