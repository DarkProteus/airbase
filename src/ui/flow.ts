import { CAMPAIGN, DEFAULT_ZONES, LINEUP_SIZE, MISSIONS, START_PROFILE } from '../content';
import { flowStep, initialFlow } from '../sim';
import type { Flow, FlowEvent } from '../sim';
import { useFlowStore } from '../store/flow';
import { loadProfile, saveProfile } from './save';

/** Стартовый поток: профиль из сохранения, а при его отсутствии или порче — стартовый из контента. */
const INITIAL: Flow = initialFlow(loadProfile() ?? START_PROFILE);

/** Текущий поток экранов (до первого перехода — стартовый). */
export const useFlow = (): Flow => useFlowStore((s) => s.flow) ?? INITIAL;

/** Применить событие к потоку: решает чистая `flowStep`, недопустимое событие состояние не меняет. Профиль изменился — сохраняем (единственная точка записи). */
export function send(event: FlowEvent): void {
  const { flow, setFlow } = useFlowStore.getState();
  const current = flow ?? INITIAL;
  const next = flowStep(current, event);
  if (next === current) return;
  setFlow(next);
  if (next.profile !== current.profile) saveProfile(next.profile);
}

/** Новый сид матча: в sim случайности нет, поэтому берём его здесь, на границе UI. */
export const newSeed = (): number => crypto.getRandomValues(new Uint32Array(1))[0]!;

/** Вылет на выбранную миссию с составом профиля. */
export function sortie(missionId: string): void {
  const mission = MISSIONS[missionId];
  if (mission) send({ type: 'sortie', mission, lineupSize: LINEUP_SIZE, zones: DEFAULT_ZONES, seed: newSeed(), campaign: CAMPAIGN });
}

/** Сброс прогресса: стартовый профиль (свежая копия — запись в хранилище идёт по смене ссылки) через обычное событие `profile`. Пройденное обучение не возвращается. */
export function resetProgress(): void {
  const tutorialDone = (useFlowStore.getState().flow ?? INITIAL).profile.tutorialDone;
  send({
    type: 'profile',
    profile: { ...START_PROFILE, levels: { ...START_PROFILE.levels }, lineup: [...START_PROFILE.lineup], ...(tutorialDone ? { tutorialDone } : {}) },
  });
}
