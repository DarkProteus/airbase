import type { EnemyConfig } from '../sim';
import { MODELS } from './models';

const drone: EnemyConfig = {
  id: 'drone',
  name: 'Дрон',
  hp: 30,
  speed: 1.5,
  speedVar: 0.1,
  reward: 3,
  leakDamage: 1,
  tags: ['air', 'light'],
  visual: { shape: 'sphere', model: MODELS.drone, color: '#ee5a4a', scale: 0.7 },
};

const runner: EnemyConfig = {
  id: 'runner',
  name: 'Беспилотник-разведчик',
  hp: 14,
  speed: 3,
  speedVar: 0.15,
  reward: 2,
  leakDamage: 1,
  tags: ['air', 'light', 'fast'],
  visual: { shape: 'pyramid', model: MODELS.runner, color: '#f5a524', scale: 0.7 },
};

const tank: EnemyConfig = {
  id: 'tank',
  name: 'Бронетехника',
  hp: 210,
  speed: 0.8,
  reward: 10,
  leakDamage: 3,
  tags: ['ground', 'armored'],
  visual: { shape: 'cube', model: MODELS.tank, color: '#9a7b52', scale: 0.9 },
};

/** Босс последней волны: прочность по меркам огня одного истребителя за несколько секунд в зоне (TASK-46) — его сбивают или он бьёт по колонне. */
const bomber: EnemyConfig = {
  id: 'bomber',
  name: 'Тяжёлый бомбардировщик',
  hp: 300,
  speed: 0.6,
  reward: 50,
  leakDamage: 10,
  tags: ['air', 'heavy', 'boss'],
  visual: { shape: 'cylinder', model: MODELS.bomber, color: '#d1366b', scale: 1.3, altitude: 1.2 },
};

/** Ударный вертолёт: броня гасит очередь истребителя, тяжёлые ракеты штурмовика пробивают (тег low). */
const gunship: EnemyConfig = {
  id: 'gunship',
  name: 'Ударный вертолёт',
  hp: 150,
  speed: 1.1,
  reward: 9,
  leakDamage: 2,
  tags: ['air', 'low', 'armored'],
  armor: 10,
  visual: { shape: 'cube', model: MODELS.gunship, color: '#c96a3a', scale: 0.95, altitude: 0.8 },
};

/** Малозаметный БПЛА: без группы обнаружения (ДРЛО) в зоне его никто не атакует. */
const ghost: EnemyConfig = {
  id: 'ghost',
  name: 'Малозаметный БПЛА',
  hp: 40,
  speed: 1.8,
  speedVar: 0.1,
  reward: 5,
  leakDamage: 2,
  tags: ['air', 'light'],
  stealth: true,
  visual: { shape: 'pyramid', model: MODELS.ghost, color: '#5f6f86', scale: 0.85 },
};

/** Носитель: медленный, при гибели выпускает рой дронов; прочности хватает на одну-две очереди истребителя, чтобы рой выпускали на глазах у игрока (TASK-46). */
const carrier: EnemyConfig = {
  id: 'carrier',
  name: 'Носитель дронов',
  hp: 120,
  speed: 0.9,
  reward: 13,
  leakDamage: 4,
  tags: ['air', 'heavy'],
  spawnOnDeath: { enemy: 'drone', count: 4 },
  visual: { shape: 'cylinder', model: MODELS.carrier, color: '#b0457a', scale: 1.15, altitude: 1.1 },
};

export const ENEMIES: Record<string, EnemyConfig> = {
  [drone.id]: drone,
  [runner.id]: runner,
  [tank.id]: tank,
  [bomber.id]: bomber,
  [gunship.id]: gunship,
  [ghost.id]: ghost,
  [carrier.id]: carrier,
};
