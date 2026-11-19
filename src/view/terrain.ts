import type { TerrainKind } from '../sim';

/**
 * Единственный источник цветов преград: рендер красит ими меши, легенда в ui берёт из них же.
 * `slab` — плита на всю клетку (от нижнего оттенка к верхнему), `peak` — вершины (только горы и хребет).
 * Верхний слой преграды: вершины, если они есть, иначе плита; его верхний оттенок и есть цвет легенды.
 */
export const TERRAIN_PALETTE = {
  water: { slab: [0x245f96, 0x2f78b8] },
  mountain: { slab: [0x6f6248, 0x6f6248], peak: [0x7d6b4c, 0x94805a] },
  ridge: { slab: [0x5d6168, 0x5d6168], peak: [0x767c86, 0x969ca6] },
} as const satisfies Record<TerrainKind, { slab: readonly [number, number]; peak?: readonly [number, number] }>;

/** Верхний оттенок верхнего слоя преграды (числом). */
export function terrainTopColor(kind: TerrainKind): number {
  const p = TERRAIN_PALETTE[kind];
  return ('peak' in p ? p.peak : p.slab)[1];
}

/** Цвет вида преграды для легенды в интерфейсе, css `#rrggbb`. */
export function terrainCss(kind: TerrainKind): string {
  return `#${terrainTopColor(kind).toString(16).padStart(6, '0')}`;
}
