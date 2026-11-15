import type { ModelConfig } from '../sim';

/**
 * Реестр составных моделей. Оси: X — нос, Y — вверх, Z — вправо; размеры в клетках.
 * Деталь без цвета красится цветом сущности, поэтому одну модель можно дать разным группам.
 */

/** Реактивный самолёт: фюзеляж, нос, кабина, крыло, стабилизатор и киль. */
const jet: ModelConfig = {
  id: 'jet',
  parts: [
    { shape: 'box', size: [0.72, 0.13, 0.13] },
    { shape: 'cone', size: [0.13, 0.26, 0.13], offset: [0.49, 0, 0], rotation: [0, 0, -90], segments: 4 },
    { shape: 'box', size: [0.2, 0.07, 0.09], offset: [0.16, 0.09, 0], color: '#1c2a3a' },
    { shape: 'box', size: [0.26, 0.03, 0.78], offset: [-0.06, 0, 0] },
    { shape: 'box', size: [0.14, 0.03, 0.36], offset: [-0.31, 0, 0] },
    { shape: 'box', size: [0.18, 0.2, 0.03], offset: [-0.28, 0.14, 0], rotation: [0, 0, 20] },
    { shape: 'cylinder', size: [0.09, 0.05, 0.09], offset: [-0.38, 0, 0], rotation: [0, 0, 90], color: '#2b2f36' },
  ],
};

export const MODELS = { jet } satisfies Record<string, ModelConfig>;
