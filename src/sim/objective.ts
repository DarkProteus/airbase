import { DT, TICK_RATE } from './engine';
import { buildPath, pointAt, type PathData } from './path';
import type { ObjectiveConfig, Vec2 } from './types';

/** Состояние цели миссии в матче. */
export interface ObjectiveState {
  /** Прочность; ≤ 0 — миссия проиграна. */
  hp: number;
  /** Текущая позиция: на неё наводятся враги. */
  pos: Vec2;
  /** Прогресс к победе в единицах типа цели: defend — тиков удержано, escort — клеток пройдено по маршруту. */
  progress: number;
}

/** Маршрут подвижной цели; undefined — цель неподвижна. */
export function objectiveRoute(cfg: ObjectiveConfig): PathData | undefined {
  return cfg.type === 'escort' ? buildPath(cfg.route) : undefined;
}

export function createObjective(cfg: ObjectiveConfig): ObjectiveState {
  if (!(cfg.hp > 0)) throw new Error(`objective hp must be positive: ${cfg.type}`);
  switch (cfg.type) {
    case 'defend':
      return { hp: cfg.hp, pos: { ...cfg.pos }, progress: 0 };
    case 'escort':
      if (!(cfg.speed > 0)) throw new Error('escort speed must be positive');
      return { hp: cfg.hp, pos: { ...cfg.route[0]! }, progress: 0 };
  }
}

/** Сколько прогресса нужно для победы (в тех же единицах, что `ObjectiveState.progress`). */
export function objectiveGoal(cfg: ObjectiveConfig, route: PathData | undefined): number {
  switch (cfg.type) {
    case 'defend':
      return Math.round(cfg.duration * TICK_RATE);
    case 'escort':
      return route!.length;
  }
}

/** Один тик цели: таймер удержания или движение колонны по маршруту. */
export function stepObjective(cfg: ObjectiveConfig, route: PathData | undefined, st: ObjectiveState): void {
  switch (cfg.type) {
    case 'defend':
      st.progress++;
      return;
    case 'escort': {
      // Погрешность накопления шагов не должна оставлять колонну в волоске от выхода.
      const next = st.progress + cfg.speed * DT;
      st.progress = next >= route!.length - 1e-9 ? route!.length : next;
      st.pos = pointAt(route!, st.progress);
      return;
    }
  }
}

/** Итог по цели: поражение при прочности ≤ 0 важнее победы; undefined — матч продолжается. */
export function objectiveOutcome(cfg: ObjectiveConfig, route: PathData | undefined, st: ObjectiveState): 'won' | 'lost' | undefined {
  if (st.hp <= 0) return 'lost';
  return st.progress >= objectiveGoal(cfg, route) ? 'won' : undefined;
}
