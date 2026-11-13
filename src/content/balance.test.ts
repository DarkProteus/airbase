import { describe, expect, test } from 'vitest';
import { runMatch } from '../sim';
import { CONTENT, GROUPS, LINEUP_SIZE, MISSIONS } from '.';

const SEEDS = [1, 2, 3];

/** Все сочетания по k элементов. */
const combos = <T>(items: T[], k: number): T[][] =>
  k === 0 ? [[]] : items.flatMap((x, i) => combos(items.slice(i + 1), k - 1).map((rest) => [x, ...rest]));

const LINEUPS = combos(Object.keys(GROUPS), LINEUP_SIZE);
const missions = Object.values(MISSIONS);

/** Headless-бот прогоняет состав по всем сидам. Оценка: сначала число побед, затем средняя награда. */
function rate(mission: (typeof missions)[number], lineup: string[]) {
  const runs = SEEDS.map((seed) => runMatch(mission, CONTENT, seed, lineup));
  const wins = runs.filter((r) => r.status === 'won').length;
  return { lineup, wins, score: wins * 1e6 + runs.reduce((sum, r) => sum + r.reward, 0) / runs.length };
}

describe('баланс составов 3 из 4 (headless)', () => {
  const table = missions.map((m) => ({ id: m.id, rows: LINEUPS.map((l) => rate(m, l)) }));
  const best = table.map((t) => t.rows.reduce((a, b) => (b.score > a.score ? b : a)));

  test('миссий две, составов — все сочетания 3 из 4', () => {
    expect(missions).toHaveLength(2);
    expect(LINEUPS).toHaveLength(4);
  });

  test.each(table)('$id проходима хотя бы одним составом на всех сидах', ({ rows }) => {
    expect(rows.some((r) => r.wins === SEEDS.length)).toBe(true);
  });

  test.each(table)('$id не проходится любым составом: выбор имеет значение', ({ rows }) => {
    expect(rows.some((r) => r.wins === 0)).toBe(true);
  });

  test('лучшие составы двух миссий различаются', () => {
    expect(best[0]!.lineup).not.toEqual(best[1]!.lineup);
  });

  test.each(Object.keys(GROUPS))('%s входит в лучший состав хотя бы одной миссии', (group) => {
    expect(best.some((b) => b.lineup.includes(group))).toBe(true);
  });
});
