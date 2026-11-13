import { describe, expect, test } from 'vitest';
import { runMatch, type BuildStep, type MatchResult } from '../sim';
import { CONTENT, MISSIONS, UNITS } from '.';

const mission = MISSIONS.sortie!;
const SEEDS = [1, 2, 3];
const mono = (unit: string): BuildStep[] => [1, 2, 4, 3, 5, 0, 6, 7].map((slot) => ({ unit, slot }));
/** Эталонный смешанный состав: F-16 по периметру, C-130 в тылу, Growler в центре связки. */
const MIXED: BuildStep[] = [
  { unit: 'f16', slot: 1 },
  { unit: 'f16', slot: 2 },
  { unit: 'c130', slot: 0 },
  { unit: 'f16', slot: 4 },
  { unit: 'growler', slot: 3 },
  { unit: 'growler', slot: 5 },
  { unit: 'f16', slot: 6 },
  { unit: 'f16', slot: 7 },
];
/** Чем больше, тем лучше: победа важнее всего, затем жизни, затем убийства. */
const score = (r: MatchResult) => (r.status === 'won' ? 1e6 : 0) + Math.max(r.lives, 0) * 1e3 + r.kills;
const play = (order: BuildStep[]) => SEEDS.map((seed) => runMatch(mission, CONTENT, seed, order));

describe('баланс эталонной миссии (headless)', () => {
  const mixed = play(MIXED);

  test('смешанный состав проходит миссию', () => {
    expect(mixed.map((r) => r.status)).toEqual(SEEDS.map(() => 'won'));
  });

  test.each(Object.keys(UNITS))('моно-состав %s не выигрывает лучше смешанного', (unit) => {
    const res = play(mono(unit));
    res.forEach((r, i) => expect(score(r)).toBeLessThan(score(mixed[i]!)));
  });

  test('эталонный состав использует все три роли', () => {
    expect(new Set(MIXED.map((s) => UNITS[s.unit]!.role)).size).toBe(3);
  });
});
