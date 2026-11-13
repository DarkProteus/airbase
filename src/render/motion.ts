/** Чистая интерполяция между тиками sim: рендер плавно доезжает до позиции нового снапшота. */

export interface Tween {
  from: number;
  to: number;
  /** Время начала, мс (часы рендера). */
  start: number;
  /** Длительность, мс. */
  duration: number;
}

/** Значение твина в момент now: линейно, с зажимом по краям; нулевая длительность — сразу конец. */
export function tweenValue(t: Tween, now: number): number {
  if (t.duration <= 0) return t.to;
  const k = Math.max(0, Math.min(1, (now - t.start) / t.duration));
  return t.from + (t.to - t.from) * k;
}

/** Новый твин к значению to: стартует с того, что сейчас показано (без скачка). */
export function retarget(prev: Tween | undefined, to: number, now: number, duration: number): Tween {
  const from = prev ? tweenValue(prev, now) : to;
  return { from, to, start: now, duration };
}

/** Длительность твина для снапшота, ушедшего вперёд на ticks тиков: ровно столько реального времени. */
export function tweenDuration(ticks: number, dtSeconds: number): number {
  return Math.max(0, ticks) * dtSeconds * 1000;
}
