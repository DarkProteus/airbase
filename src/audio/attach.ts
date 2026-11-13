import { useGameStore } from '../store/game';
import { useAudioStore } from './state';
import { createThrottle, pickSounds } from './sounds';
import { playVoice, unlockAudio } from './synth';

/**
 * Подписывает звук на снапшоты игры и на первый пользовательский жест (политика автоплея браузеров).
 * Возвращает функцию отписки. События берутся из snapshot.events (драйвер копит события всех шагов кадра).
 */
export function attachGameSound(): () => void {
  const allow = createThrottle();
  let lastTick = -1;

  const onGesture = () => unlockAudio();
  const gestures = ['pointerdown', 'keydown'] as const;
  for (const g of gestures) window.addEventListener(g, onGesture, { capture: true });

  const unsub = useGameStore.subscribe((s, prev) => {
    const snap = s.snapshot;
    if (!snap) {
      lastTick = -1;
      return;
    }
    if (snap === prev.snapshot || snap.tick <= lastTick) return;
    lastTick = snap.tick;
    for (const id of pickSounds(snap.events, useAudioStore.getState().muted, allow, performance.now())) playVoice(id);
  });

  return () => {
    unsub();
    for (const g of gestures) window.removeEventListener(g, onGesture, { capture: true });
  };
}
