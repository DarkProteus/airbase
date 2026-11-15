import { describe, expect, test } from 'vitest';
import type { SortiePhase, Vec2 } from '../sim';
import { EXIT_DIST, groupPose, initialTrack, nextTrack, onRunway, runwayFrame, sideOf, standOf } from './flight';
import type { FlightTrack, PoseInput, RunwayFrame } from './flight';

const size = { w: 13, h: 11 };
// Аэродромы у разных краёв карты: полоса и площадка считаются из той же раскладки, что рисует окружение.
const FIELDS: Vec2[] = [{ x: 12, y: 1 }, { x: 0, y: 5 }, { x: 4, y: 0 }, { x: 8, y: 10 }];
const frames: RunwayFrame[] = FIELDS.map((airfield) => runwayFrame({ size, airfield }));

const dist = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.y - b.y);
const base = (frame: RunwayFrame, over: Partial<PoseInput>): PoseInput => ({
  phase: 'takeoff',
  phaseTick: 0,
  pos: { ...frame.home },
  zone: { x: 5, y: 5 },
  takeoffTicks: 60,
  rearmTicks: 150,
  slot: 0,
  slots: 3,
  track: initialTrack(),
  ...over,
});
const pose = (frame: RunwayFrame, over: Partial<PoseInput>) => groupPose(frame, base(frame, over));
/** Взлетевшая группа: память рендера знает, что она вышла со взлёта. */
const exiting: FlightTrack = { ...initialTrack(), exiting: true };
/** Зона по другую сторону полосы относительно ближайшего к ней края. */
const zonesFor = (f: RunwayFrame): Vec2[] => [
  { x: f.home.x + f.dir.x * 6, y: f.home.y + f.dir.y * 6 },
  { x: f.home.x - f.dir.x * 6, y: f.home.y - f.dir.y * 6 },
  { x: f.home.x + f.dir.x * 0.8, y: f.home.y + f.dir.y * 0.8 },
  { ...f.home },
];

describe('раскладка полосы', () => {
  test('аэродром лежит на полосе, концы полосы — по оси, стоянка рядом с полосой, но не на ней', () => {
    for (const f of frames) {
      expect(onRunway(f, f.home)).toBe(true);
      expect(onRunway(f, f.neg)).toBe(true);
      expect(onRunway(f, f.pos)).toBe(true);
      expect(Math.hypot(f.dir.x, f.dir.y)).toBeCloseTo(1, 9);
      expect(onRunway(f, f.apron)).toBe(false);
    }
  });

  test('стоянки разных групп не совпадают и детерминированы', () => {
    for (const f of frames) {
      const stands = [0, 1, 2].map((i) => standOf(f, i, 3));
      expect(dist(stands[0]!, stands[1]!)).toBeGreaterThan(0.4);
      expect(dist(stands[1]!, stands[2]!)).toBeGreaterThan(0.4);
      expect(standOf(f, 1, 3)).toEqual(stands[1]);
      expect(onRunway(f, stands[1]!)).toBe(false);
    }
  });
});

describe('взлёт', () => {
  test('в начале фазы группа стоит на своей стоянке на земле', () => {
    for (const f of frames) {
      const p = pose(f, { phaseTick: 0, slot: 2 });
      expect(p.at).toEqual(standOf(f, 2, 3));
      expect(p.lift).toBe(0);
    }
  });

  test('разбег идёт по полосе, на земле до отрыва, высота растёт только после него', () => {
    for (const f of frames)
      for (const zone of zonesFor(f)) {
        let prevLift = 0;
        for (let t = 0; t <= 60; t++) {
          const p = pose(f, { phaseTick: t, zone, slot: t % 3 });
          if (t / 60 >= 0.3) expect(onRunway(f, p.at)).toBe(true);
          expect(p.lift).toBeGreaterThanOrEqual(prevLift - 1e-9);
          prevLift = p.lift;
        }
        expect(pose(f, { phaseTick: 18 * 1, zone }).lift).toBe(0);
        expect(pose(f, { phaseTick: 60, zone }).lift).toBeGreaterThan(0.4);
      }
  });

  test('конец взлёта стыкуется с началом перелёта: нет скачка позиции и высоты', () => {
    for (const f of frames)
      for (const zone of zonesFor(f)) {
        const a = pose(f, { phase: 'takeoff', phaseTick: 60, zone });
        const b = pose(f, { phase: 'transit', phaseTick: 0, zone, track: exiting });
        expect(dist(a.at, b.at)).toBeLessThan(1e-9);
        expect(b.lift).toBeCloseTo(a.lift, 9);
      }
  });

  test('перелёт плавно уходит от полосы к sim-позиции и поднимается на эшелон', () => {
    for (const f of frames) {
      const zone = zonesFor(f)[0]!;
      const toward = { x: zone.x - f.home.x, y: zone.y - f.home.y };
      const len = Math.hypot(toward.x, toward.y);
      let prev: Pose2 | undefined;
      for (let s = 0; s <= 3; s += 0.05) {
        const pos = { x: f.home.x + (toward.x / len) * s, y: f.home.y + (toward.y / len) * s };
        const p = pose(f, { phase: 'transit', pos, zone, track: exiting });
        if (prev) {
          expect(dist(p.at, prev.at)).toBeLessThan(0.4); // шаг по 0,05 клетки без скачков
          expect(p.lift).toBeGreaterThanOrEqual(prev.lift - 1e-9);
        }
        prev = p;
        if (s >= EXIT_DIST) {
          expect(dist(p.at, pos)).toBeLessThan(1e-9);
          expect(p.lift).toBeCloseTo(1, 9);
        }
      }
    }
  });

  test('зона у аэродрома: стыки на взлёте и у зоны тоже без скачков', () => {
    for (const f of frames)
      for (const zone of [{ x: f.home.x + f.dir.x * 0.8, y: f.home.y + f.dir.y * 0.8 }, { ...f.home }]) {
        const a = pose(f, { phase: 'takeoff', phaseTick: 60, zone });
        const b = pose(f, { phase: 'transit', phaseTick: 0, zone, track: exiting });
        expect(dist(a.at, b.at)).toBeLessThan(1e-9);
        expect(b.lift).toBeCloseTo(a.lift, 9);
        // перелёт закончился в зоне: поза совпадает с позицией sim, как и в патруле
        const c = pose(f, { phase: 'transit', zone, pos: zone, track: exiting });
        const d = pose(f, { phase: 'patrol', zone, pos: zone });
        expect(dist(c.at, d.at)).toBeLessThan(1e-9);
        expect(c.lift).toBeCloseTo(d.lift, 9);
      }
  });

  test('перелёт без взлёта (зону перенесли в патруле) позу не меняет', () => {
    const f = frames[0]!;
    const pos = { x: f.home.x - 0.5, y: f.home.y + 0.3 };
    const p = pose(f, { phase: 'transit', pos, track: initialTrack() });
    expect(p.at).toEqual(pos);
    expect(p.lift).toBe(1);
  });
});

describe('возврат и посадка', () => {
  const approachFrom = (f: RunwayFrame, from: Vec2): { track: FlightTrack; at: (d: number) => Vec2 } => {
    const track = nextTrack(f, initialTrack(), 'patrol', { phase: 'return', pos: from });
    const total = dist(from, f.home);
    return { track, at: (d) => ({ x: f.home.x + ((from.x - f.home.x) / total) * d, y: f.home.y + ((from.y - f.home.y) / total) * d }) };
  };
  const FROM: Vec2[] = [{ x: 5, y: 5 }, { x: 11, y: 8 }, { x: 2, y: 2 }, { x: 6, y: 0 }];

  test('начало возврата стыкуется с патрулём, касание — с точкой аэродрома на земле', () => {
    for (const f of frames)
      for (const from of FROM) {
        const { track } = approachFrom(f, from);
        const start = pose(f, { phase: 'return', pos: from, track });
        expect(dist(start.at, from)).toBeLessThan(1e-9);
        expect(start.lift).toBeCloseTo(1, 9);
        const land = pose(f, { phase: 'return', pos: f.home, track });
        expect(dist(land.at, f.home)).toBeLessThan(1e-9);
        expect(land.lift).toBe(0);
      }
  });

  test('конец возврата стыкуется с началом перезарядки (точка аэродрома, земля)', () => {
    for (const f of frames)
      for (const from of FROM) {
        const { track } = approachFrom(f, from);
        const a = pose(f, { phase: 'return', pos: f.home, track });
        const b = pose(f, { phase: 'rearm', phaseTick: 0, track });
        expect(dist(a.at, b.at)).toBeLessThan(1e-9);
        expect(b.lift).toBe(0);
      }
  });

  test('заход: высота не растёт по мере приближения, шаги малы, последний участок лежит на полосе', () => {
    for (const f of frames)
      for (const from of FROM) {
        const { track, at } = approachFrom(f, from);
        const total = dist(from, f.home);
        let prev: Pose2 | undefined;
        for (let d = total; d >= 0; d -= 0.05) {
          const p = pose(f, { phase: 'return', pos: at(d), track });
          if (prev) {
            expect(p.lift).toBeLessThanOrEqual(prev.lift + 1e-9);
            expect(dist(p.at, prev.at)).toBeLessThan(0.45);
          }
          if (d <= 0.3) expect(onRunway(f, p.at, 0.02)).toBe(true);
          prev = p;
        }
      }
  });

  test('пробег идёт по полосе, затем руление к стоянке; конец перезарядки = начало взлёта', () => {
    for (const f of frames)
      for (const from of FROM) {
        const { track } = approachFrom(f, from);
        const R = 150;
        for (let t = 0; t <= R; t++) {
          const p = pose(f, { phase: 'rearm', phaseTick: t, track, rearmTicks: R, slot: 1 });
          expect(p.lift).toBe(0);
          if (t / R <= 0.2) expect(onRunway(f, p.at)).toBe(true);
        }
        const end = pose(f, { phase: 'rearm', phaseTick: R, track, rearmTicks: R, slot: 1 });
        expect(dist(end.at, standOf(f, 1, 3))).toBeLessThan(1e-9);
        const takeoff = pose(f, { phase: 'takeoff', phaseTick: 0, slot: 1 });
        expect(dist(end.at, takeoff.at)).toBeLessThan(1e-9);
      }
  });

  test('сторона захода запоминается в начале возврата и не меняется до конца', () => {
    const f = frames[0]!;
    const t1 = nextTrack(f, initialTrack(), 'patrol', { phase: 'return', pos: { x: f.home.x + f.dir.x * 4, y: f.home.y + f.dir.y * 4 } });
    expect(t1.side).toBe(1);
    expect(t1.approachDist).toBeCloseTo(4, 9);
    const t2 = nextTrack(f, t1, 'return', { phase: 'return', pos: { x: f.home.x - f.dir.x, y: f.home.y - f.dir.y } });
    expect(t2).toEqual(t1);
    expect(sideOf(f, { x: -f.dir.x, y: -f.dir.y })).toBe(-1);
  });
});

describe('память вылета', () => {
  const f = frames[0]!;
  const phases: SortiePhase[] = ['takeoff', 'transit', 'patrol', 'return', 'rearm'];
  test('exiting включается на взлёте, держится в перелёте и сбрасывается в патруле', () => {
    let t = initialTrack();
    const seen: boolean[] = [];
    let prev: SortiePhase | undefined;
    for (const phase of phases) {
      t = nextTrack(f, t, prev, { phase, pos: { x: 5, y: 5 } });
      seen.push(t.exiting);
      prev = phase;
    }
    expect(seen).toEqual([true, true, false, false, false]);
  });
});

type Pose2 = ReturnType<typeof groupPose>;
