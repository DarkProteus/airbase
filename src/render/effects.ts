import type { ShotKind, SimEvent } from '../sim';

/**
 * Чистое отображение «событие снапшота -> визуальные эффекты». Без three: сцена только исполняет описания.
 * Эффекты — данные: вид выстрела берётся из оружия группы (`WeaponConfig.shot`), размер взрыва — из прочности
 * и масштаба врага; id групп и врагов нигде не читаются. Случайности нет: «разброс» осколков — детерминированная функция индекса.
 * События, которых здесь нет (income, sortieDone, zoneSet...), молча игнорируются.
 */

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

interface Timed {
  /** Время жизни, мс. */
  ttl: number;
  /** Через сколько мс после появления плана эффект начинается (прилёт снаряда, очередь). */
  delay?: number;
  color: number;
}

export type EffectSpec =
  /** Короткий светящийся штрих, летящий от группы к цели (очередь пушки). */
  | ({ kind: 'tracer'; from: Vec3; to: Vec3 } & Timed)
  /** Ракета: тело летит с ускорением от группы к цели, дымный след — отдельные `smoke`. */
  | ({ kind: 'missile'; from: Vec3; to: Vec3 } & Timed)
  /** Расширяющаяся вспышка: дульная, попадание, огненный шар. */
  | ({ kind: 'burst'; at: Vec3; radius: number } & Timed)
  /** Ударная волна: расширяющееся кольцо в горизонтальной плоскости. */
  | ({ kind: 'ring'; at: Vec3; radius: number } & Timed)
  /** Клуб дыма: растёт, поднимается и тает. */
  | ({ kind: 'smoke'; at: Vec3; radius: number } & Timed)
  /** Осколок или искра: летит по баллистической дуге из `at` со скоростью `vel` (клеток/с). */
  | ({ kind: 'debris'; at: Vec3; vel: Vec3; size: number } & Timed);

export type EffectKind = EffectSpec['kind'];

export interface EffectContext {
  /** Позиция группы по id (мир), если известна. */
  groupPos(id: number): Vec3 | undefined;
  /** Позиция врага по id в момент до удаления из снапшота. */
  enemyPos(id: number): Vec3 | undefined;
  basePos: Vec3;
  /** Цвет трассера группы (цвет из конфига); без него — общий. */
  groupColor?(id: number): number | undefined;
  /** Вид выстрела группы по врагу с таким уроном (оружие из конфига); без него — пушка. */
  shotKind?(group: number, enemy: number, damage: number): ShotKind | undefined;
  /** Габарит взрыва врага (см. `blastSize`); без него — 1. */
  enemySize?(id: number): number | undefined;
}

export interface EffectPlan {
  effects: EffectSpec[];
  /** Группы, сделавшие выстрел (для отдачи). */
  fired: number[];
  /** Враги, получившие попадание (для встряски фигурки). */
  hit: number[];
  /** Враги, убитые в этом пакете событий (анимация гибели). */
  killed: number[];
  /** Враги, прорвавшиеся к базе. */
  leaked: number[];
}

export const EFFECT_COLORS = {
  tracer: 0xffe27a,
  hit: 0xffb347,
  kill: 0xff6a3d,
  leak: 0xff3b3b,
  flash: 0xfff2c0,
  smoke: 0x6b7078,
  smokeDark: 0x3a3e45,
  spark: 0xffd27a,
  debris: [0x2d3138, 0xff8a3d],
  shockwave: 0xffc27a,
} as const;

/** Габарит взрыва врага: растёт с прочностью (логарифмически) и масштабом модели. Лёгкий дрон ~0,8, танк ~1,2, бомбардировщик ~2. */
export function blastSize(hp: number, scale = 1): number {
  return Math.max(0.3, scale) * (0.8 + 0.25 * Math.log10(Math.max(1, hp)));
}

// --- геометрия эффектов (чистая, общая для плана и сцены) ---

const lerp3 = (a: Vec3, b: Vec3, t: number): Vec3 => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t });
const dist3 = (a: Vec3, b: Vec3): number => Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
const frac = (x: number): number => x - Math.floor(x);

/** Доля пути ракеты при доле времени k: разгон. */
export const missilePath = (k: number): number => Math.max(0, Math.min(1, k)) ** 2;

/** Положение осколка через t секунд полёта: баллистическая дуга. */
export const GRAVITY = 7;
export function debrisAt(at: Vec3, vel: Vec3, t: number): Vec3 {
  return { x: at.x + vel.x * t, y: at.y + vel.y * t - 0.5 * GRAVITY * t * t, z: at.z + vel.z * t };
}

const GOLDEN = 2.399963;

/** Веер осколков вокруг точки: направления по золотому углу от seed, скорость и подъём зависят от индекса (без RNG). */
function scatter(at: Vec3, count: number, seed: number, speed: number, up: number, size: number, ttl: number, palette: readonly number[], delay = 0): EffectSpec[] {
  const out: EffectSpec[] = [];
  for (let i = 0; i < count; i++) {
    const a = seed * 1.7 + i * GOLDEN;
    const sp = speed * (0.55 + 0.45 * frac(i * 0.618 + seed * 0.31));
    out.push({
      kind: 'debris',
      at: { ...at },
      vel: { x: Math.cos(a) * sp, y: up * (0.6 + 0.6 * frac(i * 0.37 + seed * 0.13)), z: Math.sin(a) * sp },
      size: size * (0.7 + 0.6 * frac(i * 0.83 + seed * 0.21)),
      ttl,
      delay,
      color: palette[i % palette.length]!,
    });
  }
  return out;
}

/** Взрыв: вспышка, огненный шар, ударная волна, осколки и дым. size — из `blastSize`. */
export function explosion(at: Vec3, size: number, seed: number, fire: number = EFFECT_COLORS.kill): EffectSpec[] {
  const out: EffectSpec[] = [
    { kind: 'burst', at, radius: 0.6 * size, ttl: 150, color: EFFECT_COLORS.flash },
    { kind: 'burst', at, radius: 1.0 * size, ttl: 420, delay: 40, color: fire },
    { kind: 'ring', at, radius: 1.5 * size, ttl: 450, delay: 20, color: EFFECT_COLORS.shockwave },
    ...scatter(at, Math.round(5 + 3 * size), seed, 2.2 + 0.6 * size, 2.6, 0.07 + 0.05 * size, 650, EFFECT_COLORS.debris),
  ];
  for (let i = 0; i < 3; i++) {
    const a = seed + i * GOLDEN;
    out.push({
      kind: 'smoke',
      at: { x: at.x + Math.cos(a) * 0.25 * size, y: at.y + 0.1 * i, z: at.z + Math.sin(a) * 0.25 * size },
      radius: 0.45 * size,
      ttl: 900,
      delay: 120 + i * 90,
      color: i === 0 ? EFFECT_COLORS.smoke : EFFECT_COLORS.smokeDark,
    });
  }
  return out;
}

const GUN_BURST = [0, 55, 110];
const GUN_SPEED = 22; // клеток/с
const MISSILE_SPEED = 9;
const TRAIL_PUFFS = 6;

/** Выстрел: дульная вспышка, снаряд(ы) нужного вида, попадание (с задержкой прилёта). */
function shotEffects(kind: ShotKind, from: Vec3, to: Vec3, color: number, damage: number): EffectSpec[] {
  const out: EffectSpec[] = [];
  const d = dist3(from, to);
  const hitR = 0.2 + 0.25 * Math.min(1, damage / 50);
  if (kind === 'missile') {
    const ttl = Math.max(260, Math.min(700, (d * 1000) / MISSILE_SPEED));
    out.push({ kind: 'burst', at: from, radius: 0.28, ttl: 140, color: EFFECT_COLORS.flash });
    out.push({ kind: 'missile', from, to, ttl, color });
    for (let i = 0; i < TRAIL_PUFFS; i++) {
      const f = (i + 0.5) / (TRAIL_PUFFS + 0.5);
      // Ракета проходит долю f пути в момент k = sqrt(f) (см. missilePath).
      out.push({ kind: 'smoke', at: lerp3(from, to, f), radius: 0.17, ttl: 520, delay: ttl * Math.sqrt(f), color: EFFECT_COLORS.smoke });
    }
    out.push({ kind: 'burst', at: to, radius: hitR * 1.6, ttl: 260, delay: ttl, color: EFFECT_COLORS.hit });
    out.push({ kind: 'ring', at: to, radius: hitR * 2.2, ttl: 320, delay: ttl, color: EFFECT_COLORS.shockwave });
    out.push(...scatter(to, 5, damage, 1.8, 2, 0.06, 360, [EFFECT_COLORS.spark], ttl));
    out.push({ kind: 'smoke', at: to, radius: 0.4, ttl: 800, delay: ttl + 60, color: EFFECT_COLORS.smokeDark });
    return out;
  }
  // Пушка: очередь коротких трассеров с лёгким боковым разбросом, вспышка у ствола и искры у цели.
  const ttl = Math.max(90, Math.min(260, (d * 1000) / GUN_SPEED));
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const len = Math.hypot(dx, dz) || 1;
  const side = { x: -dz / len, z: dx / len };
  out.push({ kind: 'burst', at: from, radius: 0.16, ttl: 90, color: EFFECT_COLORS.flash });
  GUN_BURST.forEach((delay, i) => {
    const o = (i - 1) * 0.12;
    out.push({
      kind: 'tracer',
      from: { x: from.x + side.x * o * 0.4, y: from.y, z: from.z + side.z * o * 0.4 },
      to: { x: to.x + side.x * o, y: to.y, z: to.z + side.z * o },
      ttl,
      delay,
      color,
    });
  });
  GUN_BURST.forEach((delay) => out.push({ kind: 'burst', at: to, radius: hitR, ttl: 160, delay: delay + ttl * 0.9, color: EFFECT_COLORS.hit }));
  out.push(...scatter(to, 3, damage, 1.4, 1.6, 0.045, 260, [EFFECT_COLORS.spark], ttl));
  return out;
}

export function planEffects(events: readonly SimEvent[], ctx: EffectContext): EffectPlan {
  const plan: EffectPlan = { effects: [], fired: [], hit: [], killed: [], leaked: [] };
  for (const ev of events) {
    switch (ev.type) {
      case 'groupShot': {
        const from = ctx.groupPos(ev.group);
        const to = ctx.enemyPos(ev.enemy);
        plan.fired.push(ev.group);
        plan.hit.push(ev.enemy);
        if (from && to) {
          const kind = ctx.shotKind?.(ev.group, ev.enemy, ev.damage) ?? 'gun';
          plan.effects.push(...shotEffects(kind, from, to, ctx.groupColor?.(ev.group) ?? EFFECT_COLORS.tracer, ev.damage));
        }
        break;
      }
      case 'kill': {
        const at = ctx.enemyPos(ev.enemy);
        plan.killed.push(ev.enemy);
        if (at) plan.effects.push(...explosion(at, ctx.enemySize?.(ev.enemy) ?? 1, ev.enemy));
        break;
      }
      case 'leak':
        plan.leaked.push(ev.enemy);
        plan.effects.push(...explosion(ctx.basePos, 1 + 0.25 * Math.min(4, ev.damage), ev.enemy, EFFECT_COLORS.leak));
        break;
      default:
        break;
    }
  }
  return plan;
}

/** Приоритет эффекта при нехватке места: меньше — важнее (вспышки и снаряды читаются всегда, дым и осколки — по остатку). */
const PRIORITY: Record<EffectKind, number> = { burst: 0, tracer: 0, missile: 0, ring: 1, debris: 2, smoke: 3 };

/** Оставить не больше room эффектов, отбрасывая в первую очередь дым и осколки; порядок оставшихся сохраняется. */
export function trimEffects(specs: readonly EffectSpec[], room: number): EffectSpec[] {
  const r = Math.max(0, Math.floor(room));
  if (specs.length <= r) return [...specs];
  const keep = new Set<EffectSpec>();
  for (let p = 0; p <= 3 && keep.size < r; p++)
    for (const s of specs) {
      if (keep.size >= r) break;
      if (PRIORITY[s.kind] === p) keep.add(s);
    }
  return specs.filter((s) => keep.has(s));
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

/** Масштаб группы при выстреле: короткий импульс 1 -> 1.18 -> 1. */
export function recoilScale(progress: number): number {
  const k = Math.max(0, Math.min(1, progress));
  return 1 + 0.18 * Math.sin(Math.PI * k);
}
