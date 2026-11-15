import type { SimState } from './engine';
import type { Profile } from './profile';
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
  };
}

/** Награда за миссию по статьям; total — то, что зачисляется в профиль. */
export interface Reward {
  /** За исход миссии: размер задан в конфиге миссии. */
  base: number;
  kills: number;
  income: number;
  total: number;
}

/** Чистая формула награды: база исхода из конфига миссии + деньги за убийства + бонус групп за вылеты. */
export function missionReward(mission: MissionConfig, result: MissionResult): Reward {
  const base = mission.reward?.[result.status === 'won' ? 'win' : 'loss'] ?? 0;
  return { base, kills: result.killMoney, income: result.income, total: base + result.killMoney + result.income };
}

/** Зачислить награду в профиль. */
export const creditReward = (profile: Profile, reward: Reward): Profile => ({ ...profile, currency: profile.currency + reward.total });
