import { useEffect } from 'react';
import { attachGameSound } from './attach';
import { useAudioStore } from './state';
import { unlockAudio } from './synth';
import './audio.css';

/** Кнопка mute + подписка на игровые события: достаточно вставить <SoundToggle /> один раз. */
export function SoundToggle() {
  const muted = useAudioStore((s) => s.muted);
  const setMuted = useAudioStore((s) => s.setMuted);
  useEffect(() => attachGameSound(), []);
  return (
    <button
      type="button"
      className="sound-toggle"
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
