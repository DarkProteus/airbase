import { describe, expect, test } from 'vitest';
import { ENEMIES, MISSIONS } from '../content';
import { runJob } from './detail';
import type { DetailRun } from './detail';
import { allLineups, SWEEP_SEEDS } from './sweep';

/**
 * Враги с механикой играют (TASK-46): бомбардировщик и носитель «Горного перевала» и ударный вертолёт «Речного каравана»
 * либо гибнут, либо бьют по колонне в выигрышных составах миссии. Прогоны те же, что в отчёте: все составы без улучшений на сидах отчёта
 * (SWEEP_SEEDS); сиды 1–3 — это сиды `balance.test.ts`, их проверяем отдельно.
 */
const TEST_SEEDS = [1, 2, 3];
/** Выигрышных составов в отчёте до TASK-46 (5 сидов): число не должно уменьшиться. */
const WINNERS_BEFORE = { pass: 1, river: 7 };

/** Прогоны одной миссии: состав → матчи по сидам отчёта (без улучшений). */
const runs = (mission: string): { lineup: string[]; runs: DetailRun[] }[] =>
  allLineups().map((lineup) => ({ lineup, runs: runJob({ mission, lineup }, SWEEP_SEEDS, false).base }));

const PASS = runs('pass');
const RIVER = runs('river');

/** Матчи выигрышных составов на сидах: состав выигрывает, если победил на всех этих сидах. */
function winners(rows: typeof PASS, seeds: readonly number[]): { lineup: string[]; runs: DetailRun[] }[] {
  const at = (r: DetailRun[]) => seeds.map((seed) => r[SWEEP_SEEDS.indexOf(seed)]!);
  return rows.map((r) => ({ lineup: r.lineup, runs: at(r.runs) })).filter((r) => r.runs.every((m) => m.match.status === 'won'));
}

const sum = (rs: DetailRun[], type: string, key: 'spawned' | 'killed' | 'leaked' | 'damage'): number => rs.reduce((n, r) => n + (r.enemies[type]?.[key] ?? 0), 0);

describe.each([
  ['сиды отчёта', SWEEP_SEEDS],
  ['сиды balance.test.ts', TEST_SEEDS],
] as const)('враги с механикой в выигрышных составах: %s', (_name, seeds) => {
  const passRuns = winners(PASS, seeds).flatMap((w) => w.runs);
  const riverRuns = winners(RIVER, seeds).flatMap((w) => w.runs);

  test('выигрышных составов «Горного перевала» и «Речного каравана» не меньше, чем было', () => {
    expect(winners(PASS, seeds).length).toBeGreaterThanOrEqual(WINNERS_BEFORE.pass);
    expect(winners(RIVER, seeds).length).toBeGreaterThanOrEqual(WINNERS_BEFORE.river);
  });

  test('бомбардировщик в каждом прогоне либо уничтожен, либо нанёс урон', () => {
    expect(passRuns.length).toBeGreaterThan(0);
    const idle = passRuns.filter((r) => !(r.enemies.bomber?.killed || r.enemies.bomber?.damage));
    expect(idle.length / passRuns.length).toBe(0);
    for (const r of passRuns) expect(r.enemies.bomber?.spawned).toBe(1);
  });

  test('носитель уничтожается минимум в 30% появлений, и дроны из его гибели появляются', () => {
    expect(sum(passRuns, 'carrier', 'killed') / sum(passRuns, 'carrier', 'spawned')).toBeGreaterThanOrEqual(0.3);
    const brood = ENEMIES.carrier!.spawnOnDeath!;
    const hit = passRuns.filter((r) => r.enemies.carrier?.killed);
    expect(hit.length).toBeGreaterThan(0);
    // Выпущено ровно столько дронов, сколько велит `spawnOnDeath` носителя, на каждого погибшего; без гибели носителя роя нет.
    for (const r of passRuns) expect(r.released.carrier ?? 0).toBe((r.enemies.carrier?.killed ?? 0) * brood.count);
    for (const r of hit) expect(r.enemies[brood.enemy]!.spawned).toBeGreaterThanOrEqual(r.released.carrier!);
  });

  test('ударный вертолёт «Речного каравана» уничтожается минимум в 30% появлений', () => {
    expect(riverRuns.length).toBeGreaterThan(0);
    expect(sum(riverRuns, 'gunship', 'killed') / sum(riverRuns, 'gunship', 'spawned')).toBeGreaterThanOrEqual(0.3);
  });
});

test('миссии из теста — те самые «Горный перевал» и «Речной караван»', () => {
  expect(MISSIONS.pass!.waves.some((w) => w.groups.some((g) => g.enemy === 'bomber'))).toBe(true);
  expect(MISSIONS.river!.waves.some((w) => w.groups.some((g) => g.enemy === 'gunship'))).toBe(true);
});
