import { SoundToggle } from '../audio';
import { MISSIONS } from '../content';
import { GameView } from './game/GameView';
import { Hud } from './game/Hud';
import './game/game.css';

/** Миссия по умолчанию; до экрана выбора (TASK-17) другую можно открыть параметром адреса `?mission=<id>`. */
const MISSION = MISSIONS[new URLSearchParams(location.search).get('mission') ?? ''] ?? MISSIONS.sortie!;

export function App() {
  return (
    <div className="game-root">
      <GameView mission={MISSION} />
      <Hud mission={MISSION} />
      <SoundToggle />
    </div>
  );
}
