import { VOICES } from './sounds';
import type { SoundId } from './sounds';

/** WebAudio-синтез без ассетов: исполняет описания VOICES. Единственное место, где есть AudioContext. */

const MASTER_GAIN = 0.5;
/** Одновременно звучащих источников не больше: в густом бою лишние обычные звуки отбрасываются, важные (тревога, исход) играют всегда. */
const MAX_ACTIVE_SOURCES = 28;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;
let active = 0;

/** Создать/возобновить контекст. Вызывать из обработчика пользовательского жеста. */
export function unlockAudio(): void {
  try {
    if (!ctx) {
      const Ctor: typeof AudioContext | undefined =
        globalThis.AudioContext ?? (globalThis as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      ctx = new Ctor();
      // Общий предел громкости: компрессор-лимитер перед выходом не даёт очереди и взрывам складываться в клиппинг.
      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -16;
      limiter.knee.value = 8;
      limiter.ratio.value = 12;
      limiter.attack.value = 0.003;
      limiter.release.value = 0.2;
      limiter.connect(ctx.destination);
      master = ctx.createGain();
      master.gain.value = MASTER_GAIN;
      master.connect(limiter);
    }
    if (ctx.state === 'suspended') void ctx.resume();
  } catch {
    ctx = null;
  }
}

export function audioReady(): boolean {
  return ctx !== null && ctx.state === 'running';
}

function noiseBuffer(c: AudioContext): AudioBuffer {
  if (!noiseBuf) {
    noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const d = noiseBuf.getChannelData(0);
    // Детерминированный шум (LCG): Math.random нам не нужен, а звук одинаков от запуска к запуску.
    let x = 12345;
    for (let i = 0; i < d.length; i++) {
      x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
      d[i] = x / 2147483648 - 1;
    }
  }
  return noiseBuf;
}

export function playVoice(id: SoundId): void {
  const c = ctx;
  const out = master;
  if (!c || !out || c.state !== 'running') return;
  const voice = VOICES[id];
  if (active >= MAX_ACTIVE_SOURCES && !voice.essential) return;
  const t0 = c.currentTime;
  const track = (src: AudioScheduledSourceNode) => {
    active++;
    src.onended = () => {
      active = Math.max(0, active - 1);
    };
  };
  for (const n of voice.notes) {
    const osc = c.createOscillator();
    const g = c.createGain();
    const s = t0 + n.at;
    osc.type = n.wave;
    osc.frequency.setValueAtTime(n.from, s);
    if (n.to !== n.from) osc.frequency.exponentialRampToValueAtTime(Math.max(1, n.to), s + n.duration);
    g.gain.setValueAtTime(n.gain, s);
    g.gain.exponentialRampToValueAtTime(0.0001, s + n.duration);
    osc.connect(g).connect(out);
    track(osc);
    osc.start(s);
    osc.stop(s + n.duration + 0.02);
  }
  for (const nz of voice.noises ?? []) {
    const src = c.createBufferSource();
    const f = c.createBiquadFilter();
    const g = c.createGain();
    const s = t0 + nz.at;
    src.buffer = noiseBuffer(c);
    f.type = nz.filter ?? 'lowpass';
    f.frequency.setValueAtTime(nz.cutoff, s);
    if (nz.cutoffTo !== undefined) f.frequency.exponentialRampToValueAtTime(Math.max(20, nz.cutoffTo), s + nz.duration);
    g.gain.setValueAtTime(nz.gain, s);
    g.gain.exponentialRampToValueAtTime(0.0001, s + nz.duration);
    src.connect(f).connect(g).connect(out);
    track(src);
    src.start(s);
    src.stop(s + nz.duration + 0.02);
  }
}
