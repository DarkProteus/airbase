import type { SimState } from './engine';
import type { Profile } from './profile';
import type { MatchStats } from './tally';
import type { MissionConfig } from './types';

/** Итог завершённого матча: из него считается награда и строится экран итога. */
export interface MissionResult {
  status: 'won' | 'lost';
  kills: number;
  /** Завершённых вылетов по всем группам. */
  sorties: number;
  /** Деньги за убийства врагов. */
  killMoney: number;
  /** Бонус групп (стат income, например C-130) за завершённые вылеты. */
  income: number;
  /** Остаток прочности цели миссии (без цели — жизни базы), не ниже 0. */
  hp: number;
  ticks: number;
  /** Разбор боя по группам и волнам. */
  stats: MatchStats;
}

/** Итог из состояния матча; undefined, пока матч идёт. */
export function missionResult(state: SimState): MissionResult | undefined {
  if (state.status === 'running') return undefined;
  return {
    status: state.status,
    kills: state.kills,
    sorties: state.groups.reduce((sum, g) => sum + g.sorties, 0),
    killMoney: state.money - state.income,
    income: state.income,
    hp: Math.max(0, state.objective?.hp ?? state.lives),
    ticks: state.tick,
    stats: state.stats,
  };
}

/** Наибольшее число звёзд за миссию. */
export const MAX_STARS = 3;
/** Доля остатка прочности цели (жизней базы), с которой победа даёт 3 и 2 звезды; любая победа — 1 звезда. */
export const STAR_SHARES = [0.7, 0.35] as const;
/** Повторная победа в уже пройденной миссии: доля базовой награды за победу. */
export const REPEAT_SHARE = 0.5;
/** Бонус за каждую новую звезду: доля базовой награды за победу. */
export const STAR_SHARE = 0.25;

/** Звёзды за исход: поражение — 0; победа — 1–3 по остатку прочности цели миссии (без цели — жизней базы). */
export function missionStars(mission: MissionConfig, result: Pick<MissionResult, 'status' | 'hp'>): number {
  if (result.status !== 'won') return 0;
  const max = mission.objective?.hp ?? mission.baseLives;
  // Запас на погрешность деления: ровно пороговая доля считается достигнутой.
  const share = max > 0 ? result.hp / max + 1e-9 : 0;
  return share >= STAR_SHARES[0] ? 3 : share >= STAR_SHARES[1] ? 2 : 1;
}

/** Награда за миссию по статьям; total — то, что зачисляется в профиль. */
export interface Reward {
  /** За исход миссии: размер задан в конфиге миссии; повторная победа — доля REPEAT_SHARE. */
  base: number;
  /** Бонус за новые звёзды (сверх лучшего прежнего результата). */
  stars: number;
  kills: number;
  income: number;
  total: number;
  /** Звёзды этого вылета (0 — поражение) и первое ли это прохождение миссии. */
  earned: number;
  first: boolean;
}

/**
 * Чистая формула награды. `best` — лучший прежний результат по миссии в звёздах (0 — ещё не пройдена).
 * Победа: первая — полная база, повторная — REPEAT_SHARE базы; за каждую новую звезду — STAR_SHARE базы.
 * Поражение: утешительная сумма миссии (reward.loss). В обоих случаях плюс деньги за убийства и бонус групп за вылеты.
 */
export function missionReward(mission: MissionConfig, result: MissionResult, best = 0): Reward {
  const won = result.status === 'won';
  const win = mission.reward?.win ?? 0;
  const earned = missionStars(mission, result);
  const first = won && best <= 0;
  const base = won ? (first ? win : Math.round(win * REPEAT_SHARE)) : (mission.reward?.loss ?? 0);
  const stars = Math.max(0, earned - Math.max(0, best)) * Math.round(win * STAR_SHARE);
  return { base, stars, kills: result.killMoney, income: result.income, total: base + stars + result.killMoney + result.income, earned, first };
}

/** Зачислить награду в профиль. */
export const creditReward = (profile: Profile, reward: Reward): Profile => ({ ...profile, currency: profile.currency + reward.total });

/** Лучший результат по миссии в звёздах; 0 — не пройдена. */
export const bestStars = (profile: Pick<Profile, 'progress'>, missionId: string): number => profile.progress?.[missionId] ?? 0;

/** Записать результат миссии: хранится лучший, поражение (0 звёзд) и худший результат профиль не меняют (тот же объект). */
export function recordStars(profile: Profile, missionId: string, stars: number): Profile {
  return stars > bestStars(profile, missionId) ? { ...profile, progress: { ...profile.progress, [missionId]: Math.min(MAX_STARS, stars) } } : profile;
}

/**
 * Открыта ли миссия. `campaign` — порядок миссий кампании (данные контента): первая открыта всегда,
 * следующая — после победы в предыдущей. Миссия вне кампании открыта; `profile.unlocked` открывает помимо цепочки.
 */
export function missionUnlocked(profile: Pick<Profile, 'progress' | 'unlocked'>, campaign: readonly string[], missionId: string): boolean {
  const i = campaign.indexOf(missionId);
  if (i <= 0 || profile.unlocked?.includes(missionId)) return true;
  return bestStars(profile, campaign[i - 1]!) > 0;
}
