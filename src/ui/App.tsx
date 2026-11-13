import { SoundToggle } from '../audio';
import { MISSIONS } from '../content';
import { GameView } from './game/GameView';
import { Hud } from './game/Hud';
import './game/game.css';

const MISSION = MISSIONS.sortie!;

export function App() {
  return (
    <div className="game-root">
      <GameView mission={MISSION} />
      <Hud mission={MISSION} />
      <SoundToggle />
    </div>
  );
}
