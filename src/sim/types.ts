export interface Vec2 {
  x: number;
  y: number;
}

/**
 * Статы авиагруппы: speed — скорость полёта, range — радиус зоны, fuel/ammo/rearmTime — ресурсы вылета,
 * damage/fireRate — оружие, income — бонус к награде за завершённый вылет.
 * speed с side: 'enemy' — множитель скорости врага.
 */
/** detect — обнаружение: вражеская аура с detect > 0 делает малозаметных врагов (`EnemyConfig.stealth`) доступными для атаки. */
export type StatKey = 'damage' | 'range' | 'fireRate' | 'income' | 'speed' | 'fuel' | 'ammo' | 'rearmTime' | 'detect';
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

/**
 * Форма детали составной модели. Единичный размер 1×1×1; у цилиндра и конуса ось — локальная Y.
 * wing — консоль крыла или оперения: пластина-трапеция от корня (z = 0) к законцовке (z = размер по Z).
 * Размер по X — хорда у корня, по Y — толщина, по Z — размах консоли; отрицательный размах зеркалит консоль на левый борт.
 */
export type ModelPartShape = 'box' | 'cylinder' | 'cone' | 'sphere' | 'wing';

/** Тройка по осям модели: X — вперёд (нос), Y — вверх, Z — вправо. */
export type Triple = [number, number, number];

/** Деталь составной модели: простая форма со смещением, поворотом, размером и цветом. */
export interface ModelPart {
  shape: ModelPartShape;
  /** Габариты детали по её локальным осям, клетки. */
  size: Triple;
  /** Смещение центра детали от начала модели, клетки; по умолчанию 0. */
  offset?: Triple;
  /** Поворот вокруг осей X, Y, Z в градусах (порядок XYZ); по умолчанию 0. */
  rotation?: Triple;
  /** Цвет '#rrggbb'; по умолчанию — цвет сущности (`VisualConfig.color`). */
  color?: string;
  /** Число граней у цилиндра, конуса и сферы (низкополи); по умолчанию 8. */
  segments?: number;
  /**
   * Сужение, доля от 0 до 1 (по умолчанию 1 — без сужения): у wing — хорда законцовки относительно корневой,
   * у cylinder — радиус верхнего торца (+Y) относительно нижнего: усечённый конус для носа и хвоста фюзеляжа.
   */
  taper?: number;
  /** Стреловидность wing: на сколько корневых хорд середина законцовки смещена назад (−X) от середины корня; по умолчанию 0. */
  sweep?: number;
}

/** Составная низкополи-модель как данные: сцена и превью карточек строят её из одного описания. */
export interface ModelConfig {
  id: string;
  parts: ModelPart[];
}

/** Визуал сущности как данные. Симуляция его не читает. */
export interface VisualConfig {
  /** Примитив: рисуется, если составной модели нет (и в превью без WebGL). */
  shape: VisualShape;
  /** Составная модель из реестра контента (`MODELS`); нет — рисуется примитив `shape`. */
  model?: ModelConfig;
  /** Цвет '#rrggbb' — понимают и CSS, и three.Color. */
  color: string;
  /** Относительный размер, 1 = обычный. */
  scale?: number;
  /** Высота полёта над землёй в клетках; по умолчанию 0,9 для тега air и 0 для остальных. */
  altitude?: number;
}

/** Вид выстрела для рендера: gun — очередь трассеров, missile — ракета с дымным следом. */
export type ShotKind = 'gun' | 'missile';

/** Оружие группы: бьёт только врагов, у которых есть хотя бы один из целевых тегов (пустой список — любых). */
export interface WeaponConfig {
  damage: number;
  /** Выстрелов в секунду. */
  fireRate: number;
  targetTags: string[];
  /** Как выглядит выстрел. Только для рендера, sim не читает; нет — выводится из урона и скорострельности. */
  shot?: ShotKind;
}

/** Вариант развилки улучшения (специализация): заметно разные модификаторы за одну цену. */
export interface UpgradeOption {
  id: string;
  /** Короткое название специализации для игрока. */
  name: string;
  /** Одно предложение: чем специализация отличается (в том числе эффекты аур, которых нет в собственных параметрах). */
  description: string;
  modifiers: Modifier[];
}

/**
 * Один уровень улучшения: общая цена и модификаторы. Если задан `options`, уровень — развилка:
 * игрок при покупке выбирает один из двух вариантов; применяются `modifiers` (общие, могут быть пустыми) и модификаторы выбранного.
 * На группу — не больше одной развилки.
 */
export interface UpgradeConfig {
  cost: number;
  modifiers: Modifier[];
  options?: [UpgradeOption, UpgradeOption];
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
  /** Уровни улучшения: каждый добавляет свои модификаторы; один из них может быть развилкой специализаций. */
  upgrades: UpgradeConfig[];
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
  /** Броня: каждое попадание теряет столько урона, но наносит не меньше ARMOR_MIN_SHARE от своего урона. */
  armor?: number;
  /** Малозаметный: группы атакуют его, только пока он в зоне действия ауры обнаружения (стат detect). */
  stealth?: boolean;
  /** Носитель: при гибели выпускает на своём месте `count` врагов типа `enemy`. */
  spawnOnDeath?: { enemy: string; count: number };
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
  /** Индекс вражеской базы из `MissionConfig.bases` (миссии с целью), с которой идёт группа; по умолчанию 0. */
  base?: number;
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

/** Тип врага в списке базы и номер волны (с 1), с которой база его выпускает; без номера — с первой. */
export interface BaseRosterEntry {
  enemy: string;
  fromWave?: number;
}

/**
 * Вражеская база: видимая точка на карте, откуда идут враги только её типов. Уничтожить её нельзя.
 * База «растёт»: запись списка с `fromWave` открывает новый тип с этой волны.
 */
export interface EnemyBaseConfig {
  id: string;
  /** Название для игрока: по нему понятно, чего ждать с этой базы. */
  name: string;
  pos: Vec2;
  /** Какие типы врагов выпускает база. Пустой список — любые (только для тестовых миссий; в контенте список обязателен). */
  roster: BaseRosterEntry[];
}

export interface MissionConfig {
  id: string;
  name: string;
  /** Размер сетки карты в клетках: x ∈ [0, w), y ∈ [0, h). */
  size: { w: number; h: number };
  /** Полилиния пути врагов в клетках — миссии без цели: враги идут по пути и отнимают жизни базы. */
  path?: Vec2[];
  /** Цель миссии: с ней враги появляются на вражеских базах (`bases`) и идут на текущую позицию цели, а `path` и жизни базы не используются. */
  objective?: ObjectiveConfig;
  /** Вражеские базы (миссии с целью): откуда и какие враги идут. */
  bases?: EnemyBaseConfig[];
  /** Аэродром: клетка на краю карты, откуда взлетают и куда возвращаются авиагруппы. */
  airfield: Vec2;
  baseLives: number;
  waves: Wave[];
  /** Стартовые зоны патруля по слотам состава (центры на карте); нет — общие зоны по умолчанию из контента. */
  zones?: Vec2[];
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
