import { CONTENT } from '../content';
import type { MissionConfig } from '../sim';
import { useGameStore } from '../store/game';
import { waveWarning } from '../ui/game/markup';
import { useAudioStore } from './state';
import { createThrottle, outcomeSound, pickSounds, shotKindFor, waveAlertDue } from './sounds';
import type { ShotResolver, SoundId } from './sounds';
import { playVoice, unlockAudio } from './synth';

/**
 * Подписывает звук на снапшоты игры и на первый пользовательский жест (политика автоплея браузеров).
 * Возвращает функцию отписки. События берутся из snapshot.events (драйвер копит события всех шагов кадра);
 * тревога перед волной — из предупреждения о волне (только чтение, нужна миссия), исход — из статуса матча.
 */
export function attachGameSound(mission?: MissionConfig): () => void {
  const allow = createThrottle();
  let lastTick = -1;
  /** Теги врагов, виденных в снапшотах: убитый этим выстрелом враг уже не в списке, а вид выстрела по нему нужен. */
  const enemyTags = new Map<number, readonly string[]>();
  let alertedWave = -1;
  let finished = false;

  const onGesture = () => unlockAudio();
  const gestures = ['pointerdown', 'keydown'] as const;
  for (const g of gestures) window.addEventListener(g, onGesture, { capture: true });

  const unsub = useGameStore.subscribe((s, prev) => {
    const snap = s.snapshot;
    if (!snap) {
      lastTick = -1;
      alertedWave = -1;
      finished = false;
      enemyTags.clear();
      return;
    }
    if (snap === prev.snapshot || snap.tick <= lastTick) return;
    lastTick = snap.tick;
    for (const e of snap.enemies) if (!enemyTags.has(e.id)) enemyTags.set(e.id, CONTENT.enemies[e.type]?.tags ?? []);

    const shotKind: ShotResolver = (ev) => {
      const group = snap.groups.find((g) => g.id === ev.group);
      const weapons = group && CONTENT.groups[group.type]?.weapons;
      return weapons ? shotKindFor(weapons, enemyTags.get(ev.enemy) ?? [], ev.damage) : undefined;
    };

    const extra: SoundId[] = [];
    const warning = mission && waveWarning({ mission, content: CONTENT, state: snap });
    if (warning && waveAlertDue(warning.seconds, warning.wave, alertedWave)) {
      alertedWave = warning.wave;
      extra.push('waveAlert');
    }
    const outcome = outcomeSound(snap.status);
    if (outcome && !finished) {
      finished = true;
      extra.push(outcome);
    }
    for (const id of pickSounds(snap.events, useAudioStore.getState().muted, allow, performance.now(), { shotKind, extra })) playVoice(id);
  });

  return () => {
    unsub();
    for (const g of gestures) window.removeEventListener(g, onGesture, { capture: true });
  };
}
