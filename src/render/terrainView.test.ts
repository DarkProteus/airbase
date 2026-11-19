import { expect, test } from 'vitest';
import { ENEMIES } from '../content';
import { DEFAULT_ALTITUDE } from '../view/entity';
import { PEAK_HEIGHT } from './environment';
import { peakTone, RIDGE_OPACITY, slabTone, topLayerColor } from './environmentScene';
import { TERRAIN_PALETTE, terrainCss } from '../view/terrain';

const air = Object.values(ENEMIES).filter((e) => e.tags.includes('air'));
const altitudeOf = (e: (typeof air)[number]) => e.visual?.altitude ?? DEFAULT_ALTITUDE;

test('ни один воздушный враг не летит ниже самой высокой вершины гор', () => {
  expect(air.length).toBeGreaterThan(0);
  for (const e of air) expect(altitudeOf(e), e.id).toBeGreaterThan(PEAK_HEIGHT.mountain[1]);
});

test('хребет выше любого полёта, но не выше предела, после которого он закрывает карту', () => {
  expect(PEAK_HEIGHT.ridge[0]).toBeGreaterThan(Math.max(...air.map(altitudeOf)));
  expect(PEAK_HEIGHT.ridge[1]).toBeLessThanOrEqual(1.8);
});

test('вершины хребта полупрозрачны: сквозь них видно то, что за хребтом', () => {
  expect(RIDGE_OPACITY).toBeGreaterThan(0);
  expect(RIDGE_OPACITY).toBeLessThan(0.7);
});

test('цвет легенды преграды равен цвету верхнего слоя меша на карте (одна палитра на render и ui)', () => {
  for (const kind of ['water', 'mountain', 'ridge'] as const) {
    expect(terrainCss(kind), kind).toBe(`#${topLayerColor(kind).getHexString()}`);
  }
  // внешний вид не менялся: цвета те же, что были у легенды
  expect(terrainCss('water')).toBe('#2f78b8');
  expect(terrainCss('mountain')).toBe('#94805a');
  expect(terrainCss('ridge')).toBe('#969ca6');
});

test('меши преград красятся из общей палитры: оттенок вершины между её краями', () => {
  expect(peakTone('mountain', 0).getHex()).toBe(TERRAIN_PALETTE.mountain.peak[0]);
  expect(peakTone('ridge', 1).getHex()).toBe(TERRAIN_PALETTE.ridge.peak[1]);
  expect(slabTone('water', 0).getHex()).toBe(TERRAIN_PALETTE.water.slab[0]);
});
