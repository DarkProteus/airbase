import { MAX_STARS, TICK_RATE } from '../../sim';
import type { GroupRegistry, MatchStats, MissionConfig, MissionResult, Reward } from '../../sim';

export interface ResultRow {
  label: string;
  value: string;
}

export interface TableView {
  head: string[];
  rows: { cells: string[]; mark?: 'weak' | 'idle' }[];
}

/** Слабое место боя: волна, прорвавшаяся к цели сильнее всех, или вооружённая группа, почти не работавшая. */
export type WeakSpot =
  | { kind: 'wave'; wave: number; leaked: number; damage: number; text: string }
  | { kind: 'idle'; group: number; text: string };

/** Вооружённая группа с долей патруля ниже этой (или с нулём урона) считается простаивавшей. */
export const IDLE_PATROL_SHARE = 0.15;

export interface ResultView {
  title: string;
  won: boolean;
  stats: ResultRow[];
  reward: ResultRow[];
  /** Звёзды этого вылета: 0 при поражении. */
  stars: { earned: number; max: number };
  /** Разбор боя: по группам и по волнам, плюс найденные слабые места. */
  groups: TableView;
  waves: TableView;
  weak: WeakSpot[];
  /** Итоговая строка награды и новый баланс. */
  total: ResultRow;
  balance: ResultRow;
}

/** Подпись остатка прочности по типу цели миссии; без цели — жизни базы. */
const HP_LABEL = { defend: 'Прочность объекта', escort: 'Прочность колонны' } as const;

const clock = (ticks: number): string => {
  const sec = Math.round(ticks / TICK_RATE);
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
};

const pct = (share: number): string => `${Math.round(share * 100)}%`;

/** Склонение по числу: plural(2, ['враг', 'врага', 'врагов']). */
const plural = (n: number, forms: [string, string, string]): string => {
  const m100 = n % 100;
  const m10 = n % 10;
  return forms[m100 >= 11 && m100 <= 14 ? 2 : m10 === 1 ? 0 : m10 >= 2 && m10 <= 4 ? 1 : 2];
};

/**
 * Слабые места боя по статистике: волна, чьи прорвавшиеся враги нанесли цели больше всего урона (при равенстве —
 * больше прорвавшихся, затем более ранняя); вооружённые группы без нанесённого урона или с малой долей патруля.
 * Бой без прорывов и простоев даёт пустой список.
 */
export function weakSpots(stats: MatchStats, ticks: number, groups: GroupRegistry): WeakSpot[] {
  const out: WeakSpot[] = [];
  let worst = -1;
  stats.waves.forEach((w, i) => {
    if (w.leaked <= 0) return;
    const b = stats.waves[worst];
    if (!b || w.damage > b.damage || (w.damage === b.damage && w.leaked > b.leaked)) worst = i;
  });
  const w = stats.waves[worst];
  if (w)
    out.push({
      kind: 'wave',
      wave: worst + 1,
      leaked: w.leaked,
      damage: w.damage,
      text: `Волна ${worst + 1}: к цели прорвалось ${w.leaked} ${plural(w.leaked, ['враг', 'врага', 'врагов'])}, урон ${Math.round(w.damage)}.`,
    });
  for (const g of stats.groups) {
    const cfg = groups[g.type];
    if (!cfg || !cfg.weapons.some((x) => x.damage > 0)) continue;
    const share = ticks > 0 ? g.patrolTicks / ticks : 0;
    if (g.damage > 0 && share >= IDLE_PATROL_SHARE) continue;
    const why = g.damage > 0 ? `в патруле лишь ${pct(share)} времени` : `урона нет, в патруле ${pct(share)} времени`;
    out.push({ kind: 'idle', group: g.id, text: `${cfg.name} (№${g.id}) простаивала: ${why}. Проверьте зону и цели оружия.` });
  }
  return out;
}

/** Экран итога из данных: заголовок по исходу, статистика матча и разбивка награды (бонус групп отдельной строкой). */
export function resultView(mission: MissionConfig, result: MissionResult, reward: Reward, currency: number, groups: GroupRegistry): ResultView {
  const won = result.status === 'won';
  const weak = weakSpots(result.stats, result.ticks, groups);
  const weakWave = weak.find((w) => w.kind === 'wave');
  const idle = new Set(weak.flatMap((w) => (w.kind === 'idle' ? [w.group] : [])));
  return {
    title: won ? 'Победа' : 'Поражение',
    won,
    stats: [
      { label: 'Миссия', value: mission.name },
      { label: 'Время боя', value: clock(result.ticks) },
      { label: 'Сбито врагов', value: String(result.kills) },
      { label: 'Завершено вылетов', value: String(result.sorties) },
      { label: mission.objective ? HP_LABEL[mission.objective.type] : 'Жизни базы', value: String(Math.ceil(result.hp)) },
    ],
    groups: {
      head: ['Группа', 'Убийств', 'Урон', 'Вылетов', 'В патруле'],
      rows: result.stats.groups.map((g) => ({
        cells: [groups[g.type]?.name ?? g.type, String(g.kills), String(Math.round(g.damage)), String(g.sorties), pct(result.ticks > 0 ? g.patrolTicks / result.ticks : 0)],
        ...(idle.has(g.id) ? { mark: 'idle' as const } : {}),
      })),
    },
    waves: {
      head: ['Волна', 'Врагов', 'Сбито', 'Дошло', mission.objective ? 'Урон по цели' : 'Урон базе'],
      rows: result.stats.waves.flatMap((w, i) =>
        w.spawned > 0
          ? [{ cells: [String(i + 1), String(w.spawned), String(w.killed), String(w.leaked), String(Math.round(w.damage))], ...(weakWave?.kind === 'wave' && weakWave.wave === i + 1 ? { mark: 'weak' as const } : {}) }]
          : [],
      ),
    },
    weak,
    stars: { earned: reward.earned, max: MAX_STARS },
    reward: [
      { label: !won ? 'За участие' : reward.first ? 'За первое прохождение' : 'За повторную победу', value: String(reward.base) },
      ...(won ? [{ label: 'За новые звёзды', value: String(reward.stars) }] : []),
      { label: 'За убийства', value: String(reward.kills) },
      { label: 'Бонус вылетов (C-130 и др.)', value: String(reward.income) },
    ],
    total: { label: 'Награда', value: String(reward.total) },
    balance: { label: 'Валюта на базе', value: String(currency) },
  };
}
