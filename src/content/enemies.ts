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

export const ENEMIES: Record<string, EnemyConfig> = { [drone.id]: drone };
