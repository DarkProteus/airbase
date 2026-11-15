import { DEFAULT_ZONES, LINEUP_SIZE, MISSIONS, START_PROFILE } from '../content';
import { flowStep, initialFlow } from '../sim';
import type { Flow, FlowEvent } from '../sim';
import { useFlowStore } from '../store/flow';

const INITIAL: Flow = initialFlow(START_PROFILE);

/** Текущий поток экранов (до первого перехода — стартовый). */
export const useFlow = (): Flow => useFlowStore((s) => s.flow) ?? INITIAL;

/** Применить событие к потоку: решает чистая `flowStep`, недопустимое событие состояние не меняет. */
export function send(event: FlowEvent): void {
  const { flow, setFlow } = useFlowStore.getState();
  const current = flow ?? INITIAL;
  const next = flowStep(current, event);
  if (next !== current) setFlow(next);
}

/** Новый сид матча: в sim случайности нет, поэтому берём его здесь, на границе UI. */
export const newSeed = (): number => crypto.getRandomValues(new Uint32Array(1))[0]!;

/** Вылет на выбранную миссию с составом профиля. */
export function sortie(missionId: string): void {
  const mission = MISSIONS[missionId];
  if (mission) send({ type: 'sortie', mission, lineupSize: LINEUP_SIZE, zones: DEFAULT_ZONES, seed: newSeed() });
}
