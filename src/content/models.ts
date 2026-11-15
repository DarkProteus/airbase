import type { ModelConfig } from '../sim';

/**
 * Реестр составных моделей, по одной на сущность (id модели = ключ = id группы или врага).
 * Оси: X — нос, Y — вверх, Z — вправо; размеры в клетках, габарит при scale 1 — около одной клетки.
 * Деталь без цвета красится цветом сущности; акценты — тёмный (двигатели, остекление) и светлый (контейнеры, диски).
 * Стреловидное крыло — пара коробок с поворотом вокруг Y: правое (+Z) с минусом, левое с плюсом.
 */

const DARK = '#2b2f36';
const GLASS = '#1c2a3a';
const LIGHT = '#e4e9ef';
const BOOM = '#e8833a';

/** F-16: одно сопло, стреловидное крыло, каплевидный фонарь, воздухозаборник под брюхом, один киль. */
const f16: ModelConfig = {
  id: 'f16',
  parts: [
    { shape: 'cylinder', size: [0.17, 0.8, 0.17], rotation: [0, 0, 90], segments: 6 },
    { shape: 'cone', size: [0.17, 0.3, 0.17], offset: [0.54, 0, 0], rotation: [0, 0, -90], segments: 6 },
    { shape: 'sphere', size: [0.36, 0.14, 0.12], offset: [0.14, 0.1, 0], color: GLASS, segments: 6 },
    { shape: 'box', size: [0.22, 0.1, 0.12], offset: [0.16, -0.1, 0], color: DARK },
    { shape: 'box', size: [0.36, 0.035, 0.38], offset: [-0.08, 0, 0.17], rotation: [0, -30, 0] },
    { shape: 'box', size: [0.36, 0.035, 0.38], offset: [-0.08, 0, -0.17], rotation: [0, 30, 0] },
    { shape: 'box', size: [0.18, 0.03, 0.22], offset: [-0.38, 0, 0.1], rotation: [0, -28, 0] },
    { shape: 'box', size: [0.18, 0.03, 0.22], offset: [-0.38, 0, -0.1], rotation: [0, 28, 0] },
    { shape: 'box', size: [0.28, 0.26, 0.04], offset: [-0.34, 0.17, 0], rotation: [0, 0, 22] },
    { shape: 'cylinder', size: [0.13, 0.1, 0.13], offset: [-0.42, 0, 0], rotation: [0, 0, 90], color: DARK, segments: 6 },
  ],
};

/** A-10: прямое широкое крыло, два двигателя-бочки над хвостом, двойной киль на горизонтальном стабилизаторе. */
const a10: ModelConfig = {
  id: 'a10',
  parts: [
    { shape: 'cylinder', size: [0.18, 0.7, 0.18], offset: [0.02, 0, 0], rotation: [0, 0, 90], segments: 6 },
    { shape: 'sphere', size: [0.24, 0.18, 0.18], offset: [0.4, -0.01, 0], segments: 6 },
    { shape: 'cylinder', size: [0.04, 0.24, 0.04], offset: [0.52, -0.06, 0], rotation: [0, 0, 90], color: DARK, segments: 4 },
    { shape: 'sphere', size: [0.26, 0.12, 0.12], offset: [0.2, 0.1, 0], color: GLASS, segments: 6 },
    { shape: 'box', size: [0.3, 0.05, 1.1], offset: [0.04, 0.02, 0] },
    { shape: 'cylinder', size: [0.14, 0.36, 0.14], offset: [-0.24, 0.15, 0.15], rotation: [0, 0, 90], color: DARK, segments: 6 },
    { shape: 'cylinder', size: [0.14, 0.36, 0.14], offset: [-0.24, 0.15, -0.15], rotation: [0, 0, 90], color: DARK, segments: 6 },
    { shape: 'box', size: [0.17, 0.03, 0.58], offset: [-0.38, 0.1, 0] },
    { shape: 'box', size: [0.16, 0.24, 0.03], offset: [-0.38, 0.21, 0.28] },
    { shape: 'box', size: [0.16, 0.24, 0.03], offset: [-0.38, 0.21, -0.28] },
  ],
};

/** EA-18G: два двигателя, два развалённых киля, светлые контейнеры РЭБ на законцовках крыла и под фюзеляжем. */
const growler: ModelConfig = {
  id: 'growler',
  parts: [
    { shape: 'cylinder', size: [0.16, 0.76, 0.16], rotation: [0, 0, 90], segments: 6 },
    { shape: 'cone', size: [0.15, 0.3, 0.15], offset: [0.52, 0, 0], rotation: [0, 0, -90], segments: 6 },
    { shape: 'sphere', size: [0.32, 0.12, 0.11], offset: [0.14, 0.09, 0], color: GLASS, segments: 6 },
    { shape: 'box', size: [0.3, 0.03, 0.54], offset: [-0.06, 0, 0.27], rotation: [0, -22, 0] },
    { shape: 'box', size: [0.3, 0.03, 0.54], offset: [-0.06, 0, -0.27], rotation: [0, 22, 0] },
    { shape: 'box', size: [0.16, 0.025, 0.26], offset: [-0.34, 0, 0.14], rotation: [0, -20, 0] },
    { shape: 'box', size: [0.16, 0.025, 0.26], offset: [-0.34, 0, -0.14], rotation: [0, 20, 0] },
    { shape: 'box', size: [0.24, 0.24, 0.03], offset: [-0.3, 0.16, 0.07], rotation: [24, 0, 18] },
    { shape: 'box', size: [0.24, 0.24, 0.03], offset: [-0.3, 0.16, -0.07], rotation: [-24, 0, 18] },
    { shape: 'cylinder', size: [0.08, 0.1, 0.08], offset: [-0.4, 0, 0.05], rotation: [0, 0, 90], color: DARK, segments: 6 },
    { shape: 'cylinder', size: [0.08, 0.1, 0.08], offset: [-0.4, 0, -0.05], rotation: [0, 0, 90], color: DARK, segments: 6 },
    { shape: 'cylinder', size: [0.075, 0.3, 0.075], offset: [-0.18, 0, 0.5], rotation: [0, 0, 90], color: LIGHT, segments: 6 },
    { shape: 'cylinder', size: [0.075, 0.3, 0.075], offset: [-0.18, 0, -0.5], rotation: [0, 0, 90], color: LIGHT, segments: 6 },
    { shape: 'box', size: [0.34, 0.07, 0.1], offset: [0.02, -0.1, 0], color: LIGHT },
  ],
};

/** C-130: толстый фюзеляж, высокое прямое крыло, четыре турбовинтовых двигателя, высокий киль. */
const c130: ModelConfig = {
  id: 'c130',
  parts: [
    { shape: 'cylinder', size: [0.3, 0.92, 0.3], offset: [-0.02, 0, 0], rotation: [0, 0, 90], segments: 8 },
    { shape: 'sphere', size: [0.3, 0.3, 0.3], offset: [0.46, 0, 0], segments: 8 },
    { shape: 'box', size: [0.1, 0.07, 0.22], offset: [0.4, 0.12, 0], color: GLASS },
    { shape: 'box', size: [0.26, 0.04, 1.2], offset: [0.0, 0.18, 0] },
    { shape: 'cylinder', size: [0.1, 0.3, 0.1], offset: [0.1, 0.14, 0.2], rotation: [0, 0, 90], color: DARK, segments: 6 },
    { shape: 'cylinder', size: [0.1, 0.3, 0.1], offset: [0.1, 0.14, -0.2], rotation: [0, 0, 90], color: DARK, segments: 6 },
    { shape: 'cylinder', size: [0.1, 0.3, 0.1], offset: [0.1, 0.14, 0.44], rotation: [0, 0, 90], color: DARK, segments: 6 },
    { shape: 'cylinder', size: [0.1, 0.3, 0.1], offset: [0.1, 0.14, -0.44], rotation: [0, 0, 90], color: DARK, segments: 6 },
    { shape: 'cylinder', size: [0.22, 0.012, 0.22], offset: [0.26, 0.14, 0.2], rotation: [0, 0, 90], color: LIGHT, segments: 8 },
    { shape: 'cylinder', size: [0.22, 0.012, 0.22], offset: [0.26, 0.14, -0.2], rotation: [0, 0, 90], color: LIGHT, segments: 8 },
    { shape: 'cylinder', size: [0.22, 0.012, 0.22], offset: [0.26, 0.14, 0.44], rotation: [0, 0, 90], color: LIGHT, segments: 8 },
    { shape: 'cylinder', size: [0.22, 0.012, 0.22], offset: [0.26, 0.14, -0.44], rotation: [0, 0, 90], color: LIGHT, segments: 8 },
    { shape: 'box', size: [0.2, 0.03, 0.5], offset: [-0.44, 0.2, 0] },
    { shape: 'box', size: [0.28, 0.4, 0.04], offset: [-0.42, 0.3, 0], rotation: [0, 0, 14] },
  ],
};

/** E-3 Sentry: четырёхмоторный лайнер, над фюзеляжем на пилоне светлая «тарелка» обтекателя РЛС. */
const e3: ModelConfig = {
  id: 'e3',
  parts: [
    { shape: 'cylinder', size: [0.2, 0.98, 0.2], offset: [-0.02, 0, 0], rotation: [0, 0, 90], segments: 8 },
    { shape: 'sphere', size: [0.24, 0.2, 0.2], offset: [0.48, 0, 0], segments: 8 },
    { shape: 'box', size: [0.08, 0.05, 0.14], offset: [0.4, 0.09, 0], color: GLASS },
    { shape: 'box', size: [0.3, 0.035, 0.56], offset: [0.0, -0.03, 0.3], rotation: [0, -25, 0] },
    { shape: 'box', size: [0.3, 0.035, 0.56], offset: [0.0, -0.03, -0.3], rotation: [0, 25, 0] },
    { shape: 'cylinder', size: [0.1, 0.24, 0.1], offset: [0.06, -0.1, 0.2], rotation: [0, 0, 90], color: DARK, segments: 6 },
    { shape: 'cylinder', size: [0.1, 0.24, 0.1], offset: [0.06, -0.1, -0.2], rotation: [0, 0, 90], color: DARK, segments: 6 },
    { shape: 'cylinder', size: [0.1, 0.24, 0.1], offset: [-0.06, -0.1, 0.42], rotation: [0, 0, 90], color: DARK, segments: 6 },
    { shape: 'cylinder', size: [0.1, 0.24, 0.1], offset: [-0.06, -0.1, -0.42], rotation: [0, 0, 90], color: DARK, segments: 6 },
    { shape: 'box', size: [0.16, 0.03, 0.46], offset: [-0.46, 0.03, 0] },
    { shape: 'box', size: [0.24, 0.28, 0.035], offset: [-0.44, 0.2, 0], rotation: [0, 0, 16] },
    { shape: 'box', size: [0.06, 0.14, 0.06], offset: [-0.02, 0.16, 0], color: DARK },
    { shape: 'cylinder', size: [0.54, 0.07, 0.54], offset: [-0.02, 0.27, 0], color: LIGHT, segments: 8 },
  ],
};

/** KC-135: четырёхмоторный лайнер, под хвостом оранжевая штанга дозаправки с оперением. */
const kc135: ModelConfig = {
  id: 'kc135',
  parts: [
    { shape: 'cylinder', size: [0.2, 0.9, 0.2], offset: [-0.02, 0, 0], rotation: [0, 0, 90], segments: 8 },
    { shape: 'sphere', size: [0.22, 0.2, 0.2], offset: [0.44, 0, 0], segments: 8 },
    { shape: 'box', size: [0.08, 0.05, 0.14], offset: [0.36, 0.09, 0], color: GLASS },
    { shape: 'box', size: [0.3, 0.035, 0.56], offset: [0.0, -0.03, 0.3], rotation: [0, -25, 0] },
    { shape: 'box', size: [0.3, 0.035, 0.56], offset: [0.0, -0.03, -0.3], rotation: [0, 25, 0] },
    { shape: 'cylinder', size: [0.1, 0.24, 0.1], offset: [0.06, -0.1, 0.2], rotation: [0, 0, 90], color: DARK, segments: 6 },
    { shape: 'cylinder', size: [0.1, 0.24, 0.1], offset: [0.06, -0.1, -0.2], rotation: [0, 0, 90], color: DARK, segments: 6 },
    { shape: 'cylinder', size: [0.1, 0.24, 0.1], offset: [-0.06, -0.1, 0.42], rotation: [0, 0, 90], color: DARK, segments: 6 },
    { shape: 'cylinder', size: [0.1, 0.24, 0.1], offset: [-0.06, -0.1, -0.42], rotation: [0, 0, 90], color: DARK, segments: 6 },
    { shape: 'box', size: [0.16, 0.03, 0.46], offset: [-0.44, 0.03, 0] },
    { shape: 'box', size: [0.24, 0.28, 0.035], offset: [-0.42, 0.2, 0], rotation: [0, 0, 16] },
    { shape: 'box', size: [0.3, 0.04, 0.05], offset: [-0.58, -0.09, 0], rotation: [0, 0, 18], color: BOOM },
    { shape: 'box', size: [0.1, 0.02, 0.22], offset: [-0.72, -0.14, 0], color: BOOM },
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

/** Беспилотник-разведчик: узкий фюзеляж, длинное прямое крыло, V-образное оперение и светлый диск толкающего винта. */
const runner: ModelConfig = {
  id: 'runner',
  parts: [
    { shape: 'cylinder', size: [0.14, 0.62, 0.14], rotation: [0, 0, 90], segments: 6 },
    { shape: 'cone', size: [0.14, 0.22, 0.14], offset: [0.4, 0, 0], rotation: [0, 0, -90], color: DARK, segments: 6 },
    { shape: 'box', size: [0.18, 0.035, 1.15], offset: [0.06, 0.04, 0] },
    { shape: 'box', size: [0.14, 0.2, 0.03], offset: [-0.3, 0.1, 0.07], rotation: [30, 0, 0] },
    { shape: 'box', size: [0.14, 0.2, 0.03], offset: [-0.3, 0.1, -0.07], rotation: [-30, 0, 0] },
    { shape: 'cylinder', size: [0.24, 0.015, 0.24], offset: [-0.35, 0, 0], rotation: [0, 0, 90], color: LIGHT, segments: 8 },
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

/** Тяжёлый бомбардировщик: длинное стреловидное крыло с четырьмя гондолами двигателей впереди, высокий киль. */
const bomber: ModelConfig = {
  id: 'bomber',
  parts: [
    { shape: 'cylinder', size: [0.2, 1.0, 0.2], rotation: [0, 0, 90], segments: 6 },
    { shape: 'cone', size: [0.2, 0.3, 0.2], offset: [0.6, 0, 0], rotation: [0, 0, -90], segments: 6 },
    { shape: 'sphere', size: [0.26, 0.12, 0.14], offset: [0.38, 0.1, 0], color: GLASS, segments: 6 },
    { shape: 'box', size: [0.26, 0.05, 0.62], offset: [0, 0.02, 0.32], rotation: [0, -22, 0] },
    { shape: 'box', size: [0.26, 0.05, 0.62], offset: [0, 0.02, -0.32], rotation: [0, 22, 0] },
    { shape: 'cylinder', size: [0.12, 0.3, 0.12], offset: [0.2, 0.03, 0.2], rotation: [0, 0, 90], color: DARK, segments: 6 },
    { shape: 'cylinder', size: [0.12, 0.3, 0.12], offset: [0.2, 0.03, -0.2], rotation: [0, 0, 90], color: DARK, segments: 6 },
    { shape: 'cylinder', size: [0.12, 0.3, 0.12], offset: [0.1, 0.03, 0.45], rotation: [0, 0, 90], color: DARK, segments: 6 },
    { shape: 'cylinder', size: [0.12, 0.3, 0.12], offset: [0.1, 0.03, -0.45], rotation: [0, 0, 90], color: DARK, segments: 6 },
    { shape: 'box', size: [0.2, 0.04, 0.5], offset: [-0.46, 0.04, 0] },
    { shape: 'box', size: [0.3, 0.36, 0.04], offset: [-0.44, 0.24, 0], rotation: [0, 0, 20] },
  ],
};

/** Ударный вертолёт: пузатый корпус, хвостовая балка, диск несущего винта и короткие пилоны с подвесками. */
const gunship: ModelConfig = {
  id: 'gunship',
  parts: [
    { shape: 'box', size: [0.5, 0.24, 0.22] },
    { shape: 'sphere', size: [0.3, 0.22, 0.2], offset: [0.26, 0.02, 0], color: GLASS, segments: 6 },
    { shape: 'box', size: [0.5, 0.07, 0.07], offset: [-0.46, 0.05, 0] },
    { shape: 'box', size: [0.06, 0.22, 0.04], offset: [-0.7, 0.13, 0] },
    { shape: 'cylinder', size: [0.06, 0.1, 0.06], offset: [0, 0.17, 0], color: DARK, segments: 6 },
    { shape: 'cylinder', size: [0.95, 0.02, 0.95], offset: [0, 0.23, 0], color: DARK, segments: 10 },
    { shape: 'box', size: [0.14, 0.04, 0.52], offset: [0.02, -0.04, 0], color: DARK },
    { shape: 'cylinder', size: [0.08, 0.22, 0.08], offset: [0.04, -0.08, 0.26], rotation: [0, 0, 90], color: LIGHT, segments: 6 },
    { shape: 'cylinder', size: [0.08, 0.22, 0.08], offset: [0.04, -0.08, -0.26], rotation: [0, 0, 90], color: LIGHT, segments: 6 },
  ],
};

/** Малозаметный БПЛА: плоское «летающее крыло» без киля, тёмный воздухозаборник сверху. */
const ghost: ModelConfig = {
  id: 'ghost',
  parts: [
    { shape: 'box', size: [0.5, 0.07, 0.22] },
    { shape: 'cone', size: [0.22, 0.24, 0.07], offset: [0.36, 0, 0], rotation: [0, 0, -90], segments: 4 },
    { shape: 'box', size: [0.26, 0.04, 0.56], offset: [-0.06, 0, 0.3], rotation: [0, -32, 0] },
    { shape: 'box', size: [0.26, 0.04, 0.56], offset: [-0.06, 0, -0.3], rotation: [0, 32, 0] },
    { shape: 'box', size: [0.2, 0.05, 0.12], offset: [0.06, 0.05, 0], color: DARK },
    { shape: 'box', size: [0.08, 0.05, 0.14], offset: [-0.26, 0, 0], color: DARK },
  ],
};

/** Носитель: толстый транспортный фюзеляж с прямым крылом, под ним — подвешенные дроны. */
const carrier: ModelConfig = {
  id: 'carrier',
  parts: [
    { shape: 'cylinder', size: [0.3, 0.9, 0.3], rotation: [0, 0, 90], segments: 8 },
    { shape: 'sphere', size: [0.3, 0.3, 0.3], offset: [0.45, 0, 0], color: GLASS, segments: 6 },
    { shape: 'cone', size: [0.3, 0.3, 0.3], offset: [-0.6, 0, 0], rotation: [0, 0, 90], segments: 8 },
    { shape: 'box', size: [0.24, 0.05, 1.1], offset: [0.02, 0.16, 0] },
    { shape: 'box', size: [0.16, 0.04, 0.44], offset: [-0.58, 0.06, 0] },
    { shape: 'box', size: [0.2, 0.3, 0.04], offset: [-0.56, 0.2, 0], rotation: [0, 0, 20] },
    { shape: 'sphere', size: [0.16, 0.12, 0.16], offset: [0.06, 0.06, 0.34], color: LIGHT, segments: 6 },
    { shape: 'sphere', size: [0.16, 0.12, 0.16], offset: [0.06, 0.06, -0.34], color: LIGHT, segments: 6 },
    { shape: 'sphere', size: [0.16, 0.12, 0.16], offset: [0.2, -0.2, 0], color: LIGHT, segments: 6 },
    { shape: 'sphere', size: [0.16, 0.12, 0.16], offset: [-0.14, -0.2, 0], color: LIGHT, segments: 6 },
  ],
};

export const MODELS = { f16, a10, growler, c130, e3, kc135, drone, runner, tank, bomber, gunship, ghost, carrier } satisfies Record<string, ModelConfig>;
