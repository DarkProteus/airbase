import type { AirGroupConfig, LineupEntry } from '../sim';

/** Истребитель: быстрый, бьёт только воздушные цели. */
const f16: AirGroupConfig = {
  id: 'f16',
  name: 'F-16',
  role: 'fighter',
  cost: 100,
  tags: ['air', 'strike'],
  speed: 3,
  fuel: 60,
  ammo: 70,
  takeoffTime: 2,
  rearmTime: 5,
  zoneRadius: 3,
  weapons: [{ damage: 12, fireRate: 2.5, targetTags: ['air'] }],
  auras: [],
  upgrades: [
    { cost: 80, modifiers: [{ stat: 'damage', op: 'mul', value: 1.3, scope: 'self' }] },
    { cost: 140, modifiers: [{ stat: 'ammo', op: 'add', value: 16, scope: 'self' }] },
  ],
  visual: { shape: 'pyramid', color: '#4f9de8', scale: 1.1 },
};

/** Штурмовик: медленнее, бьёт только наземные цели тяжёлыми выстрелами. */
const a10: AirGroupConfig = {
  id: 'a10',
  name: 'A-10',
  role: 'attacker',
  cost: 120,
  tags: ['air', 'strike'],
  speed: 2.4,
  fuel: 65,
  ammo: 20,
  takeoffTime: 2,
  rearmTime: 6,
  zoneRadius: 2.5,
  weapons: [{ damage: 45, fireRate: 1.2, targetTags: ['ground'] }],
  auras: [],
  upgrades: [
    { cost: 90, modifiers: [{ stat: 'damage', op: 'mul', value: 1.3, scope: 'self' }] },
    { cost: 150, modifiers: [{ stat: 'ammo', op: 'add', value: 10, scope: 'self' }] },
  ],
  visual: { shape: 'cube', color: '#8fbf5a', scale: 1.1 },
};

/** РЭБ: не стреляет; пока патрулирует, в его зоне враги медленнее, а ударные (strike) группы бьют сильнее. */
const growler: AirGroupConfig = {
  id: 'growler',
  name: 'EA-18G Growler',
  role: 'support',
  cost: 120,
  tags: ['air', 'ew'],
  speed: 2.8,
  fuel: 70,
  ammo: 0,
  takeoffTime: 2,
  rearmTime: 6,
  zoneRadius: 3,
  weapons: [],
  auras: [
    { stat: 'speed', op: 'mul', value: 0.7, scope: 'aura', side: 'enemy' },
    { stat: 'damage', op: 'mul', value: 1.3, scope: 'aura', tags: ['strike'] },
  ],
  upgrades: [{ cost: 120, modifiers: [{ stat: 'range', op: 'add', value: 0.5, scope: 'self' }] }],
  visual: { shape: 'cylinder', color: '#a56fe0', scale: 1 },
};

/** Экономика: не воюет; каждый завершённый вылет добавляет бонус к награде миссии. */
const c130: AirGroupConfig = {
  id: 'c130',
  name: 'C-130',
  role: 'economy',
  cost: 90,
  tags: ['air', 'logistics'],
  speed: 2,
  fuel: 30,
  ammo: 0,
  takeoffTime: 3,
  rearmTime: 6,
  zoneRadius: 1.5,
  income: 60,
  weapons: [],
  auras: [],
  upgrades: [{ cost: 100, modifiers: [{ stat: 'income', op: 'add', value: 20, scope: 'self' }] }],
  visual: { shape: 'cube', color: '#d9c25c', scale: 1.2 },
};

export const GROUPS: Record<string, AirGroupConfig> = {
  [f16.id]: f16,
  [a10.id]: a10,
  [growler.id]: growler,
  [c130.id]: c130,
};

/** Сколько групп игрок берёт на вылет. */
export const LINEUP_SIZE = 3;

/** Стартовый состав до экрана базы (TASK-16): зоны у целей обеих миссий (карта 13×11). */
export const DEFAULT_LINEUP: LineupEntry[] = [
  { group: 'f16', level: 0, zone: { x: 4, y: 5 } },
  { group: 'a10', level: 0, zone: { x: 5, y: 6 } },
  { group: 'growler', level: 0, zone: { x: 5, y: 5 } },
];
