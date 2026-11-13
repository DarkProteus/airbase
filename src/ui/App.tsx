import { MISSIONS } from '../content';
import { useGameStore } from '../store/game';
import { GameView } from './game/GameView';
import './game/game.css';

const MISSION = MISSIONS.sortie!;

export function App() {
  const s = useGameStore((st) => st.snapshot);
  return (
    <div className="game-root">
      <GameView mission={MISSION} />
      <div className="hud">
        AIRBASE · {MISSION.name}
        {s && (
          <>
            {' '}· $ {s.money} · жизни {s.lives} · волна {s.wave}/{MISSION.waves.length} ({s.phase}) · {s.status}
          </>
        )}
      </div>
    </div>
  );
}
