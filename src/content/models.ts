import type { ModelConfig, ModelPart } from '../sim';

/**
 * Реестр составных моделей, по одной на сущность (id модели = ключ = id группы или врага).
 * Оси: X — нос, Y — вверх, Z — вправо; размеры в клетках, габарит при scale 1 — около одной клетки.
 * Деталь без цвета красится цветом сущности; акценты — тёмный (двигатели, остекление) и светлый (контейнеры, диски).
 * Крылья и оперение — консоли `wing`: от корня к законцовке по +Z, левая консоль — отрицательный размах.
 * Киль — та же консоль, поставленная вертикально поворотом на −90° вокруг X. Фюзеляж — цилиндры вдоль X (поворот вокруг Z на ±90°),
 * нос и хвост — цилиндры с сужением `taper`.
 */

const DARK = '#2b2f36';
const GLASS = '#1c2a3a';
const LIGHT = '#e4e9ef';
const BOOM = '#e8833a';
/** Гондолы двигателей: темнее планера, но различимы на тёмном фоне карточки. */
const ENGINE = '#4b5361';

/** Пара консолей: правая и зеркальная левая. */
const pair = (right: ModelPart): ModelPart[] => {
  const [ox, oy, oz] = right.offset ?? [0, 0, 0];
  const [rx, ry, rz] = right.rotation ?? [0, 0, 0];
  return [right, { ...right, size: [right.size[0], right.size[1], -right.size[2]], offset: [ox, oy, -oz], rotation: [-rx, -ry, rz] }];
};

/** Пара одинаковых деталей по бортам: вторая — с противоположным смещением по Z. */
const both = (part: ModelPart): ModelPart[] => {
  const [ox, oy, oz] = part.offset ?? [0, 0, 0];
  return [part, { ...part, offset: [ox, oy, -oz] }];
};

/** Воздушный винт: две скрещённые лопасти в плоскости YZ. */
const prop = (x: number, y: number, z: number, d: number): ModelPart[] => [
  { shape: 'box', size: [0.012, d, 0.035], offset: [x, y, z], color: LIGHT },
  { shape: 'box', size: [0.012, 0.035, d], offset: [x, y, z], color: LIGHT },
];

/** F-16: острый нос, каплевидный фонарь, треугольное крыло с ракетами на законцовках, воздухозаборник под брюхом, один киль. */
const f16: ModelConfig = {
  id: 'f16',
  parts: [
    { shape: 'cylinder', size: [0.15, 0.52, 0.18], offset: [-0.12, 0, 0], rotation: [0, 0, 90] },
    { shape: 'cylinder', size: [0.15, 0.44, 0.18], offset: [0.36, 0, 0], rotation: [0, 0, -90], taper: 0.12 },
    { shape: 'cylinder', size: [0.13, 0.1, 0.14], offset: [-0.43, 0, 0], rotation: [0, 0, 90], taper: 0.8, color: DARK },
    { shape: 'sphere', size: [0.32, 0.13, 0.11], offset: [0.2, 0.075, 0], color: GLASS, segments: 6 },
    { shape: 'box', size: [0.2, 0.07, 0.12], offset: [0.1, -0.095, 0], color: DARK },
    ...pair({ shape: 'wing', size: [0.5, 0.03, 0.42], offset: [-0.08, 0, 0.07], taper: 0.24, sweep: 0.38 }),
    ...both({ shape: 'cylinder', size: [0.03, 0.26, 0.03], offset: [-0.27, 0, 0.5], rotation: [0, 0, 90], color: LIGHT, segments: 5 }),
    ...pair({ shape: 'wing', size: [0.2, 0.025, 0.24], offset: [-0.4, 0, 0.06], taper: 0.4, sweep: 0.5 }),
    { shape: 'wing', size: [0.3, 0.03, 0.3], offset: [-0.3, 0.05, 0], rotation: [-90, 0, 0], taper: 0.35, sweep: 0.6 },
  ],
};

/** A-10: прямое крыло, пушка в носу, два двигателя-бочки над хвостом, два киля на концах стабилизатора. */
const a10: ModelConfig = {
  id: 'a10',
  parts: [
    { shape: 'cylinder', size: [0.16, 0.6, 0.17], offset: [0, 0, 0], rotation: [0, 0, 90] },
    { shape: 'cylinder', size: [0.16, 0.26, 0.17], offset: [0.43, 0, 0], rotation: [0, 0, -90], taper: 0.45 },
    { shape: 'cylinder', size: [0.16, 0.3, 0.17], offset: [-0.45, 0, 0], rotation: [0, 0, 90], taper: 0.45 },
    { shape: 'cylinder', size: [0.04, 0.12, 0.04], offset: [0.6, -0.035, 0], rotation: [0, 0, 90], color: DARK, segments: 5 },
    { shape: 'sphere', size: [0.26, 0.14, 0.12], offset: [0.27, 0.085, 0], color: GLASS, segments: 6 },
    ...pair({ shape: 'wing', size: [0.27, 0.04, 0.58], offset: [0.05, -0.03, 0.05], taper: 0.65 }),
    ...both({ shape: 'cylinder', size: [0.15, 0.28, 0.15], offset: [-0.2, 0.15, 0.16], rotation: [0, 0, 90] }),
    ...both({ shape: 'cylinder', size: [0.12, 0.03, 0.12], offset: [-0.05, 0.15, 0.16], rotation: [0, 0, 90], color: DARK }),
    ...pair({ shape: 'wing', size: [0.16, 0.03, 0.3], offset: [-0.52, 0.02, 0] }),
    ...both({ shape: 'wing', size: [0.18, 0.03, 0.2], offset: [-0.52, 0.0, 0.3], rotation: [-90, 0, 0], taper: 0.7, sweep: 0.15 }),
  ],
};

/** EA-18G: длинный фонарь, трапециевидное крыло со светлыми контейнерами РЭБ на законцовках и под брюхом, два развалённых киля. */
const growler: ModelConfig = {
  id: 'growler',
  parts: [
    { shape: 'cylinder', size: [0.15, 0.56, 0.2], offset: [-0.12, 0, 0], rotation: [0, 0, 90] },
    { shape: 'cylinder', size: [0.15, 0.44, 0.2], offset: [0.38, 0, 0], rotation: [0, 0, -90], taper: 0.12 },
    { shape: 'sphere', size: [0.4, 0.13, 0.11], offset: [0.2, 0.075, 0], color: GLASS, segments: 6 },
    ...pair({ shape: 'wing', size: [0.34, 0.03, 0.4], offset: [-0.1, 0, 0.09], taper: 0.45, sweep: 0.3 }),
    ...both({ shape: 'cylinder', size: [0.06, 0.3, 0.06], offset: [-0.2, 0, 0.5], rotation: [0, 0, 90], color: LIGHT, segments: 6 }),
    ...pair({ shape: 'wing', size: [0.22, 0.025, 0.26], offset: [-0.42, 0, 0.08], taper: 0.45, sweep: 0.5 }),
    ...pair({ shape: 'wing', size: [0.26, 0.03, 0.27], offset: [-0.28, 0.05, 0.07], rotation: [-65, 0, 0], taper: 0.4, sweep: 0.55 }),
    ...both({ shape: 'cylinder', size: [0.09, 0.1, 0.09], offset: [-0.44, 0, 0.05], rotation: [0, 0, 90], taper: 0.8, color: DARK, segments: 6 }),
    { shape: 'cylinder', size: [0.07, 0.36, 0.09], offset: [0, -0.1, 0], rotation: [0, 0, 90], color: LIGHT, segments: 6 },
  ],
};

/** C-130: толстый фюзеляж с задранным хвостом, высокое прямое крыло, четыре турбовинтовых двигателя с винтами, высокий киль. */
const c130: ModelConfig = {
  id: 'c130',
  parts: [
    { shape: 'cylinder', size: [0.28, 0.6, 0.28], offset: [0.02, 0, 0], rotation: [0, 0, 90] },
    { shape: 'cylinder', size: [0.28, 0.24, 0.28], offset: [0.44, 0, 0], rotation: [0, 0, -90], taper: 0.5 },
    { shape: 'sphere', size: [0.16, 0.15, 0.15], offset: [0.56, -0.02, 0], color: DARK, segments: 6 },
    { shape: 'cylinder', size: [0.28, 0.5, 0.28], offset: [-0.52, 0.045, 0], rotation: [0, 0, 80], taper: 0.3 },
    { shape: 'box', size: [0.1, 0.07, 0.2], offset: [0.43, 0.1, 0], color: GLASS },
    ...pair({ shape: 'wing', size: [0.24, 0.04, 0.62], offset: [0.06, 0.15, 0], taper: 0.6 }),
    ...both({ shape: 'cylinder', size: [0.08, 0.22, 0.08], offset: [0.16, 0.115, 0.2], rotation: [0, 0, 90], color: ENGINE, segments: 6 }),
    ...both({ shape: 'cylinder', size: [0.08, 0.22, 0.08], offset: [0.15, 0.115, 0.42], rotation: [0, 0, 90], color: ENGINE, segments: 6 }),
    ...prop(0.28, 0.115, 0.2, 0.2),
    ...prop(0.28, 0.115, -0.2, 0.2),
    ...prop(0.27, 0.115, 0.42, 0.2),
    ...prop(0.27, 0.115, -0.42, 0.2),
    ...pair({ shape: 'wing', size: [0.18, 0.03, 0.28], offset: [-0.66, 0.13, 0], taper: 0.6 }),
    { shape: 'wing', size: [0.3, 0.035, 0.34], offset: [-0.6, 0.12, 0], rotation: [-90, 0, 0], taper: 0.45, sweep: 0.45 },
  ],
};

/** Общий планер четырёхмоторного лайнера (E-3, KC-135): узкий фюзеляж, стреловидное низкое крыло, двигатели на пилонах под ним. */
const airliner: ModelPart[] = [
  { shape: 'cylinder', size: [0.19, 0.76, 0.19], offset: [0, 0, 0], rotation: [0, 0, 90] },
  { shape: 'cylinder', size: [0.19, 0.22, 0.19], offset: [0.49, 0, 0], rotation: [0, 0, -90], taper: 0.4 },
  { shape: 'cylinder', size: [0.19, 0.3, 0.19], offset: [-0.53, 0.012, 0], rotation: [0, 0, 85], taper: 0.3 },
  { shape: 'box', size: [0.07, 0.05, 0.14], offset: [0.44, 0.065, 0], color: GLASS },
  ...pair({ shape: 'wing', size: [0.3, 0.035, 0.6], offset: [0.08, -0.05, 0.06], taper: 0.3, sweep: 0.75 }),
  ...both({ shape: 'cylinder', size: [0.075, 0.2, 0.075], offset: [0.1, -0.11, 0.26], rotation: [0, 0, 90], color: ENGINE, segments: 6 }),
  ...both({ shape: 'cylinder', size: [0.075, 0.2, 0.075], offset: [-0.02, -0.11, 0.46], rotation: [0, 0, 90], color: ENGINE, segments: 6 }),
  ...pair({ shape: 'wing', size: [0.2, 0.03, 0.26], offset: [-0.56, 0.03, 0.03], taper: 0.4, sweep: 0.6 }),
  { shape: 'wing', size: [0.3, 0.035, 0.32], offset: [-0.52, 0.07, 0], rotation: [-90, 0, 0], taper: 0.4, sweep: 0.6 },
];

/** E-3 Sentry: лайнер с вращающейся «тарелкой» РЛС на двух стойках над фюзеляжем; поперёк тарелки тёмная полоса. */
const e3: ModelConfig = {
  id: 'e3',
  parts: [
    ...airliner,
    ...both({ shape: 'box', size: [0.05, 0.17, 0.025], offset: [-0.2, 0.17, 0.05], color: DARK }),
    { shape: 'cylinder', size: [0.5, 0.06, 0.5], offset: [-0.2, 0.28, 0], color: LIGHT, segments: 12 },
    { shape: 'box', size: [0.1, 0.064, 0.5], offset: [-0.2, 0.28, 0], color: DARK },
  ],
};

/** KC-135: тот же лайнер, под хвостом — оранжевая штанга дозаправки с крылышками. */
const kc135: ModelConfig = {
  id: 'kc135',
  parts: [
    ...airliner,
    { shape: 'cylinder', size: [0.04, 0.4, 0.04], offset: [-0.64, -0.12, 0], rotation: [0, 0, 118], color: BOOM, segments: 5 },
    ...pair({ shape: 'wing', size: [0.08, 0.02, 0.1], offset: [-0.8, -0.2, 0], taper: 0.6, sweep: 0.3, color: BOOM }),
  ],
};

/** Дрон: квадрокоптер — тёмный корпус, крестовина и четыре диска винтов цвета сущности. */
const drone: ModelConfig = {
  id: 'drone',
  parts: [
    { shape: 'sphere', size: [0.38, 0.2, 0.38], color: LIGHT, segments: 6 },
    { shape: 'box', size: [0.9, 0.05, 0.08], rotation: [0, 45, 0], color: DARK },
    { shape: 'box', size: [0.9, 0.05, 0.08], rotation: [0, -45, 0], color: DARK },
    { shape: 'cylinder', size: [0.3, 0.04, 0.3], offset: [0.32, 0.06, 0.32], segments: 8 },
    { shape: 'cylinder', size: [0.3, 0.04, 0.3], offset: [0.32, 0.06, -0.32], segments: 8 },
    { shape: 'cylinder', size: [0.3, 0.04, 0.3], offset: [-0.32, 0.06, 0.32], segments: 8 },
    { shape: 'cylinder', size: [0.3, 0.04, 0.3], offset: [-0.32, 0.06, -0.32], segments: 8 },
  ],
};

/** Беспилотник-разведчик: тонкий фюзеляж, длинное узкое крыло, V-образное оперение и толкающий винт. */
const runner: ModelConfig = {
  id: 'runner',
  parts: [
    { shape: 'cylinder', size: [0.13, 0.56, 0.13], offset: [-0.02, 0, 0], rotation: [0, 0, 90], segments: 6 },
    { shape: 'sphere', size: [0.3, 0.17, 0.15], offset: [0.28, 0.02, 0], color: DARK, segments: 6 },
    ...pair({ shape: 'wing', size: [0.16, 0.03, 0.58], offset: [0.02, 0.04, 0], taper: 0.5, sweep: 0.1 }),
    ...pair({ shape: 'wing', size: [0.14, 0.025, 0.22], offset: [-0.28, 0.03, 0.02], rotation: [-40, 0, 0], taper: 0.6, sweep: 0.3 }),
    ...prop(-0.32, 0, 0, 0.22),
  ],
};

/** Бронетехника: приземистый корпус на гусеницах, башня и длинный ствол вперёд. */
const tank: ModelConfig = {
  id: 'tank',
  parts: [
    { shape: 'box', size: [0.62, 0.16, 0.36] },
    { shape: 'box', size: [0.72, 0.15, 0.12], offset: [0, -0.02, 0.26], color: DARK },
    { shape: 'box', size: [0.72, 0.15, 0.12], offset: [0, -0.02, -0.26], color: DARK },
    { shape: 'cylinder', size: [0.32, 0.12, 0.32], offset: [-0.04, 0.14, 0], segments: 8 },
    { shape: 'cylinder', size: [0.06, 0.5, 0.06], offset: [0.3, 0.15, 0], rotation: [0, 0, -90], color: DARK, segments: 6 },
    { shape: 'box', size: [0.1, 0.05, 0.1], offset: [-0.1, 0.22, 0.06], color: LIGHT },
  ],
};

/** Тяжёлый бомбардировщик: длинный фюзеляж, огромное стреловидное крыло с четырьмя спаренными гондолами, высокий киль. */
const bomber: ModelConfig = {
  id: 'bomber',
  parts: [
    { shape: 'cylinder', size: [0.2, 0.84, 0.2], offset: [0, 0, 0], rotation: [0, 0, 90] },
    { shape: 'cylinder', size: [0.2, 0.26, 0.2], offset: [0.55, 0, 0], rotation: [0, 0, -90], taper: 0.35 },
    { shape: 'cylinder', size: [0.2, 0.3, 0.2], offset: [-0.57, 0, 0], rotation: [0, 0, 90], taper: 0.35 },
    { shape: 'box', size: [0.1, 0.05, 0.14], offset: [0.5, 0.07, 0], color: GLASS },
    ...pair({ shape: 'wing', size: [0.36, 0.04, 0.68], offset: [0.08, 0.06, 0.06], taper: 0.3, sweep: 0.8 }),
    ...both({ shape: 'box', size: [0.24, 0.07, 0.13], offset: [0.1, -0.01, 0.26], color: ENGINE }),
    ...both({ shape: 'box', size: [0.24, 0.07, 0.13], offset: [-0.04, -0.01, 0.5], color: ENGINE }),
    ...pair({ shape: 'wing', size: [0.22, 0.03, 0.3], offset: [-0.6, 0.02, 0.03], taper: 0.4, sweep: 0.6 }),
    { shape: 'wing', size: [0.34, 0.04, 0.4], offset: [-0.56, 0.07, 0], rotation: [-90, 0, 0], taper: 0.35, sweep: 0.6 },
  ],
};

/** Ударный вертолёт: кабина-уступ, хвостовая балка с килем, четырёхлопастный несущий винт, короткие крылья с подвесками. */
const gunship: ModelConfig = {
  id: 'gunship',
  parts: [
    { shape: 'cylinder', size: [0.24, 0.42, 0.2], offset: [0, 0, 0], rotation: [0, 0, 90], segments: 6 },
    { shape: 'sphere', size: [0.32, 0.2, 0.17], offset: [0.24, 0.01, 0], color: GLASS, segments: 6 },
    { shape: 'cylinder', size: [0.14, 0.56, 0.12], offset: [-0.46, 0.03, 0], rotation: [0, 0, 87], taper: 0.3, segments: 6 },
    { shape: 'wing', size: [0.14, 0.03, 0.22], offset: [-0.7, 0.05, 0], rotation: [-90, 0, 0], taper: 0.6, sweep: 0.5 },
    { shape: 'cylinder', size: [0.06, 0.1, 0.06], offset: [0, 0.16, 0], color: DARK, segments: 6 },
    { shape: 'box', size: [1.0, 0.015, 0.07], offset: [0, 0.22, 0], rotation: [0, 20, 0], color: DARK },
    { shape: 'box', size: [0.07, 0.015, 1.0], offset: [0, 0.22, 0], rotation: [0, 20, 0], color: DARK },
    ...pair({ shape: 'wing', size: [0.16, 0.03, 0.26], offset: [0.02, -0.03, 0.08], taper: 0.7 }),
    ...both({ shape: 'cylinder', size: [0.07, 0.22, 0.07], offset: [0.04, -0.07, 0.3], rotation: [0, 0, 90], color: LIGHT, segments: 6 }),
  ],
};

/** Малозаметный БПЛА: бесхвостое «летающее крыло» с пилообразной задней кромкой, тёмный воздухозаборник сверху. */
const ghost: ModelConfig = {
  id: 'ghost',
  parts: [
    ...pair({ shape: 'wing', size: [0.62, 0.06, 0.6], offset: [0.02, 0, 0], taper: 0.12, sweep: 0.75 }),
    ...pair({ shape: 'wing', size: [0.3, 0.09, 0.14], offset: [0.1, 0.02, 0], taper: 0.5, sweep: 0.3 }),
    { shape: 'box', size: [0.16, 0.05, 0.12], offset: [0.02, 0.07, 0], color: DARK },
    { shape: 'box', size: [0.06, 0.05, 0.12], offset: [-0.27, 0.01, 0], color: DARK },
  ],
};

/** Носитель: толстый транспортный фюзеляж с высоким крылом и Т-образным хвостом, под крылом и брюхом — подвешенные дроны. */
const carrier: ModelConfig = {
  id: 'carrier',
  parts: [
    { shape: 'cylinder', size: [0.3, 0.6, 0.3], offset: [0.02, 0, 0], rotation: [0, 0, 90] },
    { shape: 'cylinder', size: [0.3, 0.24, 0.3], offset: [0.44, 0, 0], rotation: [0, 0, -90], taper: 0.45, color: GLASS },
    { shape: 'cylinder', size: [0.3, 0.46, 0.3], offset: [-0.5, 0.04, 0], rotation: [0, 0, 82], taper: 0.3 },
    ...pair({ shape: 'wing', size: [0.3, 0.045, 0.58], offset: [0.04, 0.16, 0], taper: 0.45, sweep: 0.35 }),
    { shape: 'wing', size: [0.26, 0.04, 0.3], offset: [-0.6, 0.1, 0], rotation: [-90, 0, 0], taper: 0.6, sweep: 0.5 },
    ...pair({ shape: 'wing', size: [0.16, 0.03, 0.24], offset: [-0.72, 0.4, 0], taper: 0.5, sweep: 0.4 }),
    ...both({ shape: 'sphere', size: [0.16, 0.11, 0.16], offset: [0.0, 0.07, 0.34], color: LIGHT, segments: 6 }),
    { shape: 'sphere', size: [0.16, 0.11, 0.16], offset: [0.2, -0.19, 0], color: LIGHT, segments: 6 },
    { shape: 'sphere', size: [0.16, 0.11, 0.16], offset: [-0.12, -0.19, 0], color: LIGHT, segments: 6 },
  ],
};

export const MODELS = { f16, a10, growler, c130, e3, kc135, drone, runner, tank, bomber, gunship, ghost, carrier } satisfies Record<string, ModelConfig>;
