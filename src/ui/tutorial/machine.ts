import { TICK_RATE } from '../../sim';
import type { SimEvent, SimState } from '../../sim';

/**
 * Обучение первого вылета: чистый автомат `(состояние, вход) -> состояние`.
 * Шаги — данные (`TUTORIAL_STEPS`): текст и сигнал, которым шаг завершается. Сигнал — действие игрока
 * (выбор группы) или факт матча (зона перенесена, на карте враги, группа ушла на возврат), см. `observe`.
 * Автомат ничего не знает о конкретных группах, врагах и миссиях и матч не меняет — только читает.
 */

/** Что может завершить шаг: действие игрока или факт матча. */
export type Signal = 'select' | 'zoneSet' | 'enemy' | 'return' | 'rearm';

export interface TutorialStep {
  id: string;
  title: string;
  text: string;
  /** Сигнал, завершающий шаг; null — только кнопка «Далее». */
  until: Signal | null;
  /** Сколько секунд матча шаг показан, прежде чем его завершит сигнал-факт (чтобы подсказка не мелькала); кнопка «Далее» ждать не заставляет. */
  holdSeconds?: number;
}

export const TUTORIAL_STEPS: readonly TutorialStep[] = [
  {
    id: 'select',
    title: 'Выберите группу',
    text: 'Авиагруппы справа летают вылетами сами. Нажмите на строку группы, чтобы выбрать её.',
    until: 'select',
  },
  {
    id: 'zone',
    title: 'Перенесите зону патрулирования',
    text: 'Группа бьёт врагов только в своей зоне. Кликните по карте — зона переедет туда. Переносите зоны к тому месту, где идут враги.',
    until: 'zoneSet',
  },
  {
    id: 'targets',
    title: 'Типы целей',
    text: 'Враги бывают воздушными (◆ воздух) и наземными (■ земля). В строке группы видно, кого она бьёт: истребители наземные цели не трогают — для них нужна другая группа. Предупреждение внизу слева называет, кто сможет остановить волну.',
    until: 'enemy',
    holdSeconds: 4,
  },
  {
    id: 'fuel',
    title: 'Топливо и боекомплект',
    text: 'Топливо (полоска «топл.») и боекомплект («бк») расходуются в вылете. Когда они кончаются, группа уходит на аэродром, и зона остаётся без прикрытия. Кнопка «На базу» отправляет группу на перезарядку заранее — в затишье, чтобы к волне она вернулась полной.',
    until: 'return',
    holdSeconds: 4,
  },
  {
    id: 'rearm',
    title: 'Перезарядка',
    text: 'Пока группа на земле, она заправляется и перезаряжается («заряжается N с»), затем снова взлетает. Прикрывайте зону другими группами, пока эта в цикле.',
    until: 'rearm',
    holdSeconds: 3,
  },
  {
    id: 'done',
    title: 'Готово',
    text: 'Вот и всё: выбирайте группу, переносите зоны под волну и следите за топливом. Удачи!',
    until: null,
  },
];

export type TutorialState =
  /** since — тик матча, на котором показан текущий шаг. */
  | { status: 'active'; step: number; since: number }
  | { status: 'done' }
  | { status: 'skipped' };

export const initialTutorial: TutorialState = { status: 'active', step: 0, since: 0 };

export type TutorialInput =
  /** Сигналы, истинные на этом тике матча (см. `observe`). */
  | { type: 'signals'; signals: readonly Signal[]; tick: number }
  /** Кнопка «Далее» (на последнем шаге — «Готово»). */
  | { type: 'next'; tick: number }
  | { type: 'skip' };

/** Обучение закончено (пройдено или пропущено) — подсказки больше не показываются. */
export const isFinished = (s: TutorialState): s is Exclude<TutorialState, { status: 'active' }> => s.status !== 'active';

const advance = (steps: readonly TutorialStep[], s: Extract<TutorialState, { status: 'active' }>, tick: number): TutorialState =>
  s.step + 1 >= steps.length ? { status: 'done' } : { status: 'active', step: s.step + 1, since: tick };

/**
 * Один переход. Сигнал продвигает только текущий шаг и не больше чем на один шаг за вход;
 * чужие сигналы и входы после окончания обучения состояние не меняют (тот же объект).
 */
export function tutorialStep(state: TutorialState, input: TutorialInput, steps: readonly TutorialStep[] = TUTORIAL_STEPS): TutorialState {
  if (state.status !== 'active') return state;
  if (input.type === 'skip') return { status: 'skipped' };
  if (input.type === 'next') return advance(steps, state, input.tick);
  const step = steps[state.step];
  if (!step || step.until === null || !input.signals.includes(step.until)) return state;
  if (input.tick - state.since < (step.holdSeconds ?? 0) * TICK_RATE) return state;
  return advance(steps, state, input.tick);
}

/** Сигналы по снапшоту матча и выбору игрока: события тика (перенос зоны) и текущее состояние (враги, фазы групп). */
export function observe(state: SimState, selectedGroup: number | null): Signal[] {
  const out: Signal[] = [];
  if (selectedGroup !== null) out.push('select');
  if (state.events.some((e: SimEvent) => e.type === 'zoneSet')) out.push('zoneSet');
  if (state.enemies.length > 0) out.push('enemy');
  if (state.groups.some((g) => g.phase === 'return')) out.push('return');
  if (state.groups.some((g) => g.phase === 'rearm')) out.push('rearm');
  return out;
}
