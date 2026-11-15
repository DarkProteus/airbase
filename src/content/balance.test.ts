import { describe, expect, test } from 'vitest';
import { runMatch } from '../sim';
import { CONTENT, LINEUP_SIZE, MISSIONS } from '.';

const SEEDS = [1, 2, 3];

/** Все сочетания по k элементов. */
const combos = <T>(items: T[], k: number): T[][] =>
  k === 0 ? [[]] : items.flatMap((x, i) => combos(items.slice(i + 1), k - 1).map((rest) => [x, ...rest]));

/** Базовые группы этапа 0.1: на них держится исходный баланс; новые (ДРЛО, заправщик) проверяются отдельно. */
const BASE = ['f16', 'a10', 'growler', 'c130'];
const NEW = ['e3', 'kc135'];

const LINEUPS = combos(BASE, LINEUP_SIZE);
/** Баланс 3 из 4 базовых групп — на двух первых миссиях; остальные миссии проверяются отдельно (missions.bot.test.ts). */
const missions = [MISSIONS.evac!, MISSIONS.convoy!];

/** Headless-бот прогоняет состав по всем сидам. Оценка: сначала число побед, затем средняя награда. */
function rate(mission: (typeof missions)[number], lineup: string[]) {
  const runs = SEEDS.map((seed) => runMatch(mission, CONTENT, seed, lineup));
  const wins = runs.filter((r) => r.status === 'won').length;
  return { lineup, wins, score: wins * 1e6 + runs.reduce((sum, r) => sum + r.reward, 0) / runs.length };
}

describe('баланс составов 3 из 4 базовых групп (headless)', () => {
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

  test.each(BASE)('%s входит в лучший состав хотя бы одной миссии', (group) => {
    expect(best.some((b) => b.lineup.includes(group))).toBe(true);
  });
});

/** Исход прогона состава по сидам: сначала число побед, затем средний остаток прочности цели (hp). */
function outcome(mission: (typeof missions)[number], lineup: string[]) {
  const runs = SEEDS.map((seed) => runMatch(mission, CONTENT, seed, lineup));
  return { lineup, wins: runs.filter((r) => r.status === 'won').length, hp: runs.reduce((sum, r) => sum + r.hp, 0) / runs.length };
}
type Outcome = ReturnType<typeof outcome>;
const cmp = (a: Outcome, b: Outcome) => a.wins - b.wins || a.hp - b.hp;
const bestOf = (rows: Outcome[]) => rows.reduce((a, b) => (cmp(b, a) > 0 ? b : a));

/**
 * Новая группа — выбор, а не автовыбор: среди составов «ядро из базовых + она» есть не хуже лучшего базового хотя бы на одной миссии
 * (по числу побед), и при этом на какой-то миссии лучший базовый состав не слабее лучшего с ней (она не доминирует везде).
 */
describe.each(NEW)('новая группа %s: не хуже и не строго лучше базовых', (id) => {
  const withNew = combos([...BASE, id], LINEUP_SIZE).filter((l) => l.includes(id));
  const rows = missions.map((m) => ({
    mission: m,
    base: bestOf(LINEUPS.map((l) => outcome(m, l))),
    novel: bestOf(withNew.map((l) => outcome(m, l))),
  }));

  test('на какой-то миссии состав с ней проходит её так же надёжно, как лучший базовый', () => {
    expect(rows.some((r) => r.novel.wins >= r.base.wins)).toBe(true);
  });

  test('на какой-то миссии лучший базовый состав не слабее лучшего с ней: она не обязательна', () => {
    expect(rows.some((r) => cmp(r.base, r.novel) >= 0)).toBe(true);
  });

  test('вместо C-130 в ядре F-16 + A-10 не ухудшает остаток прочности цели ни на одной миссии', () => {
    for (const { mission } of rows) {
      const novel = outcome(mission, ['f16', 'a10', id]);
      const economy = outcome(mission, ['f16', 'a10', 'c130']);
      expect(novel.wins, mission.id).toBeGreaterThanOrEqual(economy.wins);
      expect(novel.hp, mission.id).toBeGreaterThanOrEqual(economy.hp - 1e-9);
    }
  });
});
