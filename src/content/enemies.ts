import type { EnemyConfig } from '../sim';

const drone: EnemyConfig = {
  id: 'drone',
  name: 'Дрон',
  hp: 30,
  speed: 1.5,
  speedVar: 0.1,
  reward: 10,
  leakDamage: 1,
  tags: ['air', 'light'],
};

const runner: EnemyConfig = {
  id: 'runner',
  name: 'Беспилотник-разведчик',
  hp: 14,
  speed: 3,
  speedVar: 0.15,
  reward: 6,
  leakDamage: 1,
  tags: ['air', 'light', 'fast'],
};

const tank: EnemyConfig = {
  id: 'tank',
  name: 'Бронетехника',
  hp: 210,
  speed: 0.8,
  reward: 30,
  leakDamage: 3,
  tags: ['ground', 'armored'],
};

const bomber: EnemyConfig = {
  id: 'bomber',
  name: 'Тяжёлый бомбардировщик',
  hp: 1800,
  speed: 0.6,
  reward: 150,
  leakDamage: 10,
  tags: ['air', 'heavy', 'boss'],
};

export const ENEMIES: Record<string, EnemyConfig> = {
  [drone.id]: drone,
  [runner.id]: runner,
  [tank.id]: tank,
  [bomber.id]: bomber,
};
