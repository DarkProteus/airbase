import { shotKindOf, shotWeapon } from '../render/effects';
import type { ShotKind, SimEvent, SimState, WeaponConfig } from '../sim';

/**
 * Чистая логика звука: событие снапшота -> id звука, троттлинг, описания голосов (данные). Без AudioContext.
 * Вид выстрела (пушка/ракета) берётся из конфига оружия группы — тем же правилом, что и в сцене (render/effects, без three).
 * Событий «попадание» в sim нет: выстрел наносит урон сразу, поэтому у каждого выстрела есть «ударная» часть,
 * а попадание по своей цели (прорыв врага) — отдельный звук baseHit.
 */

export type SoundId = 'gun' | 'missile' | 'kill' | 'baseHit' | 'waveAlert' | 'wave' | 'win' | 'lose';

/** Нота синтеза: осциллятор с экспоненциальным скольжением частоты и затуханием. */
export interface Note {
  wave: 'sine' | 'square' | 'sawtooth' | 'triangle';
  /** Частота в начале и в конце, Гц. */
  from: number;
  to: number;
  /** Смещение старта от момента воспроизведения, секунды. */
  at: number;
  duration: number;
  gain: number;
}

/** Всплеск шума через фильтр: выстрелы, взрывы и удары. */
export interface NoiseBurst {
  at: number;
  duration: number;
  gain: number;
  /** Тип фильтра; по умолчанию lowpass. */
  filter?: 'lowpass' | 'bandpass' | 'highpass';
  /** Частота фильтра, Гц, в начале и в конце (если `cutoffTo` задан — скользит: хвост взрыва темнеет). */
  cutoff: number;
  cutoffTo?: number;
}

export interface Voice {
  notes: Note[];
  noises?: NoiseBurst[];
  /** Минимальный интервал между воспроизведениями этого звука, мс (троттлинг частых звуков). */
  minInterval: number;
  /** Важный звук (исход, тревога): проигрывается даже при перегрузе голосов. */
  essential?: boolean;
}

export const VOICES: Record<SoundId, Voice> = {
  // Пушка: короткий сухой «пак» — шум полосой 2 кГц и щелчок квадрата.
  gun: {
    minInterval: 110,
    notes: [{ wave: 'square', from: 420, to: 110, at: 0, duration: 0.05, gain: 0.05 }],
    noises: [{ at: 0, duration: 0.05, gain: 0.1, filter: 'bandpass', cutoff: 2200 }],
  },
  // Ракета: шипящий старт со скольжением вверх, затем глухой удар о цель.
  missile: {
    minInterval: 320,
    notes: [
      { wave: 'sawtooth', from: 180, to: 520, at: 0, duration: 0.3, gain: 0.05 },
      { wave: 'sine', from: 95, to: 38, at: 0.22, duration: 0.3, gain: 0.16 },
    ],
    noises: [
      { at: 0, duration: 0.34, gain: 0.1, filter: 'bandpass', cutoff: 700, cutoffTo: 2600 },
      { at: 0.22, duration: 0.22, gain: 0.12, filter: 'lowpass', cutoff: 900 },
    ],
  },
  // Гибель врага: взрыв — яркий всплеск шума, темнеющий до низкого гула, и низкий «хвост».
  kill: {
    minInterval: 130,
    notes: [
      { wave: 'sine', from: 120, to: 32, at: 0, duration: 0.7, gain: 0.26 },
      { wave: 'sawtooth', from: 260, to: 70, at: 0, duration: 0.16, gain: 0.07 },
    ],
    noises: [{ at: 0, duration: 0.55, gain: 0.26, filter: 'lowpass', cutoff: 3200, cutoffTo: 160 }],
  },
  // Попадание по нашей цели: глухой удар с металлическим звоном.
  baseHit: {
    minInterval: 250,
    notes: [
      { wave: 'sawtooth', from: 150, to: 60, at: 0, duration: 0.45, gain: 0.2 },
      { wave: 'square', from: 880, to: 700, at: 0, duration: 0.18, gain: 0.05 },
      { wave: 'square', from: 1180, to: 1000, at: 0.02, duration: 0.14, gain: 0.03 },
    ],
    noises: [{ at: 0, duration: 0.35, gain: 0.2, filter: 'lowpass', cutoff: 700 }],
  },
  // Тревога перед волной: три частых резких сигнала.
  waveAlert: {
    minInterval: 1500,
    essential: true,
    notes: [0, 0.16, 0.32].map((at) => ({ wave: 'square' as const, from: 1040, to: 1040, at, duration: 0.09, gain: 0.07 })),
  },
  // Старт волны: низкая сирена вверх-вниз.
  wave: {
    minInterval: 600,
    essential: true,
    notes: [
      { wave: 'sawtooth', from: 280, to: 520, at: 0, duration: 0.42, gain: 0.09 },
      { wave: 'sawtooth', from: 520, to: 280, at: 0.42, duration: 0.42, gain: 0.09 },
      { wave: 'sine', from: 140, to: 140, at: 0, duration: 0.84, gain: 0.12 },
    ],
  },
  // Победа: восходящий мажорный аккорд-арпеджио, звонкий тембр.
  win: {
    minInterval: 5000,
    essential: true,
    notes: [
      { wave: 'triangle', from: 523, to: 523, at: 0, duration: 0.22, gain: 0.16 },
      { wave: 'triangle', from: 659, to: 659, at: 0.14, duration: 0.22, gain: 0.16 },
      { wave: 'triangle', from: 784, to: 784, at: 0.28, duration: 0.22, gain: 0.16 },
      { wave: 'triangle', from: 1047, to: 1047, at: 0.42, duration: 0.9, gain: 0.18 },
      { wave: 'sine', from: 2093, to: 2093, at: 0.42, duration: 0.7, gain: 0.04 },
    ],
  },
  // Поражение: нисходящая минорная линия, тусклый тембр и падающий гул.
  lose: {
    minInterval: 5000,
    essential: true,
    notes: [
      { wave: 'sawtooth', from: 392, to: 392, at: 0, duration: 0.3, gain: 0.08 },
      { wave: 'sawtooth', from: 311, to: 311, at: 0.3, duration: 0.3, gain: 0.08 },
      { wave: 'sawtooth', from: 262, to: 247, at: 0.6, duration: 0.3, gain: 0.08 },
      { wave: 'sawtooth', from: 196, to: 70, at: 0.9, duration: 1.1, gain: 0.1 },
      { wave: 'sine', from: 98, to: 36, at: 0.9, duration: 1.2, gain: 0.2 },
    ],
  },
};

/** За сколько секунд до старта волны звучит тревога. */
export const WAVE_ALERT_SECONDS = 3;

/** Вид выстрела по событию (пушка/ракета); undefined — вид неизвестен, звучит пушка. */
export type ShotResolver = (ev: Extract<SimEvent, { type: 'groupShot' }>) => ShotKind | undefined;

/** Вид выстрела по оружию группы и тегам цели; без подходящего оружия — undefined. */
export function shotKindFor(weapons: readonly WeaponConfig[], enemyTags: readonly string[], damage: number): ShotKind | undefined {
  const weapon = shotWeapon(weapons, enemyTags, damage);
  return weapon && shotKindOf(weapon);
}

/** Какие звуки порождает пакет событий: по одному на id, в порядке первого появления. Неизвестные события игнорируются. */
export function soundsForEvents(events: readonly SimEvent[], shotKind?: ShotResolver): SoundId[] {
  const out: SoundId[] = [];
  const add = (id: SoundId) => {
    if (!out.includes(id)) out.push(id);
  };
  for (const ev of events) {
    switch (ev.type) {
      case 'groupShot':
        add(shotKind?.(ev) === 'missile' ? 'missile' : 'gun');
        break;
      case 'kill':
        add('kill');
        break;
      case 'leak':
        add('baseHit');
        break;
      case 'waveStart':
        add('wave');
        break;
      default:
        break;
    }
  }
  return out;
}

/** Звук исхода миссии по статусу матча; идущий матч — без звука. */
export function outcomeSound(status: SimState['status']): SoundId | null {
  return status === 'won' ? 'win' : status === 'lost' ? 'lose' : null;
}

/**
 * Пора ли играть тревогу перед волной: до старта осталось не больше WAVE_ALERT_SECONDS и для этой волны ещё не играли.
 * `seconds` — из предупреждения о волне (null — ждём зачистки, таймера нет), `wave` — её номер, `alertedWave` — номер волны с последней тревогой.
 */
export function waveAlertDue(seconds: number | null, wave: number, alertedWave: number): boolean {
  return seconds !== null && seconds <= WAVE_ALERT_SECONDS && wave !== alertedWave;
}

/** Троттлер: пускает звук, только если с прошлого воспроизведения прошло minInterval мс. */
export function createThrottle(voices: Record<SoundId, Pick<Voice, 'minInterval'>> = VOICES) {
  const lastAt = new Map<SoundId, number>();
  return (id: SoundId, nowMs: number): boolean => {
    const prev = lastAt.get(id);
    if (prev !== undefined && nowMs - prev < voices[id].minInterval) return false;
    lastAt.set(id, nowMs);
    return true;
  };
}

/** Итог для пакета событий: что реально играть с учётом mute и троттлинга (при mute троттлер не расходуется). `extra` — звуки не из событий (тревога, исход). */
export function pickSounds(
  events: readonly SimEvent[],
  muted: boolean,
  allow: (id: SoundId, nowMs: number) => boolean,
  nowMs: number,
  opts: { shotKind?: ShotResolver; extra?: readonly SoundId[] } = {},
): SoundId[] {
  if (muted) return [];
  const ids = [...new Set([...soundsForEvents(events, opts.shotKind), ...(opts.extra ?? [])])];
  return ids.filter((id) => allow(id, nowMs));
}
