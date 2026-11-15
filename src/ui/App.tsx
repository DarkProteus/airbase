import { useEffect } from 'react';
import { SoundToggle } from '../audio';
import { useGameStore } from '../store/game';
import { BaseScreen } from './base/BaseScreen';
import { resetProgress, send, sortie, useFlow } from './flow';
import { GameView } from './game/GameView';
import { Hud } from './game/Hud';
import { ResultScreen } from './result/ResultScreen';
import './game/game.css';

/** Бой: когда матч закончился, поток переходит на итог; повторные вызовы эффекта безвредны (переход идемпотентен). */
function Battle({ flow }: { flow: Extract<ReturnType<typeof useFlow>, { screen: 'battle' }> }) {
  const final = useGameStore((s) => (s.snapshot && s.snapshot.status !== 'running' ? s.snapshot : null));
  useEffect(() => {
    if (final) send({ type: 'finish', final });
  }, [final]);
  return (
    <div className="game-root">
      <GameView key={flow.seed} mission={flow.mission} lineup={flow.lineup} seed={flow.seed} />
      <Hud mission={flow.mission} />
      <SoundToggle />
    </div>
  );
}

/** Поток экранов: база -> бой -> итог -> база; состояние и переходы — в sim (flowStep), здесь только показ. */
export function App() {
  const flow = useFlow();
  switch (flow.screen) {
    case 'base':
      return <BaseScreen profile={flow.profile} onProfile={(profile) => send({ type: 'profile', profile })} onSortie={sortie} onReset={resetProgress} />;
    case 'battle':
      return <Battle flow={flow} />;
    case 'result':
      return <ResultScreen mission={flow.mission} result={flow.result} reward={flow.reward} currency={flow.profile.currency} onHome={() => send({ type: 'home' })} />;
  }
}
