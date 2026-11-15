import type { RejectReason } from './economy';
import { createObjective, objectiveOutcome, objectiveRoute, stepObjective, type ObjectiveState } from './objective';
import { buildPath, pointAt, type PathData } from './path';
import { rngNext } from './rng';
import { auraSources, createGroup, enemySpeed, recallGroup, recallRejection, stepGroups, zoneRejection, type GroupState, type LineupEntry } from './sortie';
import { createStats, type MatchStats } from './tally';
import type { Content, EnemyBaseConfig, MissionConfig, Vec2 } from './types';

export const TICK_RATE = 30;
export const DT = 1 / TICK_RATE;

export interface EnemyState {
  id: number;
  type: string;
  /** Индекс волны миссии, из которой враг заспавнен. */
  wave: number;
  hp: number;
  speed: number;
  /** Пройденная дистанция: по пути или, в миссии с целью, по прямой к цели. */
  dist: number;
  /** Текущая позиция в клетках. */
  pos: Vec2;
}

export type SimEvent =
  | { type: 'waveStart'; wave: number }
  /** База (индекс в `MissionConfig.bases`) с этой волны выпускает новый тип врагов. */
  | { type: 'baseUpgrade'; base: number; enemy: string }
  /** Враг появился; from — id погибшего носителя, если враг выпущен им (`EnemyConfig.spawnOnDeath`). */
  | { type: 'spawn'; enemy: number; from?: number }
  /** Враг дошёл: в миссии с целью урон идёт по прочности цели, без цели — по жизням базы. */
  | { type: 'leak'; enemy: number; damage: number }
  | { type: 'kill'; enemy: number; reward: number }
  | { type: 'groupShot'; group: number; enemy: number; damage: number }
  /** Вылет завершён: группа вернулась на аэродром; sortie — номер вылета группы с 1. */
  | { type: 'sortieDone'; group: number; sortie: number }
  /** Центр зоны группы перенесён командой setZone. */
  | { type: 'zoneSet'; group: number; zone: Vec2 }
  /** Группа отозвана на базу командой recall. */
  | { type: 'recalled'; group: number }
  /** Бонус к награде миссии от группы за завершённый вылет (стат income). */
  | { type: 'income'; group: number; amount: number }
  | { type: 'rejected'; command: Command; reason: RejectReason };

/**
 * setZone — центр зоны патрулирования группы (GroupState.id), радиус берётся из конфига группы.
 * Перенос действует сразу в фазах takeoff/transit/patrol; в return/rearm группа не меняет курс и учтёт зону на следующем вылете.
 * recall — досрочный возврат группы на базу: в перелёте или патруле она сразу уходит на аэродром, перезаряжается и вылетает снова.
 * Покупок и улучшений в бою нет: состав и уровни задаются при создании матча.
 */
export type Command = { type: 'setZone'; group: number; zone: Vec2 } | { type: 'recall'; group: number };

export interface SimState {
  tick: number;
  rng: number;
  /** Награда, заработанная в миссии: убийства и бонусы групп за вылеты. */
  money: number;
  /** Убито врагов за матч. */
  kills: number;
  /** Часть `money` от бонусов групп за завершённые вылеты (стат income). */
  income: number;
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
  /** Авиагруппы на вылете: состав задаётся при создании матча и в бою не меняется. */
  groups: GroupState[];
  /** Цель миссии; нет — миссия с путём и жизнями базы. */
  objective?: ObjectiveState;
  /** Статистика матча по группам и волнам. */
  stats: MatchStats;
  /** События последнего тика. */
  events: SimEvent[];
}

export interface Sim {
  readonly mission: MissionConfig;
  readonly content: Content;
  /** Путь врагов; нет в миссиях с целью. */
  readonly path?: PathData;
  /** Маршрут подвижной цели (escort). */
  readonly route?: PathData;
  /** Расписание спавна по волнам: тик от старта волны, отсортировано; at — точка появления. */
  readonly waveSpawns: readonly (readonly { tick: number; enemy: string; at: Vec2 }[])[];
  state: SimState;
}

/** Типы врагов, которые база выпускает к волне с номером `wave` (с 1), в порядке списка. */
export const baseTypes = (base: EnemyBaseConfig, wave: number): string[] =>
  base.roster.filter((r) => (r.fromWave ?? 1) <= wave).map((r) => r.enemy);

/** Типы, которые база получает ровно с волны `wave` (с 1); у первой волны новых нет — это исходный набор. */
export const baseNewTypes = (base: EnemyBaseConfig, wave: number): string[] =>
  wave <= 1 ? [] : base.roster.filter((r) => (r.fromWave ?? 1) === wave).map((r) => r.enemy);

/** lineup — состав на вылет (группы, уровни, стартовые зоны); покупок групп в бою нет. */
export function createSim(mission: MissionConfig, content: Content, seed: number, lineup: readonly LineupEntry[] = []): Sim {
  const groups = lineup.map((entry, i) => createGroup(mission, content, entry, i + 1));
  const { objective } = mission;
  if (!objective && !mission.path) throw new Error(`mission needs a path or an objective: ${mission.id}`);
  const path = objective || !mission.path ? undefined : buildPath(mission.path);
  const waveSpawns = mission.waves.map((wave, waveIndex) => {
    const spawns: { tick: number; enemy: string; at: Vec2 }[] = [];
    for (const g of wave.groups) {
      if (!content.enemies[g.enemy]) throw new Error(`unknown enemy: ${g.enemy}`);
      const base = path ? undefined : mission.bases?.[g.base ?? 0];
      const at = path ? path.points[0]! : base?.pos;
      if (!at) throw new Error(`unknown enemy base ${g.base ?? 0}: ${mission.id}`);
      if (base && base.roster.length && !baseTypes(base, waveIndex + 1).includes(g.enemy))
        throw new Error(`base ${base.id} does not launch ${g.enemy} in wave ${waveIndex + 1}: ${mission.id}`);
      for (let i = 0; i < g.count; i++)
        spawns.push({ tick: Math.round(((g.delay ?? 0) + i * g.interval) * TICK_RATE), enemy: g.enemy, at });
    }
    return spawns.sort((a, b) => a.tick - b.tick);
  });
  return {
    mission,
    content,
    path,
    route: objective && objectiveRoute(objective),
    waveSpawns,
    state: {
      tick: 0,
      rng: seed >>> 0,
      money: 0,
      kills: 0,
      income: 0,
      lives: mission.baseLives,
      status: 'running',
      wave: 0,
      phase: 'prep',
      phaseTick: 0,
      nextSpawn: 0,
      nextId: groups.length + 1,
      enemies: [],
      groups,
      ...(objective ? { objective: createObjective(objective) } : {}),
      stats: createStats(groups, mission.waves.length),
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
    case 'setZone': {
      const reason = zoneRejection(sim, cmd.group, cmd.zone);
      if (reason) return reject(reason);
      const g = s.groups.find((x) => x.id === cmd.group)!;
      g.zone = { x: cmd.zone.x, y: cmd.zone.y };
      s.events.push({ type: 'zoneSet', group: g.id, zone: { ...g.zone } });
      return;
    }
    case 'recall': {
      const reason = recallRejection(sim, cmd.group);
      if (reason) return reject(reason);
      recallGroup(s.groups.find((x) => x.id === cmd.group)!);
      s.events.push({ type: 'recalled', group: cmd.group });
    }
  }
}

/** Наименьшая доля урона попадания, проходящая сквозь любую броню. */
export const ARMOR_MIN_SHARE = 0.1;

/** Урон одного попадания по броне: теряет `armor`, но не опускается ниже ARMOR_MIN_SHARE от исходного. */
export const armoredDamage = (amount: number, armor = 0): number =>
  armor > 0 ? Math.max(amount - armor, amount * ARMOR_MIN_SHARE) : amount;

/** Шаг разлёта врагов, выпущенных носителем: по кругу (миссия с целью) или назад по пути, клеток. */
const BROOD_SPREAD = 0.35;

/** Новый враг в состоянии матча: разброс скорости из RNG, счётчик волны, событие spawn. */
function addEnemy(sim: Sim, type: string, wave: number, at: Vec2, dist = 0, from?: number): void {
  const s = sim.state;
  const cfg = sim.content.enemies[type]!;
  const jitter = cfg.speedVar ? 1 + (rngNext(s) * 2 - 1) * cfg.speedVar : 1;
  const id = s.nextId++;
  s.stats.waves[wave]!.spawned++;
  s.enemies.push({ id, type: cfg.id, wave, hp: cfg.hp, speed: cfg.speed * jitter, dist, pos: { ...at } });
  s.events.push(from === undefined ? { type: 'spawn', enemy: id } : { type: 'spawn', enemy: id, from });
}

/**
 * Наносит урон врагу (с учётом его брони); при гибели начисляет награду и выпускает врагов носителя.
 * Возвращает true, если враг убит.
 * `by` — id группы-стрелка: ей в статистику идёт фактический урон (после брони, не больше остатка здоровья) и убийство.
 */
export function damageEnemy(sim: Sim, enemyId: number, amount: number, by?: number): boolean {
  const s = sim.state;
  const i = s.enemies.findIndex((e) => e.id === enemyId);
  const e = s.enemies[i];
  if (!e) return false;
  const cfg = sim.content.enemies[e.type]!;
  const dealt = armoredDamage(amount, cfg.armor);
  const shooter = by === undefined ? undefined : s.stats.groups.find((g) => g.id === by);
  if (shooter) shooter.damage += Math.max(0, Math.min(dealt, e.hp));
  e.hp -= dealt;
  if (e.hp > 0) return false;
  if (shooter) shooter.kills++;
  s.stats.waves[e.wave]!.killed++;
  const reward = cfg.reward;
  s.enemies.splice(i, 1);
  s.money += reward;
  s.kills++;
  s.events.push({ type: 'kill', enemy: e.id, reward });
  const brood = cfg.spawnOnDeath;
  if (brood && sim.content.enemies[brood.enemy]) {
    for (let k = 0; k < brood.count; k++) {
      if (sim.path) {
        // Миссия с путём: выпущенные враги встают цепочкой позади места гибели.
        const d = Math.max(0, e.dist - k * BROOD_SPREAD);
        addEnemy(sim, brood.enemy, e.wave, pointAt(sim.path, d), d, e.id);
      } else {
        const a = (2 * Math.PI * k) / brood.count;
        const at = { x: e.pos.x + Math.cos(a) * BROOD_SPREAD, y: e.pos.y + Math.sin(a) * BROOD_SPREAD };
        addEnemy(sim, brood.enemy, e.wave, at, e.dist, e.id);
      }
    }
  }
  return true;
}

/** Радиус, с которого враг достаёт цель миссии, клеток. */
export const OBJECTIVE_REACH = 0.3;

/** Приоритет врага как мишени, больше — опаснее: ближе к цели миссии или дальше прошёл по пути. */
export function enemyThreat(sim: Sim, e: EnemyState): number {
  const o = sim.state.objective;
  return o ? -Math.hypot(e.pos.x - o.pos.x, e.pos.y - o.pos.y) : e.dist;
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
    // База растёт: с этой волны (номер s.wave, с 1) у неё новый тип врагов.
    (sim.mission.bases ?? []).forEach((b, base) => {
      for (const enemy of baseNewTypes(b, s.wave)) s.events.push({ type: 'baseUpgrade', base, enemy });
    });
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
    addEnemy(sim, sp.enemy, s.wave - 1, sp.at);
  }

  stepGroups(sim);
  const goal = s.objective;
  if (goal) stepObjective(sim.mission.objective!, sim.route, goal);
  const sources = auraSources(sim);
  s.enemies = s.enemies.filter((e) => {
    const stepLen = enemySpeed(sim, e, sources) * DT;
    e.dist += stepLen;
    if (goal) {
      // Наведение: каждый тик курс берётся на текущую позицию цели, поэтому за подвижной целью враг доворачивает.
      const dx = goal.pos.x - e.pos.x;
      const dy = goal.pos.y - e.pos.y;
      const d = Math.hypot(dx, dy);
      if (d > stepLen + OBJECTIVE_REACH) {
        e.pos.x += (dx / d) * stepLen;
        e.pos.y += (dy / d) * stepLen;
        return true;
      }
    } else {
      e.pos = pointAt(sim.path!, e.dist);
      if (e.dist < sim.path!.length) return true;
    }
    const damage = sim.content.enemies[e.type]!.leakDamage;
    if (goal) goal.hp -= damage;
    else s.lives -= damage;
    const tally = s.stats.waves[e.wave]!;
    tally.leaked++;
    tally.damage += damage;
    s.events.push({ type: 'leak', enemy: e.id, damage });
    return false;
  });

  s.tick++;
  s.phaseTick++;
  if (goal) s.status = objectiveOutcome(sim.mission.objective!, sim.route, goal) ?? 'running';
  else if (s.lives <= 0) s.status = 'lost';
  else if (s.wave >= sim.mission.waves.length && spawnsDone(sim) && s.enemies.length === 0) s.status = 'won';
}
