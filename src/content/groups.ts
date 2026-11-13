import type { AirGroupConfig, LineupEntry } from '../sim';

/**
 * ВРЕМЕННАЯ ЗАГЛУШКА до TASK-15 (четыре настоящие группы MVP) и TASK-16 (экран выбора состава):
 * две группы как данные, чтобы управление зонами в бою можно было попробовать руками.
 */

const f16: AirGroupConfig = {
  id: 'f16',
  name: 'F-16',
  role: 'fighter',
  cost: 100,
  tags: ['air', 'strike'],
  speed: 3,
  fuel: 40,
  ammo: 40,
  takeoffTime: 2,
  rearmTime: 8,
  zoneRadius: 2.5,
  weapons: [{ damage: 12, fireRate: 2, targetTags: ['air'] }],
  auras: [],
  upgrades: [],
  visual: { shape: 'pyramid', color: '#4f9de8', scale: 1.1 },
};

const a10: AirGroupConfig = {
  id: 'a10',
  name: 'A-10',
  role: 'attacker',
  cost: 120,
  tags: ['air', 'strike'],
  speed: 2.4,
  fuel: 45,
  ammo: 24,
  takeoffTime: 2,
  rearmTime: 10,
  zoneRadius: 2,
  weapons: [{ damage: 30, fireRate: 1, targetTags: ['ground'] }],
  auras: [],
  upgrades: [],
  visual: { shape: 'cube', color: '#8fbf5a', scale: 1.1 },
};

export const GROUPS: Record<string, AirGroupConfig> = {
  [f16.id]: f16,
  [a10.id]: a10,
};

/** Заглушка стартового состава: зоны на маршруте врагов (карта 13×11 обеих миссий). */
export const DEFAULT_LINEUP: LineupEntry[] = [
  { group: 'f16', level: 0, zone: { x: 4, y: 4 } },
  { group: 'a10', level: 0, zone: { x: 7, y: 8 } },
];
