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
  | { type: 'waveStart'; wave: number }
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
  /** Сколько волн уже стартовало (индекс следующей волны). */
  wave: number;
  /** prep — подготовка к волне `wave`; wave — идёт спавн/бой волны `wave - 1`. */
  phase: 'prep' | 'wave';
  /** Тиков с начала текущей фазы. */
  phaseTick: number;
  /** Индекс следующего спавна в текущей волне. */
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
  /** Расписание спавна по волнам: тик от старта волны, отсортировано. */
  readonly waveSpawns: readonly (readonly { tick: number; enemy: string }[])[];
  state: SimState;
}

export function createSim(mission: MissionConfig, content: Content, seed: number): Sim {
  const waveSpawns = mission.waves.map((wave) => {
    const spawns: { tick: number; enemy: string }[] = [];
    for (const g of wave.groups) {
      if (!content.enemies[g.enemy]) throw new Error(`unknown enemy: ${g.enemy}`);
      for (let i = 0; i < g.count; i++)
        spawns.push({ tick: Math.round(((g.delay ?? 0) + i * g.interval) * TICK_RATE), enemy: g.enemy });
    }
    return spawns.sort((a, b) => a.tick - b.tick);
  });
  return {
    mission,
    content,
    path: buildPath(mission.path),
    waveSpawns,
    state: {
      tick: 0,
      rng: seed >>> 0,
      money: mission.startMoney,
      lives: mission.baseLives,
      status: 'running',
      wave: 0,
      phase: 'prep',
      phaseTick: 0,
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

/** Текущая волна идёт и все её спавны выполнены. */
const spawnsDone = (sim: Sim): boolean =>
  sim.state.phase === 'wave' && sim.state.nextSpawn >= (sim.waveSpawns[sim.state.wave - 1]?.length ?? 0);

/** Переходы между фазами по правилу старта следующей волны из конфига. */
function advancePhase(sim: Sim): void {
  const s = sim.state;
  const next = sim.mission.waves[s.wave];
  if (!next) return;
  if (spawnsDone(sim) && ((next.start ?? 'timer') === 'timer' || s.enemies.length === 0)) {
    s.phase = 'prep';
    s.phaseTick = 0;
  }
  if (s.phase === 'prep' && s.phaseTick >= Math.round(next.prep * TICK_RATE)) {
    s.phase = 'wave';
    s.phaseTick = 0;
    s.nextSpawn = 0;
    s.events.push({ type: 'waveStart', wave: s.wave++ });
  }
}

/** Один фиксированный шаг симуляции. */
export function step(sim: Sim, commands: readonly Command[] = []): void {
  const s = sim.state;
  if (s.status !== 'running') return;
  s.events = [];
  for (const c of commands) applyCommand(sim, c);
  advancePhase(sim);

  const spawns = sim.waveSpawns[s.wave - 1] ?? [];
  for (let sp = s.phase === 'wave' ? spawns[s.nextSpawn] : undefined; sp && sp.tick <= s.phaseTick; sp = spawns[++s.nextSpawn]) {
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
  s.phaseTick++;
  if (s.lives <= 0) s.status = 'lost';
  else if (s.wave >= sim.mission.waves.length && spawnsDone(sim) && s.enemies.length === 0) s.status = 'won';
}
