import { buildPath, type PathData } from './path';
import { rngNext } from './rng';
import type { Content, MissionConfig } from './types';

export const TICK_RATE = 30;
export const DT = 1 / TICK_RATE;

export interface EnemyState {
  id: number;
  type: string;
  hp: number;
  speed: number;
  /** Пройденная дистанция по пути. */
  dist: number;
}

export interface UnitState {
  id: number;
  type: string;
  slot: number;
  level: number;
}

export type SimEvent =
  | { type: 'spawn'; enemy: number }
  | { type: 'leak'; enemy: number; damage: number }
  | { type: 'kill'; enemy: number; reward: number }
  | { type: 'bought'; unit: number }
  | { type: 'rejected'; command: Command; reason: 'money' | 'slot' | 'unknown' };

export type Command = { type: 'buy'; unit: string; slot: number };

export interface SimState {
  tick: number;
  rng: number;
  money: number;
  lives: number;
  status: 'running' | 'won' | 'lost';
  nextSpawn: number;
  nextId: number;
  enemies: EnemyState[];
  units: UnitState[];
  /** События последнего тика. */
  events: SimEvent[];
}

export interface Sim {
  readonly mission: MissionConfig;
  readonly content: Content;
  readonly path: PathData;
  /** Плоское расписание спавна, отсортировано по тику. */
  readonly schedule: readonly { tick: number; enemy: string }[];
  state: SimState;
}

export function createSim(mission: MissionConfig, content: Content, seed: number): Sim {
  const schedule: { tick: number; enemy: string }[] = [];
  for (const wave of mission.waves)
    for (const g of wave.groups) {
      if (!content.enemies[g.enemy]) throw new Error(`unknown enemy: ${g.enemy}`);
      for (let i = 0; i < g.count; i++)
        schedule.push({ tick: Math.round((wave.at + (g.delay ?? 0) + i * g.interval) * TICK_RATE), enemy: g.enemy });
    }
  schedule.sort((a, b) => a.tick - b.tick);
  return {
    mission,
    content,
    path: buildPath(mission.path),
    schedule,
    state: {
      tick: 0,
      rng: seed >>> 0,
      money: mission.startMoney,
      lives: mission.baseLives,
      status: 'running',
      nextSpawn: 0,
      nextId: 1,
      enemies: [],
      units: [],
      events: [],
    },
  };
}

export const simTime = (sim: Sim): number => sim.state.tick * DT;

/** Глубокая копия состояния для UI/рендера и сравнения прогонов. */
export const snapshot = (sim: Sim): SimState => structuredClone(sim.state);

function applyCommand(sim: Sim, cmd: Command): void {
  const s = sim.state;
  const cfg = sim.content.units[cmd.unit];
  const reject = (reason: 'money' | 'slot' | 'unknown') => s.events.push({ type: 'rejected', command: cmd, reason });
  if (!cfg) return void reject('unknown');
  if (!sim.mission.slots[cmd.slot] || s.units.some((u) => u.slot === cmd.slot)) return void reject('slot');
  if (s.money < cfg.cost) return void reject('money');
  s.money -= cfg.cost;
  const id = s.nextId++;
  s.units.push({ id, type: cfg.id, slot: cmd.slot, level: 0 });
  s.events.push({ type: 'bought', unit: id });
}

/** Наносит урон врагу; при гибели начисляет награду. Возвращает true, если враг убит. */
export function damageEnemy(sim: Sim, enemyId: number, amount: number): boolean {
  const s = sim.state;
  const i = s.enemies.findIndex((e) => e.id === enemyId);
  const e = s.enemies[i];
  if (!e) return false;
  e.hp -= amount;
  if (e.hp > 0) return false;
  const reward = sim.content.enemies[e.type]!.reward;
  s.enemies.splice(i, 1);
  s.money += reward;
  s.events.push({ type: 'kill', enemy: e.id, reward });
  return true;
}

/** Один фиксированный шаг симуляции. */
export function step(sim: Sim, commands: readonly Command[] = []): void {
  const s = sim.state;
  if (s.status !== 'running') return;
  s.events = [];
  for (const c of commands) applyCommand(sim, c);

  for (let sp = sim.schedule[s.nextSpawn]; sp && sp.tick <= s.tick; sp = sim.schedule[++s.nextSpawn]) {
    const cfg = sim.content.enemies[sp.enemy]!;
    const jitter = cfg.speedVar ? 1 + (rngNext(s) * 2 - 1) * cfg.speedVar : 1;
    const id = s.nextId++;
    s.enemies.push({ id, type: cfg.id, hp: cfg.hp, speed: cfg.speed * jitter, dist: 0 });
    s.events.push({ type: 'spawn', enemy: id });
  }

  for (const e of s.enemies) e.dist += e.speed * DT;
  s.enemies = s.enemies.filter((e) => {
    if (e.dist < sim.path.length) return true;
    const damage = sim.content.enemies[e.type]!.leakDamage;
    s.lives -= damage;
    s.events.push({ type: 'leak', enemy: e.id, damage });
    return false;
  });

  s.tick++;
  if (s.lives <= 0) s.status = 'lost';
  else if (s.nextSpawn >= sim.schedule.length && s.enemies.length === 0) s.status = 'won';
}
