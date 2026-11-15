import type { ModelConfig, ModelPart } from '../sim';

/**
 * Модели окружения карты как данные (тот же формат, что у техники: `buildModel`).
 * Оси: X — «нос» (у ворот — направление пролёта, у ангара — сторона ворот), Y — вверх, Z — вправо. Размеры в клетках.
 */

/** Ангар: коробка с полуцилиндрической крышей и тёмными воротами. */
export const HANGAR: ModelConfig = {
  id: 'env-hangar',
  parts: [
    { shape: 'box', size: [1.1, 0.3, 0.7], offset: [0, 0.15, 0], color: '#7d8794' },
    { shape: 'cylinder', size: [0.7, 1.1, 0.7], offset: [0, 0.3, 0], rotation: [0, 0, 90], color: '#5d6b7a', segments: 8 },
    { shape: 'box', size: [0.03, 0.26, 0.46], offset: [0.54, 0.15, 0], color: '#2a2f36' },
  ],
};

/** Диспетчерская вышка. */
export const TOWER: ModelConfig = {
  id: 'env-tower',
  parts: [
    { shape: 'box', size: [0.3, 0.2, 0.3], offset: [0, 0.1, 0], color: '#8a929c' },
    { shape: 'cylinder', size: [0.14, 0.5, 0.14], offset: [0, 0.45, 0], color: '#a2a9b2', segments: 6 },
    { shape: 'box', size: [0.32, 0.14, 0.32], offset: [0, 0.77, 0], color: '#4a90b8' },
    { shape: 'box', size: [0.38, 0.04, 0.38], offset: [0, 0.86, 0], color: '#cfd4da' },
    { shape: 'cylinder', size: [0.02, 0.22, 0.02], offset: [0, 1, 0], color: '#cfd4da', segments: 4 },
  ],
};

/** Топливные цистерны. */
export const FUEL: ModelConfig = {
  id: 'env-fuel',
  parts: [
    { shape: 'cylinder', size: [0.38, 0.3, 0.38], offset: [0, 0.15, -0.24], color: '#c9ccd1', segments: 10 },
    { shape: 'cylinder', size: [0.38, 0.3, 0.38], offset: [0, 0.15, 0.24], color: '#c9ccd1', segments: 10 },
    { shape: 'cylinder', size: [0.4, 0.05, 0.4], offset: [0, 0.2, -0.24], color: '#b5533c', segments: 10 },
    { shape: 'cylinder', size: [0.4, 0.05, 0.4], offset: [0, 0.2, 0.24], color: '#b5533c', segments: 10 },
  ],
};

/** Штаб (цель defend и база на пути): плита, здание с зелёной крышей, антенна, тарелка, мешки с песком. */
export const HQ: ModelConfig = {
  id: 'env-hq',
  parts: [
    { shape: 'box', size: [1.5, 0.05, 1.5], offset: [0, 0.025, 0], color: '#4b5148' },
    { shape: 'box', size: [0.9, 0.5, 0.7], offset: [0, 0.3, -0.05], color: '#aab2a6' },
    { shape: 'box', size: [1.0, 0.08, 0.8], offset: [0, 0.59, -0.05], color: '#3d9c6b' },
    { shape: 'box', size: [0.02, 0.2, 0.3], offset: [0.46, 0.2, -0.05], color: '#2a2f36' },
    { shape: 'cylinder', size: [0.05, 0.55, 0.05], offset: [-0.3, 0.9, -0.2], color: '#cfd4da', segments: 5 },
    { shape: 'sphere', size: [0.22, 0.1, 0.22], offset: [0.25, 0.68, 0.1], color: '#e8e8e8', segments: 8 },
    { shape: 'box', size: [0.12, 0.1, 0.4], offset: [0.62, 0.1, 0.5], color: '#8a7a55' },
    { shape: 'box', size: [0.12, 0.1, 0.4], offset: [0.62, 0.1, -0.6], color: '#8a7a55' },
    { shape: 'box', size: [0.4, 0.1, 0.12], offset: [0.4, 0.1, 0.62], color: '#8a7a55' },
  ],
};

const wheels = (x: number, z: number, r: number): ModelPart[] =>
  [-1, 1].flatMap((sx) => [-1, 1].map((sz): ModelPart => ({ shape: 'cylinder', size: [r, 0.06, r], offset: [sx * x, r / 2, sz * z], rotation: [90, 0, 0], color: '#1f2328', segments: 8 })));

/** Командирский джип колонны (идёт первым). */
export const CONVOY_JEEP: ModelConfig = {
  id: 'env-convoy-jeep',
  parts: [
    { shape: 'box', size: [0.55, 0.12, 0.3], offset: [0, 0.12, 0], color: '#3d9c6b' },
    { shape: 'box', size: [0.24, 0.16, 0.28], offset: [-0.02, 0.26, 0], color: '#3d9c6b' },
    { shape: 'box', size: [0.02, 0.1, 0.24], offset: [0.11, 0.27, 0], color: '#9ecfe8' },
    { shape: 'box', size: [0.04, 0.04, 0.08], offset: [0, 0.37, 0], color: '#ffd166' },
    ...wheels(0.18, 0.16, 0.14),
  ],
};

/** Грузовик с тентом; цвет тента — цвет сущности. */
export const CONVOY_TRUCK: ModelConfig = {
  id: 'env-convoy-truck',
  parts: [
    { shape: 'box', size: [0.7, 0.1, 0.3], offset: [0, 0.12, 0], color: '#2c3138' },
    { shape: 'box', size: [0.2, 0.22, 0.3], offset: [0.26, 0.28, 0], color: '#3d9c6b' },
    { shape: 'box', size: [0.02, 0.1, 0.24], offset: [0.37, 0.31, 0], color: '#9ecfe8' },
    { shape: 'box', size: [0.4, 0.26, 0.3], offset: [-0.12, 0.3, 0] },
    ...wheels(0.22, 0.16, 0.14),
  ],
};

/** Бензовоз. */
export const CONVOY_TANKER: ModelConfig = {
  id: 'env-convoy-tanker',
  parts: [
    { shape: 'box', size: [0.7, 0.1, 0.3], offset: [0, 0.12, 0], color: '#2c3138' },
    { shape: 'box', size: [0.2, 0.22, 0.3], offset: [0.26, 0.28, 0], color: '#3d9c6b' },
    { shape: 'box', size: [0.02, 0.1, 0.24], offset: [0.37, 0.31, 0], color: '#9ecfe8' },
    { shape: 'cylinder', size: [0.26, 0.42, 0.26], offset: [-0.12, 0.33, 0], rotation: [0, 0, 90], color: '#c9ccd1', segments: 10 },
    ...wheels(0.22, 0.16, 0.14),
  ],
};

/** Состав колонны: модель и цвет (для деталей без своего цвета) по порядку от головы. */
export const CONVOY_CARS: readonly { model: ModelConfig; color: string }[] = [
  { model: CONVOY_JEEP, color: '#3d9c6b' },
  { model: CONVOY_TRUCK, color: '#8d9a6a' },
  { model: CONVOY_TANKER, color: '#c9ccd1' },
  { model: CONVOY_TRUCK, color: '#aab2a6' },
];

/** Расстояние между машинами колонны по маршруту, клеток. */
export const CONVOY_GAP = 0.8;

/**
 * Ворота входа врагов: площадка, две красные стойки с перекладиной и огнями, стрелка внутрь карты.
 * Пролёт идёт вдоль +X (в сцене модель поворачивается носом внутрь карты).
 */
export const SPAWN_GATE: ModelConfig = {
  id: 'env-spawn-gate',
  parts: [
    { shape: 'box', size: [0.95, 0.04, 0.95], offset: [0, 0.02, 0], color: '#7a352c' },
    { shape: 'cone', size: [0.3, 0.42, 0.3], offset: [0.22, 0.18, 0], rotation: [0, 0, -90], color: '#ff6a3d', segments: 3 },
    { shape: 'box', size: [0.09, 0.75, 0.09], offset: [-0.1, 0.4, -0.4], color: '#ff5a3c' },
    { shape: 'box', size: [0.09, 0.75, 0.09], offset: [-0.1, 0.4, 0.4], color: '#ff5a3c' },
    { shape: 'box', size: [0.1, 0.1, 0.89], offset: [-0.1, 0.78, 0], color: '#ff5a3c' },
    { shape: 'sphere', size: [0.16, 0.16, 0.16], offset: [-0.1, 0.9, -0.4], color: '#ffb36b', segments: 6 },
    { shape: 'sphere', size: [0.16, 0.16, 0.16], offset: [-0.1, 0.9, 0.4], color: '#ffb36b', segments: 6 },
  ],
};

/** Взлётная полоса заданной длины: асфальт, осевая прерывистая разметка, поперечные полосы у торцов. */
export function runwayModel(length: number): ModelConfig {
  const parts: ModelPart[] = [{ shape: 'box', size: [length, 0.04, 0.85], offset: [0, 0.02, 0], color: '#3b4048' }];
  const dashes = Math.max(1, Math.floor((length - 0.8) / 0.7));
  const start = -((dashes - 1) * 0.7) / 2;
  for (let i = 0; i < dashes; i++) parts.push({ shape: 'box', size: [0.34, 0.012, 0.07], offset: [start + i * 0.7, 0.046, 0], color: '#e8e8e8' });
  for (const s of [-1, 1]) parts.push({ shape: 'box', size: [0.1, 0.012, 0.6], offset: [s * (length / 2 - 0.15), 0.046, 0], color: '#e8e8e8' });
  return { id: `env-runway-${length.toFixed(2)}`, parts };
}

/** Все постоянные модели окружения (для проверок). */
export const PROP_MODELS: readonly ModelConfig[] = [HANGAR, TOWER, FUEL, HQ, CONVOY_JEEP, CONVOY_TRUCK, CONVOY_TANKER, SPAWN_GATE, runwayModel(4)];
