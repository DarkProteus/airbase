import { describe, expect, test } from 'vitest';
import { runMatch } from '../sim';
import { CAMPAIGN, ENEMIES, GROUPS, MISSIONS, START_PROFILE } from '../content';
import { detailReport, detailRun, runJob, sweepRows, variants } from './detail';
import { allLineups, rowFromRuns, sweepRow } from './sweep';

/** Лёгкий тест расширенных прогонов (TASK-41): одна миссия, один сид; полный прогон с улучшениями гоняет только `npm run balance`. */
const CONTENT = { enemies: ENEMIES, groups: GROUPS };
const mission = MISSIONS[CAMPAIGN[0]!]!;
const lineup = [...START_PROFILE.lineup];
const job = { mission: mission.id, lineup };

describe('расширенный прогон баланса', () => {
  test('матч совпадает с runMatch: итоги те же, статистика ничего не меняет', () => {
    const run = detailRun(mission, 1, lineup.map((group) => ({ group, level: 0 })));
    expect(run.match).toEqual(runMatch(mission, CONTENT, 1, lineup));
  });

  test('тип каждого врага определён, счётчики согласованы с матчем', () => {
    for (const id of CAMPAIGN) {
      const run = detailRun(MISSIONS[id]!, 1, ['f16', 'a10', 'growler'].map((group) => ({ group, level: 0 })));
      for (const [type, t] of Object.entries(run.enemies)) {
        expect(Object.keys(ENEMIES), `${id}: ${type}`).toContain(type);
        expect(t.killed + t.leaked, `${id}: ${type}`).toBeLessThanOrEqual(t.spawned);
      }
      const killed = Object.values(run.enemies).reduce((s, t) => s + t.killed, 0);
      expect(killed, id).toBe(run.match.kills);
      expect(run.groups.reduce((s, g) => s + g.kills, 0), id).toBeLessThanOrEqual(killed);
    }
  });

  const result = runJob(job, [1]);

  test('результат задачи детерминирован', () => {
    expect(runJob(job, [1])).toEqual(result);
  });

  test('улучшения: все варианты всех групп состава и обе специализации максимума', () => {
    expect(result.upgrades).toHaveLength(lineup.reduce((n, g) => n + variants(GROUPS[g]!).length, 0));
    for (const u of result.upgrades) expect(u.runs).toHaveLength(1);
    expect(result.maxed.map((r) => r.length)).toEqual([1, 1]);
  });

  test('таблицы строятся: группы, враги, улучшения, максимальный уровень; неизвестных врагов нет', () => {
    const text = detailReport([result]);
    for (const heading of ['## Вклад групп', '## Вклад врагов', '## Вклад улучшений', '## Доход экономических групп', '## Максимальный уровень']) expect(text).toContain(heading);
    for (const g of Object.values(GROUPS)) expect(text).toContain(`| ${g.name} |`);
    for (const e of Object.values(ENEMIES)) expect(text).toContain(`| ${e.name} |`);
    expect(text).not.toContain('?');
    expect(text).not.toContain('NaN');
    expect(detailReport([result])).toBe(text);
  });

  test('строки sweep из задач совпадают с sweepRow: базовые прогоны не считаются дважды', () => {
    expect(sweepRows([result])[0]).toEqual(sweepRow(mission, lineup, [1]));
    expect(rowFromRuns(mission, lineup, result.base.map((b) => b.match)).wins).toBe(sweepRow(mission, lineup, [1]).wins);
  });

  test('задачи покрывают все миссии и составы', () => {
    expect(allLineups()).toHaveLength(20);
  });
});
