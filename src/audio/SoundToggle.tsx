import { useEffect } from 'react';
import type { MissionConfig } from '../sim';
import { attachGameSound } from './attach';
import { useAudioStore } from './state';
import { unlockAudio } from './synth';
import './audio.css';

/** Кнопка mute + подписка на игровые события: достаточно вставить <SoundToggle /> один раз; миссия нужна для тревоги перед волной. */
export function SoundToggle({ mission }: { mission?: MissionConfig }) {
  const muted = useAudioStore((s) => s.muted);
  const setMuted = useAudioStore((s) => s.setMuted);
  useEffect(() => attachGameSound(mission), [mission]);
  return (
    <button
      type="button"
      className="btn sound-toggle"
      aria-pressed={muted}
      aria-label={muted ? 'Включить звук' : 'Выключить звук'}
      onClick={() => {
        unlockAudio();
        setMuted(!muted);
      }}
    >
      Звук: {muted ? 'выкл' : 'вкл'}
    </button>
  );
}
