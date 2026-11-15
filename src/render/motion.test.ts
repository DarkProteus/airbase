import { expect, test } from 'vitest';
import { headingOf, turnToward } from './motion';

test('headingOf: нос модели (+X) смотрит по движению; стоя на месте курс не меняется', () => {
  expect(headingOf(1, 0)).toBeCloseTo(0);
  expect(headingOf(0, 1)).toBeCloseTo(-Math.PI / 2); // клетка y -> мир z
  expect(headingOf(0, -1)).toBeCloseTo(Math.PI / 2);
  expect(Math.abs(headingOf(-1, 0)!)).toBeCloseTo(Math.PI);
  expect(headingOf(0, 0)).toBeNull();
  // Поворот на этот угол вокруг Y переводит (1,0,0) в направление движения.
  for (const [dx, dy] of [[1, 2], [-3, 1], [-1, -1], [2, -5]] as const) {
    const a = headingOf(dx, dy)!;
    const l = Math.hypot(dx, dy);
    expect(Math.cos(a)).toBeCloseTo(dx / l);
    expect(-Math.sin(a)).toBeCloseTo(dy / l);
  }
});

test('turnToward: кратчайшая дуга, шаг не больше maxStep, в конце — ровно цель', () => {
  expect(turnToward(0, 1, 0.25)).toBeCloseTo(0.25);
  expect(turnToward(0, 1, 2)).toBe(1);
  expect(turnToward(3, -3, 0.1)).toBeCloseTo(3.1); // через ±π, а не назад через 0
  expect(turnToward(-3, 3, 0.1)).toBeCloseTo(-3.1);
  expect(turnToward(1, 1, 0)).toBe(1);
  expect(turnToward(0, 1, Infinity)).toBe(1);
});
