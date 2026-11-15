export interface Vec2 {
  x: number;
  y: number;
}

/**
 * Статы авиагруппы: speed — скорость полёта, range — радиус зоны, fuel/ammo/rearmTime — ресурсы вылета,
 * damage/fireRate — оружие, income — бонус к награде за завершённый вылет.
 * speed с side: 'enemy' — множитель скорости врага.
 */
export type StatKey = 'damage' | 'range' | 'fireRate' | 'income' | 'speed' | 'fuel' | 'ammo' | 'rearmTime';
export type Stats = Partial<Record<StatKey, number>>;

/** Единица синергии/улучшения: итог = (база + Σadd) * Πmul. */
export interface Modifier {
  stat: StatKey;
  op: 'add' | 'mul';
  value: number;
  /** На кого действует: ally (по умолчанию) — другие группы, enemy — враги. */
  side?: 'ally' | 'enemy';
  /**
   * self — на владельца; aura — на цели в radius от центра зоны владельца; global — на все цели.
   * Аура и global работают, только пока владелец патрулирует, и не действуют на него самого.
   */
  scope: 'self' | 'aura' | 'global';
  /** Радиус ауры в клетках; по умолчанию — радиус зоны владельца. */
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
  /** Бонус к награде миссии за каждый завершённый вылет. */
  income?: number;
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
  /** Индекс точки входа из `MissionConfig.spawns` (миссии с целью); по умолчанию 0. */
  spawn?: number;
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
  /** Фаза подготовки перед волной, секунд. */
  prep: number;
  groups: WaveGroup[];
}

/**
 * Цель миссии: тип + параметры. Условия победы задаёт тип (см. objective.ts), поражение общее — прочность ≤ 0.
 * defend — удержать неподвижный объект `duration` секунд;
 * escort — колонна идёт по `route` со скоростью `speed` (клеток в секунду), победа — дошла до конца маршрута.
 */
export type ObjectiveConfig =
  | { type: 'defend'; pos: Vec2; hp: number; duration: number }
  | { type: 'escort'; route: Vec2[]; hp: number; speed: number };

export interface MissionConfig {
  id: string;
  name: string;
  /** Размер сетки карты в клетках: x ∈ [0, w), y ∈ [0, h). */
  size: { w: number; h: number };
  /** Полилиния пути врагов в клетках — миссии без цели: враги идут по пути и отнимают жизни базы. */
  path?: Vec2[];
  /** Цель миссии: с ней враги появляются в `spawns` и летят на текущую позицию цели, а `path` и жизни базы не используются. */
  objective?: ObjectiveConfig;
  /** Точки входа врагов (миссии с целью). */
  spawns?: Vec2[];
  /** Аэродром: клетка на краю карты, откуда взлетают и куда возвращаются авиагруппы. */
  airfield: Vec2;
  baseLives: number;
  waves: Wave[];
  /** Награда за исход миссии, сверх убийств и бонусов групп; без поля — 0 (см. reward.ts). */
  reward?: MissionReward;
}

/** Базовая награда миссии: за победу и за поражение (утешительная). */
export interface MissionReward {
  win: number;
  loss: number;
}

export interface Content {
  enemies: Record<string, EnemyConfig>;
  groups: Record<string, AirGroupConfig>;
}
