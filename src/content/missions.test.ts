import { expect, test } from 'vitest';
import { onMapEdge } from '../sim';
import { MISSIONS } from '.';

test.each(Object.values(MISSIONS))('аэродром миссии $id лежит на краю карты', (m) => {
  expect(onMapEdge(m.size, m.airfield)).toBe(true);
});
