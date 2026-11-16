import { botZone, createObjective, createSim, step, TICK_RATE } from '../sim';
import type { AirGroupConfig, Command, Content, MatchResult, MissionConfig } from '../sim';
import { CAMPAIGN, ENEMIES, GROUPS, MISSIONS } from '../content';
import { allLineups, balanceReport, lineupKey, names, pct, rowFromRuns, SWEEP_SEEDS } from './sweep';
import type { SweepRow } from './sweep';

/**
 * Расширенные прогоны баланса: вклад групп, врагов и улучшений (TASK-41). Тот же бот, что в `runMatch`, но с учётом статистики матча.
 * Работа делится на задачи «миссия × состав» (`runJob`): они независимы и детерминированы, поэтому `npm run balance`
 * раздаёт их по потокам (scripts/balance.mjs), а тест гоняет одну-две задачи в одном потоке.
 */
const CONTENT: Content = { enemies: ENEMIES, groups: GROUPS };

/** Бот переносит зону, когда нужная точка ушла от её центра дальше этого расстояния: то же значение, что в `runMatch`. */
const FOLLOW = 0.5;

/** Счётчики врага одного типа за матч. */
export interface EnemyTally {
  spawned: number;
  killed: number;
  /** Дошло до цели. */
  leaked: number;
  /** Урон по цели от дошедших. */
  damage: number;
}

/** Группа за матч: итоги из `state.stats.groups`; patrol — доля тиков матча в патруле. */
export interface GroupTotals {
  type: string;
  kills: number;
  damage: number;
  sorties: number;
  patrol: number;
}

/** Один матч: итог как у `runMatch` плюс статистика групп и врагов. */
export interface DetailRun {
  match: MatchResult;
  groups: GroupTotals[];
  enemies: Record<string, EnemyTally>;
}

/** Строка состава: группа, уровень и специализация (уровень 0 — без улучшений). */
export interface Setup {
  group: string;
  level: number;
  spec?: string;
}

/**
 * Матч бота по составу `setup`. Типы врагов в событиях spawn/kill/leak определяются без чтения `state.enemies`
 * (враг, заспавненный и убитый за один тик, там уже не виден): спавны волн идут строго по расписанию `sim.waveSpawns`,
 * а враги носителя — из его `spawnOnDeath`. Для врагов, ещё живых после тика, тип сверяется с `state.enemies`.
 */
export function detailRun(mission: MissionConfig, seed: number, setup: readonly Setup[]): DetailRun {
  const start = mission.objective ? createObjective(mission.objective).pos : mission.path!.at(-1)!;
  const sim = createSim(mission, CONTENT, seed, setup.map((e) => ({ ...e, zone: { ...start } })));
  const s = sim.state;
  const schedule = sim.waveSpawns.flat();
  let scheduled = 0;
  const types = new Map<number, string>();
  const enemies: Record<string, EnemyTally> = {};
  const tally = (type: string): EnemyTally => (enemies[type] ??= { spawned: 0, killed: 0, leaked: 0, damage: 0 });
  let kills = 0;
  let sorties = 0;
  for (let i = 0; i < 1200 * TICK_RATE && s.status === 'running'; i++) {
    const commands: Command[] = [];
    for (const g of s.groups) {
      const zone = botZone(sim, g);
      if (Math.hypot(g.zone.x - zone.x, g.zone.y - zone.y) > FOLLOW) commands.push({ type: 'setZone', group: g.id, zone });
    }
    step(sim, commands);
    for (const ev of s.events) {
      if (ev.type === 'spawn') {
        const type = ev.from === undefined ? schedule[scheduled++]?.enemy : CONTENT.enemies[types.get(ev.from) ?? '']?.spawnOnDeath?.enemy;
        if (!type) throw new Error(`spawn of enemy ${ev.enemy}: type unknown (${mission.id}, seed ${seed})`);
        types.set(ev.enemy, type);
        tally(type).spawned++;
      } else if (ev.type === 'kill') {
        tally(typeOf(types, ev.enemy)).killed++;
        kills++;
      } else if (ev.type === 'leak') {
        const t = tally(typeOf(types, ev.enemy));
        t.leaked++;
        t.damage += ev.damage;
      } else if (ev.type === 'sortieDone') sorties++;
    }
    for (const e of s.enemies) if (types.get(e.id) !== e.type) throw new Error(`enemy ${e.id}: type ${types.get(e.id)} != ${e.type} (${mission.id}, seed ${seed})`);
  }
  return {
    match: { status: s.status, reward: s.money, hp: s.objective?.hp ?? s.lives, kills, sorties, ticks: s.tick },
    groups: s.stats.groups.map((g) => ({ type: g.type, kills: g.kills, damage: g.damage, sorties: g.sorties, patrol: s.tick ? g.patrolTicks / s.tick : 0 })),
    enemies,
  };
}

const typeOf = (types: ReadonlyMap<number, string>, id: number): string => {
  const type = types.get(id);
  if (!type) throw new Error(`enemy ${id}: type unknown`);
  return type;
};

/** Вариант улучшения группы: уровень и (после развилки) специализация. */
export interface Variant {
  level: number;
  spec?: string;
  /** Подпись: «Ур. 1» или «Ур. 3 · Перехватчик». */
  label: string;
}

/** Все проверяемые варианты группы: каждый уровень, а после развилки — каждый её вариант. */
export function variants(cfg: AirGroupConfig): Variant[] {
  const fork = cfg.upgrades.findIndex((u) => u.options);
  const out: Variant[] = [];
  for (let level = 1; level <= cfg.upgrades.length; level++) {
    if (fork >= 0 && level > fork) for (const o of cfg.upgrades[fork]!.options!) out.push({ level, spec: o.id, label: `Ур. ${level} · ${o.name}` });
    else out.push({ level, label: `Ур. ${level}` });
  }
  return out;
}

/** Цена варианта: сумма цен всех улучшений до его уровня включительно. */
export const variantCost = (cfg: AirGroupConfig, level: number): number => cfg.upgrades.slice(0, level).reduce((sum, u) => sum + u.cost, 0);

/** Специализации максимального уровня: «первая» и «вторая» — варианты развилки группы по порядку; нет развилки — одна и та же (без специализации). */
export const maxSetup = (group: string, index: 0 | 1): Setup => {
  const cfg = GROUPS[group]!;
  const options = cfg.upgrades.find((u) => u.options)?.options;
  return { group, level: cfg.upgrades.length, ...(options ? { spec: options[index].id } : {}) };
};

/** Задача: одна миссия и один состав. */
export interface Job {
  mission: string;
  lineup: string[];
}

/** Итог задачи; чистые данные, годятся для передачи между потоками. */
export interface JobResult extends Job {
  /** Составы уровня 0, по сидам. */
  base: DetailRun[];
  /** Каждый вариант каждой группы состава поверх уровня 0 остальных групп; runs — по сидам. */
  upgrades: { group: string; variant: Variant; runs: MatchResult[] }[];
  /** Все группы на максимальном уровне: [первая специализация, вторая]; runs — по сидам. */
  maxed: [MatchResult[], MatchResult[]];
}

/** Все задачи в порядке миссий кампании и составов (как строки `sweep`). */
export const allJobs = (): Job[] => CAMPAIGN.flatMap((mission) => allLineups().map((lineup) => ({ mission, lineup })));

export function runJob(job: Job, seeds: readonly number[] = SWEEP_SEEDS, upgrades = true): JobResult {
  const mission = MISSIONS[job.mission]!;
  const runs = (setup: Setup[]) => seeds.map((seed) => detailRun(mission, seed, setup));
  const plain = job.lineup.map((group): Setup => ({ group, level: 0 }));
  const base = runs(plain);
  if (!upgrades) return { ...job, base, upgrades: [], maxed: [[], []] };
  return {
    ...job,
    base,
    upgrades: job.lineup.flatMap((group) =>
      variants(GROUPS[group]!).map((variant) => ({
        group,
        variant,
        runs: runs(plain.map((e) => (e.group === group ? { group, level: variant.level, ...(variant.spec ? { spec: variant.spec } : {}) } : e))).map((r) => r.match),
      })),
    ),
    maxed: [0, 1].map((i) => runs(job.lineup.map((group) => maxSetup(group, i as 0 | 1))).map((r) => r.match)) as [MatchResult[], MatchResult[]],
  };
}

const mean = (xs: readonly number[]): number => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const fixed = (x: number, digits = 1): string => x.toFixed(digits);
const signed = (x: number, digits = 1): string => {
  const text = x.toFixed(digits);
  return Number(text) === 0 ? text.replace('-', '') : Number(text) > 0 ? `+${text}` : text;
};
const table = (head: string[], rows: string[][]): string[] => [`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`, ...rows.map((r) => `| ${r.join(' | ')} |`)];

const winCount = (runs: readonly MatchResult[]): number => runs.filter((r) => r.status === 'won').length;
/** Состав выигрывает миссию: победа на всех сидах (как `SweepRow.winning`). */
const isWinning = (runs: readonly MatchResult[]): boolean => runs.length > 0 && winCount(runs) === runs.length;
/** Средний остаток прочности цели в долях её прочности; так же считает `SweepRow.hp`. */
const hpShare = (mission: MissionConfig, runs: readonly MatchResult[]): number => mean(runs.map((r) => Math.max(0, r.hp))) / mission.objective!.hp;

/** Таблицы «Вклад групп»: победы с группой и без неё по миссиям, средние показатели группы за матч. */
export function groupTables(results: readonly JobResult[]): string[] {
  const missions = CAMPAIGN.map((id) => MISSIONS[id]!);
  const out = ['## Вклад групп', ''];
  out.push('Все составы без улучшений. Доля побед — побед из всех матчей составов с группой / без неё (на миссию по 10 составов в каждой части).', '');
  const share = (xs: readonly JobResult[]): string => pct(xs.length ? xs.reduce((s, r) => s + winCount(r.base.map((b) => b.match)), 0) / xs.reduce((s, r) => s + r.base.length, 0) : 0);
  const head = ['Группа', ...missions.map((m) => m.name), 'Все миссии'];
  out.push(...table(head, Object.values(GROUPS).map((g) => {
    const cell = (xs: readonly JobResult[]) => `${share(xs.filter((r) => r.lineup.includes(g.id)))} / ${share(xs.filter((r) => !r.lineup.includes(g.id)))}`;
    return [g.name, ...missions.map((m) => cell(results.filter((r) => r.mission === m.id))), cell(results)];
  })));
  out.push('', 'Средние за матч по группе, когда она в составе: убийств · урон по врагам · завершённых вылетов · доля времени в патруле.', '');
  const stat = (xs: readonly GroupTotals[]): string => (xs.length ? `${fixed(mean(xs.map((x) => x.kills)))} · ${fixed(mean(xs.map((x) => x.damage)), 0)} · ${fixed(mean(xs.map((x) => x.sorties)))} · ${pct(mean(xs.map((x) => x.patrol)))}` : '—');
  out.push(...table(head, Object.values(GROUPS).map((g) => {
    const totals = (xs: readonly JobResult[]) => xs.flatMap((r) => r.base.flatMap((b) => b.groups.filter((x) => x.type === g.id)));
    return [g.name, ...missions.map((m) => stat(totals(results.filter((r) => r.mission === m.id)))), stat(totals(results))];
  })));
  return out;
}

/** Таблица врагов: по типам и миссиям «заспавнено за матч · доля уничтоженных · доля урона по цели»; `only` отбирает задачи (составы). */
function enemyTable(results: readonly JobResult[], only: (r: JobResult) => boolean): string[] {
  const missions = CAMPAIGN.map((id) => MISSIONS[id]!);
  const sums = (xs: readonly JobResult[]) => {
    const runs = xs.filter(only).flatMap((r) => r.base);
    const total: Record<string, EnemyTally> = {};
    for (const run of runs) for (const [type, t] of Object.entries(run.enemies)) {
      const acc = (total[type] ??= { spawned: 0, killed: 0, leaked: 0, damage: 0 });
      acc.spawned += t.spawned;
      acc.killed += t.killed;
      acc.leaked += t.leaked;
      acc.damage += t.damage;
    }
    return { runs: runs.length, total, damage: Object.values(total).reduce((s, t) => s + t.damage, 0) };
  };
  const cols = [...missions.map((m) => sums(results.filter((r) => r.mission === m.id))), sums(results)];
  const rows = Object.values(ENEMIES).map((e) => [e.name, ...cols.map((c) => {
    const t = c.total[e.id];
    return t ? `${fixed(t.spawned / c.runs)} · ${pct(t.killed / t.spawned)} · ${c.damage ? pct(t.damage / c.damage) : '—'}` : '—';
  })]);
  return table(['Враг', ...missions.map((m) => m.name), 'Все миссии'], rows);
}

/** Таблицы «Вклад врагов»: по всем прогонам и только по выигрышным составам миссии. */
export function enemyTables(results: readonly JobResult[]): string[] {
  const winners = new Set(results.filter((r) => isWinning(r.base.map((b) => b.match))).map((r) => `${r.mission}|${lineupKey(r.lineup)}`));
  const out = ['## Вклад врагов', ''];
  out.push('В ячейке: заспавнено за матч · доля уничтоженных (убитые из заспавненных) · доля урона по цели миссии (от дошедших врагов; сумма по типам — 100%). Все составы без улучшений; враги носителя считаются как заспавненные.', '');
  out.push('По всем матчам:', '', ...enemyTable(results, () => true));
  out.push('', 'Только в выигрышных составах миссии («Все миссии» — по тем же составам):', '', ...enemyTable(results, (r) => winners.has(`${r.mission}|${lineupKey(r.lineup)}`)));
  return out;
}

/** Таблица улучшений: каждый вариант каждой группы поверх состава уровня 0 с этой группой, по парам «миссия × состав». */
export function upgradeTable(results: readonly JobResult[]): string[] {
  const out = ['## Вклад улучшений', ''];
  out.push('Каждый вариант — состав уровня 0, где одна группа поднята до уровня (и специализации, если развилка пройдена), остальные не улучшены. Пара — «миссия × состав» с этой группой.');
  out.push('Проигрыш → победа: пара не выигрывала миссию (победа не на всех сидах), а с улучшением выигрывает; победа → проигрыш — наоборот. Δ побед — сумма по парам побед из прогонов (по сидам), Δ остатка — в процентных пунктах прочности цели (проигрыш — 0), Δ валюты — награда за матч (убийства и бонусы групп), средняя по парам. Цена — сумма цен улучшений до этого уровня.', '');
  const rows: string[][] = [];
  for (const g of Object.values(GROUPS)) {
    const mine = results.filter((r) => r.lineup.includes(g.id));
    for (const v of variants(g)) {
      let up = 0;
      let down = 0;
      let dWins = 0;
      const dHp: number[] = [];
      const dMoney: number[] = [];
      for (const r of mine) {
        const mission = MISSIONS[r.mission]!;
        const runs = r.upgrades.find((u) => u.group === g.id && u.variant.label === v.label)!.runs;
        const base = r.base.map((b) => b.match);
        if (!isWinning(base) && isWinning(runs)) up++;
        if (isWinning(base) && !isWinning(runs)) down++;
        dWins += winCount(runs) - winCount(base);
        dHp.push((hpShare(mission, runs) - hpShare(mission, base)) * 100);
        dMoney.push(mean(runs.map((x) => x.reward)) - mean(base.map((x) => x.reward)));
      }
      rows.push([g.name, v.label, String(variantCost(g, v.level)), String(mine.length), String(up), String(down), signed(dWins, 0), signed(mean(dHp)), signed(mean(dMoney), 0)]);
    }
  }
  out.push(...table(['Группа', 'Вариант', 'Цена', 'Пар', 'Проигрыш → победа', 'Победа → проигрыш', 'Δ побед', 'Δ остатка, пп', 'Δ валюты'], rows));
  return out;
}

/** Таблица максимального уровня: выигрышные составы по миссиям при группах без улучшений и при всех группах на максимуме (обе специализации). */
export function maxLevelTables(results: readonly JobResult[]): string[] {
  const missions = CAMPAIGN.map((id) => MISSIONS[id]!);
  const out = ['## Максимальный уровень', ''];
  out.push('Все три группы состава улучшены полностью: «первая» и «вторая» — первый и второй вариант развилки у каждой группы (смешанные выборы не гонялись).');
  out.push(`Первая специализация: ${Object.values(GROUPS).map((g) => `${g.name} — ${g.upgrades.find((u) => u.options)?.options?.[0].name ?? 'без развилки'}`).join('; ')}.`);
  out.push(`Вторая: ${Object.values(GROUPS).map((g) => `${g.name} — ${g.upgrades.find((u) => u.options)?.options?.[1].name ?? 'без развилки'}`).join('; ')}.`, '');
  out.push('В ячейке: выигрышных составов из 20 (победа на всех сидах) и средний по составам остаток прочности цели.', '');
  const kinds: ((r: JobResult) => MatchResult[])[] = [(r) => r.base.map((b) => b.match), (r) => r.maxed[0], (r) => r.maxed[1]];
  const cell = (m: MissionConfig, pick: (r: JobResult) => MatchResult[]) => {
    const xs = results.filter((r) => r.mission === m.id);
    return `${xs.filter((r) => isWinning(pick(r))).length} · ${pct(mean(xs.map((r) => hpShare(m, pick(r)))))}`;
  };
  out.push(...table(['Миссия', 'Без улучшений', 'Максимум, первая специализация', 'Максимум, вторая'], missions.map((m) => [m.name, ...kinds.map((pick) => cell(m, pick))])));
  out.push('');
  for (const [label, pick] of [['без улучшений', kinds[0]!], ['первая специализация', kinds[1]!], ['вторая специализация', kinds[2]!]] as const) {
    const all = new Map<string, number>();
    for (const r of results) if (isWinning(pick(r))) all.set(lineupKey(r.lineup), (all.get(lineupKey(r.lineup)) ?? 0) + 1);
    const full = allLineups().filter((l) => all.get(lineupKey(l)) === missions.length);
    out.push(`- Выигрывают все ${missions.length} миссий (${label}), ${full.length}: ${full.map(names).join('; ') || 'нет'}. Лучший результат: ${Math.max(0, ...all.values())} из ${missions.length}.`);
  }
  return out;
}

/** Таблицы расширенных прогонов для отчёта. */
export function detailReport(results: readonly JobResult[]): string {
  return [...groupTables(results), '', ...enemyTables(results), '', ...upgradeTable(results), '', ...maxLevelTables(results)].join('\n') + '\n';
}

/** Строки `sweep` из задач: базовые прогоны используются и в отчёте о победах, и в таблицах, повторно не гоняются. */
export const sweepRows = (results: readonly JobResult[]): SweepRow[] => results.map((r) => rowFromRuns(MISSIONS[r.mission]!, r.lineup, r.base.map((b) => b.match)));

/** Полный отчёт по готовым задачам `allJobs()`: прежние разделы (`balanceReport`) и таблицы вклада. */
export function fullReport(results: readonly JobResult[], seeds: readonly number[] = SWEEP_SEEDS): string {
  return `${balanceReport(seeds, sweepRows(results))}\n${detailReport(results)}`;
}

/** Все задачи в одном потоке (долго: порядка десяти минут на пяти сидах); `npm run balance` делает то же по потокам. */
export const runAllJobs = (seeds: readonly number[] = SWEEP_SEEDS): JobResult[] => allJobs().map((job) => runJob(job, seeds));

