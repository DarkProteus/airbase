import { useEffect } from 'react';
import { SoundToggle } from '../audio';
import { GROUPS } from '../content';
import { useGameStore } from '../store/game';
import { BaseScreen } from './base/BaseScreen';
import { resetProgress, send, sortie, useFlow } from './flow';
import { GameView } from './game/GameView';
import { Hud } from './game/Hud';
import { ResultScreen } from './result/ResultScreen';
import { Tutorial } from './tutorial/Tutorial';
import './game/game.css';

const tutorialDone = () => send({ type: 'tutorialDone' });

/** Бой: когда матч закончился, поток переходит на итог; повторные вызовы эффекта безвредны (переход идемпотентен). */
function Battle({ flow }: { flow: Extract<ReturnType<typeof useFlow>, { screen: 'battle' }> }) {
  const final = useGameStore((s) => (s.snapshot && s.snapshot.status !== 'running' ? s.snapshot : null));
  // Вылет сыгран до конца — обучение больше не показываем, даже если его не дочитали.
  useEffect(() => {
    if (!final) return;
    send({ type: 'tutorialDone' });
    send({ type: 'finish', final });
  }, [final]);
  return (
    <div className="game-root">
      <GameView key={flow.seed} mission={flow.mission} lineup={flow.lineup} seed={flow.seed} />
      <Hud mission={flow.mission} />
      {!flow.profile.tutorialDone && <Tutorial key={`tutorial-${flow.seed}`} onFinish={tutorialDone} />}
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
      return <ResultScreen mission={flow.mission} result={flow.result} reward={flow.reward} currency={flow.profile.currency} groups={GROUPS} onHome={() => send({ type: 'home' })} />;
  }
}
