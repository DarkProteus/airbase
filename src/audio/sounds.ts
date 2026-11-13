import type { SimEvent } from '../sim';

/** Чистая логика звука: событие снапшота -> id звука, троттлинг, описания голосов (данные). Без AudioContext. */

export type SoundId = 'shot' | 'kill' | 'baseHit' | 'wave';

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

/** Всплеск шума (низкочастотный фильтр): взрывы и удары. */
export interface NoiseBurst {
  at: number;
  duration: number;
  gain: number;
  /** Срез фильтра, Гц. */
  cutoff: number;
}

export interface Voice {
  notes: Note[];
  noise?: NoiseBurst;
  /** Минимальный интервал между воспроизведениями этого звука, мс (троттлинг частых звуков). */
  minInterval: number;
}

export const VOICES: Record<SoundId, Voice> = {
  shot: { minInterval: 70, notes: [{ wave: 'square', from: 900, to: 260, at: 0, duration: 0.09, gain: 0.07 }] },
  kill: {
    minInterval: 90,
    notes: [{ wave: 'sawtooth', from: 220, to: 55, at: 0, duration: 0.28, gain: 0.12 }],
    noise: { at: 0, duration: 0.22, gain: 0.16, cutoff: 1800 },
  },
  baseHit: {
    minInterval: 250,
    notes: [
      { wave: 'sawtooth', from: 150, to: 60, at: 0, duration: 0.45, gain: 0.22 },
      { wave: 'square', from: 110, to: 45, at: 0.04, duration: 0.4, gain: 0.12 },
    ],
    noise: { at: 0, duration: 0.35, gain: 0.2, cutoff: 700 },
  },
  wave: {
    minInterval: 600,
    notes: [
      { wave: 'triangle', from: 330, to: 330, at: 0, duration: 0.18, gain: 0.16 },
      { wave: 'triangle', from: 495, to: 495, at: 0.18, duration: 0.18, gain: 0.16 },
      { wave: 'triangle', from: 660, to: 660, at: 0.36, duration: 0.3, gain: 0.16 },
    ],
  },
};

/** Какие звуки порождает пакет событий: по одному на тип, в порядке первого появления. Неизвестные события игнорируются. */
export function soundsForEvents(events: readonly SimEvent[]): SoundId[] {
  const out: SoundId[] = [];
  const add = (id: SoundId) => {
    if (!out.includes(id)) out.push(id);
  };
  for (const ev of events) {
    switch (ev.type) {
      case 'groupShot':
        add('shot');
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

/** Итог для пакета событий: что реально играть с учётом mute и троттлинга (при mute троттлер не расходуется). */
export function pickSounds(
  events: readonly SimEvent[],
  muted: boolean,
  allow: (id: SoundId, nowMs: number) => boolean,
  nowMs: number,
): SoundId[] {
  if (muted) return [];
  return soundsForEvents(events).filter((id) => allow(id, nowMs));
}
