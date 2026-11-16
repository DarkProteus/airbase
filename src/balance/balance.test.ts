import { describe, expect, test } from 'vitest';
import { CAMPAIGN, GROUPS, LINEUP_SIZE, MISSIONS, START_PROFILE } from '../content';
import { allLineups, combos, economy, lineupKey, sweep } from './sweep';

/** Сиды теста: три из сидов отчёта — компромисс между надёжностью и скоростью; полный набор гоняет `npm run balance`. */
const SEEDS = [1, 2, 3];

/** Базовые группы этапа 0.1; новые (ДРЛО, заправщик) дополнительно проверяются как выбор, а не автовыбор. */
const BASE = ['f16', 'a10', 'growler', 'c130'];
const NEW = ['e3', 'kc135'];

const LINEUPS = combos(BASE, LINEUP_SIZE);
/** Сравнение новых групп с базовыми — на двух первых миссиях, где базовые составы выигрывают. */
const missions = [MISSIONS.evac!, MISSIONS.convoy!];

/** Полный прогон: все миссии кампании × все составы из трёх групп × сиды. Считается один раз на файл. */
const ROWS = sweep(SEEDS);
const rowOf = (mission: string, lineup: readonly string[]) => ROWS.find((r) => r.mission === mission && lineupKey(r.lineup) === lineupKey(lineup))!;

describe('баланс: все миссии × все составы (headless)', () => {
  const lineups = allLineups();

  test('прогоны покрывают все миссии кампании, все составы и несколько сидов', () => {
    expect(CAMPAIGN.slice().sort()).toEqual(Object.keys(MISSIONS).sort());
    expect(lineups).toHaveLength(20);
    expect(ROWS).toHaveLength(CAMPAIGN.length * lineups.length);
    for (const r of ROWS) expect(r.runs).toHaveLength(SEEDS.length);
    expect(SEEDS.length).toBeGreaterThanOrEqual(3);
  });

  test.each(CAMPAIGN)('%s: есть выигрышный состав, и есть составы без единой победы — выбор имеет значение', (id) => {
    const rows = ROWS.filter((r) => r.mission === id);
    expect(rows.some((r) => r.winning)).toBe(true);
    expect(rows.some((r) => r.wins === 0)).toBe(true);
  });

  test('ни один состав не выигрывает все миссии — даже на части сидов', () => {
    for (const lineup of lineups) {
      const won = CAMPAIGN.filter((id) => rowOf(id, lineup).wins > 0);
      expect(won.length, lineup.join('+')).toBeLessThan(CAMPAIGN.length);
    }
  });

  test.each(Object.keys(GROUPS))('%s входит хотя бы в один выигрышный состав', (group) => {
    expect(ROWS.some((r) => r.winning && r.lineup.includes(group))).toBe(true);
  });

  test('ни одна группа не обязательна везде: у каждой есть миссия с выигрышным составом без неё', () => {
    for (const group of Object.keys(GROUPS)) expect(ROWS.some((r) => r.winning && !r.lineup.includes(group)), group).toBe(true);
  });

  test('первая миссия кампании проходится стартовым составом без покупок', () => {
    expect(START_PROFILE.lineup).toHaveLength(LINEUP_SIZE);
    const row = rowOf(CAMPAIGN[0]!, START_PROFILE.lineup);
    expect(row.wins).toBe(SEEDS.length);
    // Не на последнем издыхании: остаётся не меньше трети прочности цели.
    expect(row.hp).toBeGreaterThanOrEqual(MISSIONS[CAMPAIGN[0]!]!.objective!.hp / 3);
  });
});

describe('экономика одного прохода кампании', () => {
  const eco = economy(ROWS);

  test('даже при худших выигрышных составах валюты хватает на все некупленные группы', () => {
    expect(eco.groupsCost).toBeGreaterThan(0);
    expect(eco.income.low).toBeGreaterThanOrEqual(eco.groupsCost);
  });

  test('даже при лучших составах валюты не хватает на все улучшения', () => {
    expect(eco.income.high).toBeLessThan(eco.upgradesCost);
  });

  test('после покупки всех групп остаётся на заметную часть улучшений, но не больше трёх четвертей', () => {
    const share = (eco.income.mid - eco.groupsCost) / eco.upgradesCost;
    expect(share).toBeGreaterThan(0.4);
    expect(share).toBeLessThan(0.75);
  });

  test('первой победы хватает на покупку любой группы', () => {
    const dearest = Math.max(...Object.values(GROUPS).map((g) => g.cost));
    expect(eco.start + eco.missions[0]!.low).toBeGreaterThanOrEqual(dearest);
  });
});

/** Исход состава на миссии из полного прогона: сначала число побед, затем средний остаток прочности цели (hp). */
function outcome(mission: (typeof missions)[number], lineup: string[]) {
  const row = rowOf(mission.id, lineup);
  return { lineup, wins: row.wins, hp: row.hp };
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
