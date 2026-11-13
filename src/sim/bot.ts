import { createSim, step, TICK_RATE } from './engine';
import type { Content, MissionConfig } from './types';

/** Шаг порядка закупки: какой юнит в какой слот. */
export interface BuildStep {
  unit: string;
  slot: number;
}

export interface MatchResult {
  status: 'running' | 'won' | 'lost';
  lives: number;
  /** Сколько волн стартовало. */
  wave: number;
  kills: number;
  ticks: number;
  /** Сколько юнитов из порядка закупки успели купить. */
  bought: number;
}

/**
 * Headless-матч: бот покупает юниты по порядку `order`, как только хватает денег на очередной шаг.
 * Основа симулятора баланса (design.md §4).
 */
export function runMatch(mission: MissionConfig, content: Content, seed: number, order: readonly BuildStep[], maxSeconds = 1200): MatchResult {
  const sim = createSim(mission, content, seed);
  const s = sim.state;
  let kills = 0;
  for (let i = 0; i < maxSeconds * TICK_RATE && s.status === 'running'; i++) {
    const next = order[s.units.length];
    const cost = next && content.units[next.unit]?.cost;
    step(sim, next && cost !== undefined && s.money >= cost ? [{ type: 'buy', ...next }] : []);
    for (const ev of s.events) if (ev.type === 'kill') kills++;
  }
  return { status: s.status, lives: s.lives, wave: s.wave, kills, ticks: s.tick, bought: s.units.length };
}
