import { buyRejection, sellRefund, upgradeRejection, type RejectReason } from './economy';
import { buildPath, pointAt, type PathData } from './path';
import { rngNext } from './rng';
import { createGroup, stepGroups, type GroupState, type LineupEntry } from './sortie';
import { applyModifiers } from './stats';
import type { Content, MissionConfig, Modifier, Stats, Vec2 } from './types';

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
  /** Тиков до следующего выстрела. */
  cooldown: number;
}

export type SimEvent =
  | { type: 'waveStart'; wave: number }
  | { type: 'spawn'; enemy: number }
  | { type: 'leak'; enemy: number; damage: number }
  | { type: 'kill'; enemy: number; reward: number }
  | { type: 'shot'; unit: number; enemy: number; damage: number }
  | { type: 'groupShot'; group: number; enemy: number; damage: number }
  /** Вылет завершён: группа вернулась на аэродром; sortie — номер вылета группы с 1. */
  | { type: 'sortieDone'; group: number; sortie: number }
  | { type: 'income'; amount: number }
  | { type: 'bought'; unit: number }
  | { type: 'upgraded'; unit: number; level: number }
  | { type: 'sold'; unit: number; refund: number }
  | { type: 'rejected'; command: Command; reason: RejectReason };

/** buy — купить юнит типа `unit` в слот; upgrade/sell — над юнитом матча по его id (UnitState.id). */
export type Command =
  | { type: 'buy'; unit: string; slot: number }
  | { type: 'upgrade'; unit: number }
  | { type: 'sell'; unit: number };

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
  /** Авиагруппы на вылете: состав задаётся при создании матча и в бою не меняется. */
  groups: GroupState[];
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

/** lineup — состав на вылет (группы, уровни, стартовые зоны); покупок групп в бою нет. */
export function createSim(mission: MissionConfig, content: Content, seed: number, lineup: readonly LineupEntry[] = []): Sim {
  const groups = lineup.map((entry, i) => createGroup(mission, content, entry, i + 1));
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
      nextId: groups.length + 1,
      enemies: [],
      units: [],
      groups,
      events: [],
    },
  };
}

export const simTime = (sim: Sim): number => sim.state.tick * DT;

/** Глубокая копия состояния для UI/рендера и сравнения прогонов. */
export const snapshot = (sim: Sim): SimState => structuredClone(sim.state);

function applyCommand(sim: Sim, cmd: Command): void {
  const s = sim.state;
  const reject = (reason: RejectReason) => void s.events.push({ type: 'rejected', command: cmd, reason });
  switch (cmd.type) {
    case 'buy': {
      const reason = buyRejection(sim, cmd.unit, cmd.slot);
      if (reason) return reject(reason);
      s.money -= sim.content.units[cmd.unit]!.cost;
      const id = s.nextId++;
      s.units.push({ id, type: cmd.unit, slot: cmd.slot, level: 0, cooldown: 0 });
      s.events.push({ type: 'bought', unit: id });
      return;
    }
    case 'upgrade': {
      const reason = upgradeRejection(sim, cmd.unit);
      if (reason) return reject(reason);
      const u = s.units.find((x) => x.id === cmd.unit)!;
      s.money -= sim.content.units[u.type]!.upgrades[u.level]!.cost;
      u.level++;
      s.events.push({ type: 'upgraded', unit: u.id, level: u.level });
      return;
    }
    case 'sell': {
      const i = s.units.findIndex((x) => x.id === cmd.unit);
      const u = s.units[i];
      if (!u) return reject('unknown');
      const refund = sellRefund(sim, u);
      s.units.splice(i, 1);
      s.money += refund;
      s.events.push({ type: 'sold', unit: u.id, refund });
    }
  }
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

/** Модификаторы, которые даёт юнит: постоянные + купленные уровни улучшений. */
function ownMods(sim: Sim, u: UnitState): Modifier[] {
  const cfg = sim.content.units[u.type]!;
  return [...cfg.modifiers, ...cfg.upgrades.slice(0, u.level).flatMap((g) => g.modifiers)];
}

const reaches = (m: Modifier, from: Vec2, to: Vec2, tags: readonly string[]): boolean =>
  (m.scope === 'global' || (m.scope === 'aura' && Math.hypot(from.x - to.x, from.y - to.y) <= (m.radius ?? 0))) &&
  (m.tags ?? []).every((t) => tags.includes(t));

/** Эффективные статы юнита: свои self-модификаторы + ауры/глобальные эффекты других юнитов, подходящие по тегам. */
export function unitStats(sim: Sim, unit: UnitState): Stats {
  const cfg = sim.content.units[unit.type]!;
  const pos = sim.mission.slots[unit.slot]!;
  const mods = ownMods(sim, unit).filter((m) => m.scope === 'self' && m.side !== 'enemy');
  for (const o of sim.state.units) {
    if (o.id === unit.id) continue;
    const from = sim.mission.slots[o.slot]!;
    for (const m of ownMods(sim, o)) if (m.side !== 'enemy' && reaches(m, from, pos, cfg.tags)) mods.push(m);
  }
  return applyModifiers(cfg.stats, mods);
}

/** Эффективная скорость врага с учётом вражеских модификаторов юнитов (side: 'enemy'). */
export function enemySpeed(sim: Sim, enemy: EnemyState): number {
  const tags = sim.content.enemies[enemy.type]!.tags;
  const pos = pointAt(sim.path, enemy.dist);
  const mods: Modifier[] = [];
  for (const u of sim.state.units) {
    const from = sim.mission.slots[u.slot]!;
    for (const m of ownMods(sim, u)) if (m.side === 'enemy' && reaches(m, from, pos, tags)) mods.push(m);
  }
  return mods.length ? (applyModifiers({ speed: enemy.speed }, mods).speed ?? enemy.speed) : enemy.speed;
}

/** Юниты стреляют по самому продвинутому врагу в радиусе; темп — fireRate выстрелов в секунду. */
function fire(sim: Sim): void {
  const s = sim.state;
  for (const u of s.units) {
    if (u.cooldown > 0) u.cooldown--;
    if (u.cooldown > 0 || s.enemies.length === 0) continue;
    const { damage = 0, range = 0, fireRate = 0 } = unitStats(sim, u);
    if (damage <= 0 || fireRate <= 0) continue;
    const pos = sim.mission.slots[u.slot]!;
    let target: EnemyState | undefined;
    for (const e of s.enemies) {
      const p = pointAt(sim.path, e.dist);
      if (Math.hypot(p.x - pos.x, p.y - pos.y) <= range && (!target || e.dist > target.dist)) target = e;
    }
    if (!target) continue;
    s.events.push({ type: 'shot', unit: u.id, enemy: target.id, damage });
    damageEnemy(sim, target.id, damage);
    u.cooldown = Math.max(1, Math.round(TICK_RATE / fireRate));
  }
}

/** Доход между волнами: сумма income всех юнитов, начисляется при старте волны. */
function grantIncome(sim: Sim): void {
  let amount = 0;
  for (const u of sim.state.units) amount += unitStats(sim, u).income ?? 0;
  if (amount <= 0) return;
  sim.state.money += amount;
  sim.state.events.push({ type: 'income', amount });
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
    grantIncome(sim);
  }
}

/** Один фиксированный шаг симуляции. */
export function step(sim: Sim, commands: readonly Command[] = []): void {
  const s = sim.state;
  // События живут один тик: после конца матча повторный step не должен отдавать их заново.
  s.events = [];
  if (s.status !== 'running') return;
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

  fire(sim);
  stepGroups(sim);
  for (const e of s.enemies) e.dist += enemySpeed(sim, e) * DT;
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
