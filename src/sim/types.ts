export interface Vec2 {
  x: number;
  y: number;
}

export type StatKey = 'damage' | 'range' | 'fireRate' | 'income';
export type Stats = Partial<Record<StatKey, number>>;

/** Единица синергии/улучшения: итог = (база + Σadd) * Πmul. */
export interface Modifier {
  stat: StatKey;
  op: 'add' | 'mul';
  value: number;
  /** self — на владельца, aura — на союзников в radius, global — на всех союзников. */
  scope: 'self' | 'aura' | 'global';
  radius?: number;
  /** Цель должна иметь все перечисленные теги. */
  tags?: string[];
}

export interface UnitConfig {
  id: string;
  name: string;
  role: string;
  cost: number;
  tags: string[];
  stats: Stats;
  /** Постоянные эффекты юнита (в т.ч. ауры на союзников). */
  modifiers: Modifier[];
  /** Уровни улучшения: каждый добавляет свои модификаторы. */
  upgrades: { cost: number; modifiers: Modifier[] }[];
}

export interface EnemyConfig {
  id: string;
  name: string;
  hp: number;
  /** Клеток в секунду. */
  speed: number;
  /** Разброс скорости ±доля, берётся из RNG при спавне. */
  speedVar?: number;
  reward: number;
  /** Сколько жизней базы отнимает при прорыве. */
  leakDamage: number;
  tags: string[];
}

export interface WaveGroup {
  enemy: string;
  count: number;
  /** Секунд между спавнами в группе. */
  interval: number;
  /** Секунд от старта волны до первого спавна. */
  delay?: number;
}

/**
 * Правило старта волны: когда начинает идти отсчёт подготовки.
 * timer — сразу, как предыдущая волна закончила спавн (враги могут ещё жить);
 * clear — только после полной зачистки предыдущей волны.
 * Для первой волны отсчёт идёт с начала миссии.
 */
export type WaveStartRule = 'timer' | 'clear';

export interface Wave {
  /** Правило старта; по умолчанию timer. */
  start?: WaveStartRule;
  /** Фаза подготовки перед волной, секунд (покупки/улучшения). */
  prep: number;
  groups: WaveGroup[];
}

export interface MissionConfig {
  id: string;
  name: string;
  /** Размер сетки карты в клетках: x ∈ [0, w), y ∈ [0, h). */
  size: { w: number; h: number };
  /** Полилиния пути врагов в клетках. */
  path: Vec2[];
  /** Клетки, куда можно ставить юниты. */
  slots: Vec2[];
  startMoney: number;
  baseLives: number;
  waves: Wave[];
}

export interface Content {
  units: Record<string, UnitConfig>;
  enemies: Record<string, EnemyConfig>;
}
