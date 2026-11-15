import type { MissionConfig, SortiePhase, Vec2 } from '../sim';
import { layoutAirfield } from './environment';

/**
 * Визуальная траектория вылета у аэродрома: чистые функции без three. Sim держит группу в точке аэродрома
 * во время взлёта и перезарядки; рендер раскладывает это по полосе: стоянка -> руление -> разбег -> набор высоты,
 * а при возврате — заход по оси полосы, касание в точке аэродрома, пробег и руление на стоянку.
 * Положение стыкуется с sim на границах фаз: взлёт -> перелёт, возврат -> перезарядка, перезарядка -> взлёт.
 * Ничего не знает про id групп: только фаза, прогресс фазы и раскладка полосы из `environment.ts`.
 */

/** Расстояние от аэродрома, на котором заканчивается набор высоты после взлёта (клеток). */
export const EXIT_DIST = 2;
/** Длина захода на посадку (клеток до касания). */
export const APPROACH_DIST = 2.2;
/** Длина пробега после касания (клеток), если полоса позволяет. */
export const ROLLOUT_DIST = 1.3;
/** Доли фазы взлёта: руление до разбега и момент отрыва внутри разбега. */
const TAXI_SHARE = 0.3;
const LIFTOFF = 0.6;
/** Доли фазы перезарядки: пробег и руление до стоянки. */
const ROLLOUT_SHARE = 0.2;
const TAXI_BACK_END = 0.5;
const STAND_SPACING = 0.8;
/** Смещение стоянок поперёк площадки: соседние группы в шахматном порядке, чтобы модели не налезали друг на друга. */
const STAND_STAGGER = 0.2;
/** Разбег нескольких групп: каждая идёт по своей полосе движения и стартует чуть дальше от торца, чтобы не слипаться. */
const LANE_SPACING = 0.28;
const START_STAGGER = 0.5;

export interface RunwayFrame {
  /** Клетка аэродрома из миссии: сюда садится и отсюда уходит группа в sim. */
  home: Vec2;
  /** Единичный вектор вдоль полосы. */
  dir: Vec2;
  /** Концы полосы: neg — у края карты, pos — к центру. */
  neg: Vec2;
  pos: Vec2;
  /** Курс вдоль полосы по `dir` (как у `headingOf`). */
  heading: number;
  /** Центр площадки: стоянки групп раскладываются вдоль неё. */
  apron: Vec2;
  apronLength: number;
  /** Полуширина полосы. */
  halfWidth: number;
}

export const RUNWAY_HALF_WIDTH = 0.425;

const add = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y });
const sub = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y });
const mul = (a: Vec2, k: number): Vec2 => ({ x: a.x * k, y: a.y * k });
const dot = (a: Vec2, b: Vec2): number => a.x * b.x + a.y * b.y;
const dist = (a: Vec2, b: Vec2): number => Math.hypot(a.x - b.x, a.y - b.y);
const lerp = (a: Vec2, b: Vec2, t: number): Vec2 => add(a, mul(sub(b, a), t));
const clamp01 = (t: number): number => Math.max(0, Math.min(1, t));
const smooth = (t: number): number => {
  const k = clamp01(t);
  return k * k * (3 - 2 * k);
};

/** Раскладка полосы и площадки из миссии: тот же расчёт, что рисует окружение. */
export function runwayFrame(mission: Pick<MissionConfig, 'size' | 'airfield'>): RunwayFrame {
  const af = layoutAirfield(mission as MissionConfig);
  const h = af.runway.heading;
  const dir: Vec2 = { x: Math.cos(h), y: -Math.sin(h) };
  const half = af.runway.length / 2;
  return {
    home: { ...mission.airfield },
    dir,
    neg: sub(af.runway.at, mul(dir, half)),
    pos: add(af.runway.at, mul(dir, half)),
    heading: h,
    apron: af.apron.at,
    apronLength: af.apron.length,
    halfWidth: RUNWAY_HALF_WIDTH,
  };
}

/** Стоянка слота: равномерно вдоль площадки, детерминированно по индексу группы. */
export function standOf(frame: RunwayFrame, slot: number, slots: number): Vec2 {
  const n = Math.max(1, slots);
  const spacing = Math.min(STAND_SPACING, (frame.apronLength * 0.9) / n);
  const across = n > 1 ? (slot % 2 === 0 ? -STAND_STAGGER : STAND_STAGGER) : 0;
  const normal: Vec2 = { x: -frame.dir.y, y: frame.dir.x };
  return add(add(frame.apron, mul(frame.dir, (slot - (n - 1) / 2) * spacing)), mul(normal, across));
}

/** Сторона полосы относительно аэродрома, куда указывает вектор: +1 — к концу pos, -1 — к концу neg. */
export const sideOf = (frame: RunwayFrame, delta: Vec2): 1 | -1 => (dot(delta, frame.dir) >= 0 ? 1 : -1);

/** Сколько полосы остаётся от аэродрома в сторону side. */
function runwayAhead(frame: RunwayFrame, side: 1 | -1): number {
  const end = side > 0 ? frame.pos : frame.neg;
  return Math.max(0, side * dot(sub(end, frame.home), frame.dir));
}

/** Память рендера о вылете группы между снапшотами: нужна, чтобы траектория не дёргалась на краях. */
export interface FlightTrack {
  /** Группа взлетела и ещё не дошла до зоны: перелёт стыкуется с концом разбега. */
  exiting: boolean;
  /** Расстояние до аэродрома в начале возврата. */
  approachDist: number;
  /** С какой стороны полосы группа заходит на посадку (и откуда катится пробег в обратную сторону). */
  side: 1 | -1;
}

export const initialTrack = (): FlightTrack => ({ exiting: false, approachDist: 0, side: 1 });

/** Обновить память по новому снапшоту группы; prevPhase — фаза в прошлом снапшоте. */
export function nextTrack(frame: RunwayFrame, prev: FlightTrack, prevPhase: SortiePhase | undefined, g: { phase: SortiePhase; pos: Vec2 }): FlightTrack {
  const t = { ...prev };
  if (g.phase === 'takeoff') t.exiting = true;
  else if (g.phase !== 'transit') t.exiting = false;
  if (g.phase === 'return' && prevPhase !== 'return') {
    t.approachDist = dist(g.pos, frame.home);
    t.side = sideOf(frame, sub(g.pos, frame.home));
  }
  return t;
}

export interface PoseInput {
  phase: SortiePhase;
  phaseTick: number;
  /** Позиция и центр зоны группы в sim. */
  pos: Vec2;
  zone: Vec2;
  /** Длительности фаз в тиках (минимум 1). */
  takeoffTicks: number;
  rearmTicks: number;
  /** Номер группы среди всех групп матча и их число: стоянка по индексу. */
  slot: number;
  slots: number;
  track: FlightTrack;
}

export interface Pose {
  /** Визуальная позиция, клетки. */
  at: Vec2;
  /** Доля высоты полёта: 0 — на земле, 1 — на эшелоне. */
  lift: number;
  /** Курс для неподвижной группы (на движении курс берут из смещения). */
  heading: number;
}

/** Визуальная поза группы. На границах фаз стыкуется с соседними (см. тесты). */
export function groupPose(frame: RunwayFrame, g: PoseInput): Pose {
  const { home, dir } = frame;
  const stand = standOf(frame, g.slot, g.slots);
  const flight = (at: Vec2, lift: number): Pose => ({ at, lift, heading: frame.heading });
  switch (g.phase) {
    case 'takeoff': {
      const { start, end, climb } = takeoffRun(frame, g.zone, g.slot, g.slots);
      const u = clamp01(g.phaseTick / Math.max(1, g.takeoffTicks));
      if (u < TAXI_SHARE) return flight(lerp(stand, start, smooth(u / TAXI_SHARE)), 0);
      const v = (u - TAXI_SHARE) / (1 - TAXI_SHARE);
      return flight(lerp(start, end, Math.pow(v, 1.4)), climb * smooth((v - LIFTOFF) / (1 - LIFTOFF)));
    }
    case 'transit': {
      if (!g.track.exiting) return flight({ ...g.pos }, 1);
      const { end, climb, exit } = takeoffRun(frame, g.zone, g.slot, g.slots);
      if (exit < 1e-6) return flight({ ...g.pos }, 1);
      const q = smooth(dist(g.pos, home) / exit);
      return flight(add(g.pos, mul(sub(end, home), 1 - q)), climb + (1 - climb) * q);
    }
    case 'return': {
      const d = dist(g.pos, home);
      const D = Math.min(APPROACH_DIST, g.track.approachDist);
      if (D < 1e-6) return flight({ ...g.pos }, d < 1e-6 ? 0 : 1);
      const k = clamp01(d / D);
      const aligned = add(home, mul(dir, g.track.side * d));
      return flight(lerp(g.pos, aligned, smooth(1 - k)), smooth(k));
    }
    case 'rearm': {
      const rollDir = -g.track.side as 1 | -1;
      const stop = add(home, mul(dir, rollDir * Math.min(ROLLOUT_DIST, runwayAhead(frame, rollDir))));
      const u = clamp01(g.phaseTick / Math.max(1, g.rearmTicks));
      if (u < ROLLOUT_SHARE) {
        const k = u / ROLLOUT_SHARE;
        return flight(lerp(home, stop, 1 - (1 - k) * (1 - k)), 0);
      }
      return flight(lerp(stop, stand, smooth((u - ROLLOUT_SHARE) / (TAXI_BACK_END - ROLLOUT_SHARE))), 0);
    }
    default:
      return flight({ ...g.pos }, 1);
  }
}

/**
 * Разбег взлёта: с торца полосы, противоположного зоне, до точки схода с полосы.
 * Если зона близко к аэродрому, разбег и набор высоты укорачиваются (exit — длина участка стыковки с перелётом).
 */
function takeoffRun(frame: RunwayFrame, zone: Vec2, slot: number, slots: number): { start: Vec2; end: Vec2; climb: number; exit: number } {
  const { home, dir } = frame;
  const n = Math.max(1, slots);
  const lane = mul({ x: -dir.y, y: dir.x }, n > 1 ? (slot - (n - 1) / 2) * Math.min(LANE_SPACING, 0.76 / (n - 1)) : 0);
  const side = sideOf(frame, sub(zone, home));
  const exit = Math.min(EXIT_DIST, dist(zone, home));
  const k = exit / EXIT_DIST;
  return {
    start: add(add(side > 0 ? frame.neg : frame.pos, mul(dir, side * Math.min(slot * START_STAGGER, runwayAhead(frame, side) * 0.5))), lane),
    end: add(add(home, mul(dir, side * runwayAhead(frame, side) * k)), mul(lane, k)),
    climb: 1 - 0.5 * k,
    exit,
  };
}

/** Точка лежит на полосе (в пределах её ширины и длины). */
export function onRunway(frame: RunwayFrame, p: Vec2, eps = 1e-6): boolean {
  const rel = sub(p, frame.neg);
  const length = dist(frame.neg, frame.pos);
  const along = dot(rel, frame.dir);
  const across = Math.abs(rel.x * frame.dir.y - rel.y * frame.dir.x);
  return along >= -eps && along <= length + eps && across <= frame.halfWidth + eps;
}
