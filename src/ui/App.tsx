import { useState } from 'react';
import { SoundToggle } from '../audio';
import { DEFAULT_LINEUP, DEFAULT_ZONES, LINEUP_SIZE, MISSIONS, START_PROFILE } from '../content';
import { profileLineup, sortieRejection } from '../sim';
import type { LineupEntry, Profile } from '../sim';
import { useProfileStore } from '../store/profile';
import { BaseScreen } from './base/BaseScreen';
import { GameView } from './game/GameView';
import { Hud } from './game/Hud';
import './game/game.css';

/** Миссия по умолчанию; до экрана выбора (TASK-17) другую можно открыть параметром адреса `?mission=<id>`. */
const MISSION_ID = new URLSearchParams(location.search).get('mission') ?? '';
const MISSION = MISSIONS[MISSION_ID] ?? MISSIONS.evac!;

/** Состав профиля, если он полон; иначе — состав по умолчанию (dev-шорткат `?mission=`). */
const lineupFor = (profile: Profile): LineupEntry[] =>
  sortieRejection(profile, LINEUP_SIZE) ? DEFAULT_LINEUP : profileLineup(profile, DEFAULT_ZONES);

export function App() {
  // До потока экранов (TASK-17): база или бой с фиксированным составом; `?mission=<id>` сразу открывает бой.
  const [lineup, setLineup] = useState<LineupEntry[] | null>(() =>
    MISSIONS[MISSION_ID] ? lineupFor(useProfileStore.getState().profile ?? START_PROFILE) : null,
  );
  if (!lineup) return <BaseScreen onSortie={(profile) => setLineup(lineupFor(profile))} />;
  return (
    <div className="game-root">
      <GameView mission={MISSION} lineup={lineup} />
      <Hud mission={MISSION} />
      <SoundToggle />
    </div>
  );
}
