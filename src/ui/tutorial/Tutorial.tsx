import { useEffect, useReducer } from 'react';
import { useGameStore } from '../../store/game';
import { initialTutorial, isFinished, observe, TUTORIAL_STEPS, tutorialStep } from './machine';
import type { TutorialInput, TutorialStep } from './machine';

interface PanelProps {
  step: TutorialStep;
  /** Номер шага с 1 и всего шагов. */
  index: number;
  total: number;
  last: boolean;
  onNext: () => void;
  onSkip: () => void;
}

/** Плашка подсказки: заголовок и текст шага, номер, «Далее»/«Готово» и «Пропустить». Универсальна: всё берёт из данных шага. */
export function TutorialPanel({ step, index, total, last, onNext, onSkip }: PanelProps) {
  return (
    <div className="tutorial panel panel-info" data-testid="tutorial" data-step={step.id} role="dialog" aria-label="Обучение">
      <div className="tutorial-head">
        <span className="tutorial-title">{step.title}</span>
        <span className="tutorial-count" data-testid="tutorial-count">
          {index}/{total}
        </span>
      </div>
      <p className="tutorial-text">{step.text}</p>
      <div className="tutorial-actions">
        <button type="button" className="btn btn-ghost tutorial-skip" data-testid="tutorial-skip" onClick={onSkip}>
          Пропустить
        </button>
        <button type="button" className="btn tutorial-next" data-testid="tutorial-next" onClick={onNext}>
          {last ? 'Готово' : 'Далее'}
        </button>
      </div>
    </div>
  );
}

/**
 * Обучение первого вылета поверх боя: ведёт автомат из machine.ts, читая снапшот и выбор группы из store.
 * Матч не трогает и не ставит на паузу. Когда обучение пройдено или пропущено, вызывает `onFinish` один раз.
 */
export function Tutorial({ onFinish }: { onFinish: () => void }) {
  const [state, dispatch] = useReducer((s: ReturnType<typeof tutorialStep>, i: TutorialInput) => tutorialStep(s, i), initialTutorial);
  const snapshot = useGameStore((st) => st.snapshot);
  const selected = useGameStore((st) => st.selectedGroup);

  useEffect(() => {
    if (snapshot) dispatch({ type: 'signals', signals: observe(snapshot, selected), tick: snapshot.tick });
  }, [snapshot, selected]);

  const finished = isFinished(state);
  useEffect(() => {
    if (finished) onFinish();
  }, [finished, onFinish]);

  if (state.status !== 'active') return null;
  const step = TUTORIAL_STEPS[state.step]!;
  const tick = snapshot?.tick ?? 0;
  return (
    <TutorialPanel
      step={step}
      index={state.step + 1}
      total={TUTORIAL_STEPS.length}
      last={state.step === TUTORIAL_STEPS.length - 1}
      onNext={() => dispatch({ type: 'next', tick })}
      onSkip={() => dispatch({ type: 'skip' })}
    />
  );
}
