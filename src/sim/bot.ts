import { createSim, step, TICK_RATE, type Command, type Sim } from './engine';
import { createObjective } from './objective';
import type { Content, MissionConfig, Vec2 } from './types';

export interface MatchResult {
  status: 'running' | 'won' | 'lost';
  /** Награда миссии: убийства и бонусы групп за вылеты. */
  reward: number;
  /** Остаток прочности цели (в миссии без цели — жизни базы). */
  hp: number;
  kills: number;
  /** Завершённых вылетов по всем группам. */
  sorties: number;
  ticks: number;
}

/** Куда бот ставит зоны: на текущую позицию цели миссии, без цели — на конец пути врагов. */
const focus = (sim: Sim): Vec2 => sim.state.objective?.pos ?? sim.path!.points.at(-1)!;

/** Бот переносит зону, когда цель ушла от её центра дальше этого расстояния (клеток). */
const FOLLOW = 0.5;

/**
 * Headless-матч: состав `lineup` (id групп, уровень 0) держит зоны на цели миссии и двигает их вслед за ней.
 * Основа симулятора баланса (design.md §4).
 */
export function runMatch(mission: MissionConfig, content: Content, seed: number, lineup: readonly string[], maxSeconds = 1200): MatchResult {
  const start = mission.objective ? createObjective(mission.objective).pos : mission.path!.at(-1)!;
  const match = createSim(mission, content, seed, lineup.map((group) => ({ group, level: 0, zone: { ...start } })));
  const s = match.state;
  let kills = 0;
  let sorties = 0;
  for (let i = 0; i < maxSeconds * TICK_RATE && s.status === 'running'; i++) {
    const at = focus(match);
    const commands: Command[] = s.groups
      .filter((g) => Math.hypot(g.zone.x - at.x, g.zone.y - at.y) > FOLLOW)
      .map((g) => ({ type: 'setZone', group: g.id, zone: { ...at } }));
    step(match, commands);
    for (const ev of s.events) {
      if (ev.type === 'kill') kills++;
      else if (ev.type === 'sortieDone') sorties++;
    }
  }
  return { status: s.status, reward: s.money, hp: s.objective?.hp ?? s.lives, kills, sorties, ticks: s.tick };
}
