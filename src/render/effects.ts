import type { SimEvent } from '../sim';

/**
 * Чистое отображение «событие снапшота -> визуальный эффект». Без three: сцена только исполняет описания.
 * События, которых здесь нет (bought, income, upgrade, sell...), молча игнорируются.
 */

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export type EffectSpec =
  /** Трассер выстрела от юнита к цели. */
  | { kind: 'tracer'; from: Vec3; to: Vec3; ttl: number; color: number }
  /** Расширяющаяся вспышка: попадание, взрыв, удар по базе. */
  | { kind: 'burst'; at: Vec3; ttl: number; color: number; radius: number };

export interface EffectContext {
  /** Позиция юнита по id (мир), если известна. */
  unitPos(id: number): Vec3 | undefined;
  /** Позиция врага по id в момент до удаления из снапшота. */
  enemyPos(id: number): Vec3 | undefined;
  basePos: Vec3;
}

export interface EffectPlan {
  effects: EffectSpec[];
  /** Юниты, сделавшие выстрел (для отдачи). */
  fired: number[];
  /** Враги, убитые в этом пакете событий (анимация гибели). */
  killed: number[];
  /** Враги, прорвавшиеся к базе. */
  leaked: number[];
}

export const EFFECT_COLORS = { tracer: 0xffe27a, hit: 0xffb347, kill: 0xff6a3d, leak: 0xff3b3b } as const;

export function planEffects(events: readonly SimEvent[], ctx: EffectContext): EffectPlan {
  const plan: EffectPlan = { effects: [], fired: [], killed: [], leaked: [] };
  for (const ev of events) {
    switch (ev.type) {
      case 'shot': {
        const from = ctx.unitPos(ev.unit);
        const to = ctx.enemyPos(ev.enemy);
        plan.fired.push(ev.unit);
        if (from && to) {
          plan.effects.push({ kind: 'tracer', from, to, ttl: 200, color: EFFECT_COLORS.tracer });
          plan.effects.push({ kind: 'burst', at: to, ttl: 220, color: EFFECT_COLORS.hit, radius: 0.22 });
        }
        break;
      }
      case 'kill': {
        const at = ctx.enemyPos(ev.enemy);
        plan.killed.push(ev.enemy);
        if (at) plan.effects.push({ kind: 'burst', at, ttl: 380, color: EFFECT_COLORS.kill, radius: 0.7 });
        break;
      }
      case 'leak':
        plan.leaked.push(ev.enemy);
        plan.effects.push({ kind: 'burst', at: ctx.basePos, ttl: 520, color: EFFECT_COLORS.leak, radius: 1.0 });
        break;
      default:
        break;
    }
  }
  return plan;
}

/** Доля жизни эффекта 0..1 или null, если он уже истёк. */
export function effectProgress(start: number, ttl: number, now: number): number | null {
  if (ttl <= 0) return null;
  const k = (now - start) / ttl;
  return k >= 1 ? null : Math.max(0, k);
}

/** Масштаб погибающего врага: 1 -> 0 (с лёгким «всплеском» в начале). */
export function dyingScale(progress: number): number {
  const k = Math.max(0, Math.min(1, progress));
  return (1 - k) * (1 - k);
}

/** Масштаб юнита при выстреле: короткий импульс 1 -> 1.18 -> 1. */
export function recoilScale(progress: number): number {
  const k = Math.max(0, Math.min(1, progress));
  return 1 + 0.18 * Math.sin(Math.PI * k);
}
