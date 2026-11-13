export interface Vec2 {
  x: number;
  y: number;
}

/**
 * damage/range/fireRate/income — статы юнитов; speed — стат врага (множитель через side: 'enemy').
 * Для авиагруппы: speed — скорость полёта, range — радиус зоны, fuel/ammo/rearmTime — ресурсы вылета.
 */
export type StatKey = 'damage' | 'range' | 'fireRate' | 'income' | 'speed' | 'fuel' | 'ammo' | 'rearmTime';
export type Stats = Partial<Record<StatKey, number>>;

/** Единица синергии/улучшения: итог = (база + Σadd) * Πmul. */
export interface Modifier {
  stat: StatKey;
  op: 'add' | 'mul';
  value: number;
  /** На кого действует: ally (по умолчанию) — другие юниты, enemy — враги. */
  side?: 'ally' | 'enemy';
  /** self — на владельца, aura — на цели в radius от владельца, global — на все цели. Аура и global не действуют на самого владельца. */
  scope: 'self' | 'aura' | 'global';
  radius?: number;
  /** Цель должна иметь все перечисленные теги. */
  tags?: string[];
}

/** Примитив модели: рендерер и превью галереи строят одну и ту же форму. */
export type VisualShape = 'cube' | 'cylinder' | 'pyramid' | 'sphere';

/** Визуал сущности как данные. Симуляция его не читает. */
export interface VisualConfig {
  shape: VisualShape;
  /** Цвет '#rrggbb' — понимают и CSS, и three.Color. */
  color: string;
  /** Относительный размер, 1 = обычный. */
  scale?: number;
  /** Высота полёта над землёй в клетках; по умолчанию 0,9 для тега air и 0 для остальных. */
  altitude?: number;
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
  /** Облик; без него рендерер берёт запасной примитив из роли/тегов. */
  visual?: VisualConfig;
}

/** Оружие группы: бьёт только врагов, у которых есть хотя бы один из целевых тегов (пустой список — любых). */
export interface WeaponConfig {
  damage: number;
  /** Выстрелов в секунду. */
  fireRate: number;
  targetTags: string[];
}

/**
 * Авиагруппа: не стоит в точке, а летает вылетами (см. sortie.ts):
 * взлёт → перелёт → патруль в зоне → возврат → перезарядка → снова.
 */
export interface AirGroupConfig {
  id: string;
  name: string;
  role: string;
  /** Цена покупки на базе. */
  cost: number;
  tags: string[];
  /** Клеток в секунду. */
  speed: number;
  /** Секунд полёта на один вылет (перелёт + патруль + возврат). */
  fuel: number;
  /** Выстрелов на один вылет, общий на всё оружие. */
  ammo: number;
  /** Секунд на взлёт перед каждым вылетом. */
  takeoffTime: number;
  /** Секунд на перезарядку и заправку после возврата. */
  rearmTime: number;
  /** Радиус зоны патрулирования в клетках. */
  zoneRadius: number;
  weapons: WeaponConfig[];
  /** Аура-модификаторы группы; scope 'self' действует на саму группу. */
  auras: Modifier[];
  /** Уровни улучшения: каждый добавляет свои модификаторы. */
  upgrades: { cost: number; modifiers: Modifier[] }[];
  visual?: VisualConfig;
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
  /** Облик; без него рендерер берёт запасной примитив из тегов. */
  visual?: VisualConfig;
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
  /** Аэродром: клетка на краю карты, откуда взлетают и куда возвращаются авиагруппы. */
  airfield: Vec2;
  /** Клетки, куда можно ставить юниты. */
  slots: Vec2[];
  startMoney: number;
  baseLives: number;
  waves: Wave[];
}

export interface Content {
  units: Record<string, UnitConfig>;
  enemies: Record<string, EnemyConfig>;
  /** Авиагруппы; опционально, пока жива турельная модель. */
  groups?: Record<string, AirGroupConfig>;
}
