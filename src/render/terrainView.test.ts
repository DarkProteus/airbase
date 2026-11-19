import { expect, test } from 'vitest';
import { ENEMIES } from '../content';
import { DEFAULT_ALTITUDE } from '../view/entity';
import { PEAK_HEIGHT } from './environment';
import { RIDGE_OPACITY } from './environmentScene';

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
