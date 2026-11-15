import { createSim, step, TICK_RATE, type Command, type Sim } from './engine';
import { createObjective } from './objective';
import { groupStats, weaponHits, type GroupState } from './sortie';
import { moveClass, navRoute } from './terrain';
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

/** Бот переносит зону, когда нужная точка ушла от её центра дальше этого расстояния (клеток). */
const FOLLOW = 0.5;

/** Доля радиуса зоны, на которую ударная группа выносит зону от цели навстречу врагу: цель миссии остаётся внутри зоны. */
const LEAN = 0.6;

/** Бот учитывает врагов не дальше стольких радиусов зоны от цели миссии: дальние ещё не угроза. */
const APPROACH = 3;

/** Точка маршрута на расстоянии `back` по пути от его конца (цели); маршрут короче — его начало. */
function approachPoint(route: readonly Vec2[], back: number): Vec2 {
  for (let i = route.length - 1; i > 0; i--) {
    const a = route[i]!;
    const b = route[i - 1]!;
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len >= back && len > 0) return { x: a.x + ((b.x - a.x) * back) / len, y: a.y + ((b.y - a.y) * back) / len };
    back -= len;
  }
  return route[0]!;
}

/**
 * Где бот хочет видеть зону группы. Группа поддержки (без оружия) держит зону на цели миссии — аура накрывает подступы.
 * Ударная выносит зону от цели в сторону подходящих врагов, по которым может стрелять: смещение — среднее направлений на них
 * (при рельефе — на точки их маршрутов в обход преград: зона встаёт в проход, а не упирается в гору),
 * поэтому против одной колонны зона уходит ей навстречу (враг дольше идёт под огнём), а при атаке с разных сторон остаётся на цели.
 * Игрок делает то же самое переносом зон.
 */
export function botZone(sim: Sim, g: GroupState): Vec2 {
  const at = focus(sim);
  const weapons = sim.content.groups[g.type]!.weapons;
  if (!weapons.length) return at;
  const radius = groupStats(sim, g).zoneRadius;
  let dx = 0;
  let dy = 0;
  let n = 0;
  for (const e of sim.state.enemies) {
    const tags = sim.content.enemies[e.type]!.tags;
    if (!weapons.some((w) => weaponHits(w, tags))) continue;
    // Маршрут врага к цели: без преград — прямая, иначе ломаная в обход рельефа.
    const route = sim.state.objective ? navRoute(sim.nav, moveClass(tags), e.pos, at, e.via) : [e.pos, at];
    let d = 0;
    for (let i = 1; i < route.length; i++) d += Math.hypot(route[i]!.x - route[i - 1]!.x, route[i]!.y - route[i - 1]!.y);
    if (d < 1e-6 || d > radius * APPROACH) continue;
    // Зона выносится туда, откуда враг подойдёт: к точке его маршрута на краю будущей зоны.
    const from = route.length > 2 ? approachPoint(route, radius * LEAN) : e.pos;
    const direct = Math.hypot(from.x - at.x, from.y - at.y);
    if (direct < 1e-6) continue;
    dx += (from.x - at.x) / direct;
    dy += (from.y - at.y) / direct;
    n++;
  }
  if (!n) return at;
  const lean = (radius * LEAN) / n;
  const { w, h } = sim.mission.size;
  const clamp = (v: number, max: number) => Math.min(max - 1, Math.max(0, v));
  return { x: clamp(at.x + dx * lean, w), y: clamp(at.y + dy * lean, h) };
}

/**
 * Headless-матч: состав `lineup` (id групп, уровень 0) держит зоны у цели миссии и двигает их вслед за ней и навстречу врагам.
 * Основа симулятора баланса (design.md §4).
 */
export function runMatch(mission: MissionConfig, content: Content, seed: number, lineup: readonly string[], maxSeconds = 1200): MatchResult {
  const start = mission.objective ? createObjective(mission.objective).pos : mission.path!.at(-1)!;
  const match = createSim(mission, content, seed, lineup.map((group) => ({ group, level: 0, zone: { ...start } })));
  const s = match.state;
  let kills = 0;
  let sorties = 0;
  for (let i = 0; i < maxSeconds * TICK_RATE && s.status === 'running'; i++) {
    const commands: Command[] = [];
    for (const g of s.groups) {
      const zone = botZone(match, g);
      if (Math.hypot(g.zone.x - zone.x, g.zone.y - zone.y) > FOLLOW) commands.push({ type: 'setZone', group: g.id, zone });
    }
    step(match, commands);
    for (const ev of s.events) {
      if (ev.type === 'kill') kills++;
      else if (ev.type === 'sortieDone') sorties++;
    }
  }
  return { status: s.status, reward: s.money, hp: s.objective?.hp ?? s.lives, kills, sorties, ticks: s.tick };
}
