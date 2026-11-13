import type { Vec2 } from './types';

export interface PathData {
  points: Vec2[];
  /** Накопленная длина до каждой точки. */
  cum: number[];
  length: number;
}

export function buildPath(points: Vec2[]): PathData {
  if (points.length < 2) throw new Error('path needs at least 2 points');
  const cum = [0];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    cum.push(cum[i - 1]! + Math.hypot(b.x - a.x, b.y - a.y));
  }
  return { points, cum, length: cum[cum.length - 1]! };
}

export function pointAt(path: PathData, dist: number): Vec2 {
  const d = Math.min(Math.max(dist, 0), path.length);
  let i = 1;
  while (i < path.cum.length - 1 && path.cum[i]! < d) i++;
  const a = path.points[i - 1]!;
  const b = path.points[i]!;
  const seg = path.cum[i]! - path.cum[i - 1]!;
  const t = seg === 0 ? 0 : (d - path.cum[i - 1]!) / seg;
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}
