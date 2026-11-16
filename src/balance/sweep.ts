import { createSim, missionStars, runMatch, step, STAR_SHARE, TICK_RATE } from '../sim';
import type { Content, MatchResult, MissionConfig, Vec2 } from '../sim';
import { CAMPAIGN, DEFAULT_ZONES, ENEMIES, GROUPS, LINEUP_SIZE, MISSIONS, START_PROFILE } from '../content';

/**
 * Симулятор баланса (design.md §4): headless-бот прогоняет все миссии кампании всеми составами.
 * Отсюда берут данные тест баланса (balance.test.ts) и отчёт docs/balance-0.2.md (`npm run balance`).
 */
const CONTENT: Content = { enemies: ENEMIES, groups: GROUPS };

/** Сиды прогонов: фиксированные, чтобы отчёт и тесты были воспроизводимы. */
export const SWEEP_SEEDS: readonly number[] = [1, 2, 3, 4, 5];

/** Все сочетания по k элементов. */
export const combos = <T>(items: readonly T[], k: number): T[][] =>
  k === 0 ? [[]] : items.flatMap((x, i) => combos(items.slice(i + 1), k - 1).map((rest) => [x, ...rest]));

/** Все составы на вылет: сочетания по LINEUP_SIZE из реестра групп. */
export const allLineups = (): string[][] => combos(Object.keys(GROUPS), LINEUP_SIZE);

/** Ключ состава, не зависящий от порядка групп. */
export const lineupKey = (lineup: readonly string[]): string => [...lineup].sort().join('+');

/** Прогоны одного состава на одной миссии по всем сидам. */
export interface SweepRow {
  mission: string;
  lineup: string[];
  /** Побед из `runs.length`. */
  wins: number;
  /** Состав выигрывает миссию: победа на всех сидах. */
  winning: boolean;
  /** Средний по сидам остаток прочности цели (поражение — 0). */
  hp: number;
  /** Средние по сидам звёзды (поражение — 0). */
  stars: number;
  /** Средняя награда победного прогона как первого прохождения: база + звёзды + убийства + бонус групп; побед нет — 0. */
  reward: number;
  runs: MatchResult[];
}

const mean = (xs: readonly number[]): number => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

const starsOf = (mission: MissionConfig, run: MatchResult): number =>
  missionStars(mission, { status: run.status === 'won' ? 'won' : 'lost', hp: run.hp });

/** Награда победного прогона, как если бы миссия пройдена впервые (та же формула, что `missionReward`). */
export function firstClearReward(mission: MissionConfig, run: MatchResult): number {
  const win = mission.reward?.win ?? 0;
  return win + starsOf(mission, run) * Math.round(win * STAR_SHARE) + run.reward;
}

export function sweepRow(mission: MissionConfig, lineup: string[], seeds: readonly number[] = SWEEP_SEEDS): SweepRow {
  const runs = seeds.map((seed) => runMatch(mission, CONTENT, seed, lineup));
  const won = runs.filter((r) => r.status === 'won');
  return {
    mission: mission.id,
    lineup,
    wins: won.length,
    winning: won.length === runs.length,
    hp: mean(runs.map((r) => Math.max(0, r.hp))),
    stars: mean(runs.map((r) => starsOf(mission, r))),
    reward: mean(won.map((r) => firstClearReward(mission, r))),
    runs,
  };
}

/** Полный прогон: все миссии кампании × все составы × сиды. */
export function sweep(seeds: readonly number[] = SWEEP_SEEDS): SweepRow[] {
  return CAMPAIGN.flatMap((id) => allLineups().map((lineup) => sweepRow(MISSIONS[id]!, lineup, seeds)));
}

/** Бездействующий игрок: состав стоит на стартовых зонах миссии и ни разу их не двигает. */
export function idleRun(mission: MissionConfig, lineup: readonly string[], seed: number, zones: readonly Vec2[] = mission.zones ?? DEFAULT_ZONES): MatchResult['status'] {
  const sim = createSim(mission, CONTENT, seed, lineup.map((group, i) => ({ group, level: 0, zone: zones[i]! })));
  while (sim.state.status === 'running' && sim.state.tick < 1200 * TICK_RATE) step(sim);
  return sim.state.status;
}

/** Экономика одного прохода кампании: каждая миссия выиграна один раз, с первого раза, группами без улучшений. */
export interface Economy {
  /** Стартовая валюта. */
  start: number;
  /** Награда первого прохождения по миссиям: худший, медианный и лучший из выигрышных составов. */
  missions: { id: string; low: number; mid: number; high: number }[];
  /** Валюта за кампанию вместе со стартовой: при худших, медианных и лучших составах. */
  income: { low: number; mid: number; high: number };
  /** Цена всех групп, не купленных на старте. */
  groupsCost: number;
  /** Цена всех улучшений всех групп. */
  upgradesCost: number;
}

export function economy(rows: readonly SweepRow[]): Economy {
  const missions = CAMPAIGN.map((id) => {
    const rewards = rows.filter((r) => r.mission === id && r.winning).map((r) => r.reward).sort((a, b) => a - b);
    return { id, low: rewards[0] ?? 0, mid: rewards[Math.floor(rewards.length / 2)] ?? 0, high: rewards.at(-1) ?? 0 };
  });
  const total = (pick: (m: (typeof missions)[number]) => number) => Math.round(START_PROFILE.currency + missions.reduce((sum, m) => sum + pick(m), 0));
  const groups = Object.values(GROUPS);
  return {
    start: START_PROFILE.currency,
    missions,
    income: { low: total((m) => m.low), mid: total((m) => m.mid), high: total((m) => m.high) },
    groupsCost: groups.filter((g) => !(g.id in START_PROFILE.levels)).reduce((sum, g) => sum + g.cost, 0),
    upgradesCost: groups.reduce((sum, g) => sum + g.upgrades.reduce((s, u) => s + u.cost, 0), 0),
  };
}

const pct = (x: number): string => `${Math.round(x * 100)}%`;
const names = (lineup: readonly string[]): string => lineup.map((id) => GROUPS[id]!.name).join(' + ');

/** Отчёт о прогонах в Markdown: таблица побед, выигрышные составы, первая миссия, экономика. */
export function balanceReport(seeds: readonly number[] = SWEEP_SEEDS): string {
  const rows = sweep(seeds);
  const lineups = allLineups();
  const missions = CAMPAIGN.map((id) => MISSIONS[id]!);
  const cell = (m: MissionConfig, lineup: string[]) => rows.find((r) => r.mission === m.id && lineupKey(r.lineup) === lineupKey(lineup))!;
  const out: string[] = [];

  out.push('## Прогоны', '');
  out.push(`${missions.length} миссий × ${lineups.length} составов × ${seeds.length} сидов (${seeds.join(', ')}) = ${rows.length * seeds.length} матчей. Группы без улучшений.`);
  out.push('Бот держит зоны групп поддержки на цели миссии, зоны ударных групп выносит навстречу подходящим врагам и ведёт все зоны за колонной.', '');
  out.push('В ячейке: побед из прогонов и средний остаток прочности цели. **Жирным** — состав выигрывает миссию на всех сидах.', '');
  out.push(`| Состав | ${missions.map((m) => m.name).join(' | ')} | Миссий |`, `|---|${missions.map(() => '---').join('|')}|---|`);
  for (const lineup of lineups) {
    const cells = missions.map((m) => cell(m, lineup));
    const text = cells.map((r, i) => {
      const t = `${r.wins}/${r.runs.length} · ${pct(r.hp / missions[i]!.objective!.hp)}`;
      return r.winning ? `**${t}**` : r.wins ? t : '—';
    });
    out.push(`| ${names(lineup)} | ${text.join(' | ')} | ${cells.filter((r) => r.winning).length} |`);
  }

  out.push('', '## Выигрышные составы по миссиям', '');
  for (const m of missions) {
    const winners = lineups.filter((l) => cell(m, l).winning);
    out.push(`- **${m.name}** (${winners.length}): ${winners.map(names).join('; ') || 'нет'}`);
  }
  out.push('', '## Группы', '', '| Группа | Выигрышных составов с ней (миссия × состав) | Миссии, где она в выигрышном составе |', '|---|---|---|');
  for (const g of Object.values(GROUPS)) {
    const won = rows.filter((r) => r.winning && r.lineup.includes(g.id));
    const where = missions.filter((m) => won.some((r) => r.mission === m.id)).map((m) => m.name);
    out.push(`| ${g.name} | ${won.length} | ${where.join(', ') || '—'} |`);
  }
  const most = Math.max(...lineups.map((l) => missions.filter((m) => cell(m, l).winning).length));
  out.push('', `Больше всего миссий одним составом: ${most} из ${missions.length}.`);

  const first = missions[0]!;
  const start = START_PROFILE.lineup;
  const bot = cell(first, start);
  const idle = seeds.filter((seed) => idleRun(first, start, seed) === 'won').length;
  out.push('', '## Первая миссия стартовым составом', '');
  out.push(`Стартовый состав: ${names(start)}; стартовая валюта ${START_PROFILE.currency}.`, '');
  out.push(`- С переносом зон (бот): побед ${bot.wins}/${bot.runs.length}, остаток прочности ${pct(bot.hp / first.objective!.hp)}, звёзд ${bot.stars.toFixed(1)}.`);
  out.push(`- Без переноса зон (зоны по умолчанию, игрок бездействует): побед ${idle}/${seeds.length}.`);

  const eco = economy(rows);
  out.push('', '## Экономика одного прохода кампании', '');
  out.push('Каждая миссия выиграна один раз с первой попытки. Награда — база + звёзды + убийства + бонус групп; худший, медианный и лучший из выигрышных составов.', '');
  out.push('| Миссия | Худший | Медианный | Лучший |', '|---|---|---|---|');
  for (const m of eco.missions) out.push(`| ${MISSIONS[m.id]!.name} | ${Math.round(m.low)} | ${Math.round(m.mid)} | ${Math.round(m.high)} |`);
  out.push(`| **Всего со стартовой валютой (${eco.start})** | **${eco.income.low}** | **${eco.income.mid}** | **${eco.income.high}** |`, '');
  out.push(`- Все группы, не купленные на старте: ${eco.groupsCost}.`);
  out.push(`- Все улучшения всех групп: ${eco.upgradesCost}.`);
  const left = eco.income.mid - eco.groupsCost;
  out.push(`- При медианных составах после покупки всех групп остаётся ${left} — это ${pct(left / eco.upgradesCost)} стоимости всех улучшений.`);
  out.push(`- Даже при лучших составах валюты (${eco.income.high}) меньше, чем стоят все улучшения (${eco.upgradesCost}).`);
  return out.join('\n') + '\n';
}
