import { describe, expect, test } from 'vitest';
import { createSim, inMap, onMapEdge, snapshot, step, TICK_RATE } from '../sim';
import type { MissionConfig } from '../sim';
import { CONTENT, DEFAULT_LINEUP, MISSIONS } from '.';

test.each(Object.values(MISSIONS))('аэродром миссии $id лежит на краю карты', (m) => {
  expect(onMapEdge(m.size, m.airfield)).toBe(true);
});

const withObjective = Object.values(MISSIONS).filter((m) => m.objective);
const LIMIT = 600 * TICK_RATE;
const play = (m: MissionConfig, seed: number, lineup = DEFAULT_LINEUP) => {
  const sim = createSim(m, CONTENT, seed, lineup);
  while (sim.state.status === 'running' && sim.state.tick < LIMIT) step(sim);
  return snapshot(sim);
};

describe('миссии с целью (headless)', () => {
  test('есть по миссии на каждый тип цели', () => {
    expect(withObjective.map((m) => m.objective!.type).sort()).toEqual(['defend', 'escort']);
  });

  test.each(withObjective)('$id: точки входа, цель и маршрут лежат на карте', (m) => {
    const o = m.objective!;
    const cells = [...m.spawns!, ...(o.type === 'escort' ? o.route : [o.pos])];
    for (const c of cells) expect(inMap(m.size, c)).toBe(true);
  });

  test.each(withObjective)('$id: прогон доходит до победы или поражения', (m) => {
    expect(['won', 'lost']).toContain(play(m, 1).status);
    // Без авиации цель не выживает: исход решают группы, а не таймер.
    expect(play(m, 1, []).status).toBe('lost');
  });

  test.each(withObjective)('$id: полный прогон детерминирован по сиду', (m) => {
    const a = play(m, 7);
    expect(play(m, 7)).toEqual(a);
    expect(play(m, 8)).not.toEqual(a);
  });
});
