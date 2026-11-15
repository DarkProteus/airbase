import type { SimState } from './engine';
import { creditReward, missionReward, missionResult, type MissionResult, type Reward } from './reward';
import { profileLineup, sortieRejection, type Profile } from './profile';
import type { LineupEntry } from './sortie';
import type { MissionConfig, Vec2 } from './types';

/**
 * Поток экранов сессии (design.md §1): база → бой → итог → база.
 * Состояние — чистые данные, переходы — чистая функция `flowStep`; React и store только хранят результат.
 * Профиль живёт в состоянии потока: на итоге в нём уже зачислена награда.
 */
export type Flow =
  | { screen: 'base'; profile: Profile }
  /** Бой: профиль прежний (награда ещё не получена), состав и сид зафиксированы на вылет. */
  | { screen: 'battle'; profile: Profile; mission: MissionConfig; lineup: LineupEntry[]; seed: number }
  /** Итог: профиль уже с наградой; ей же показывается экран. */
  | { screen: 'result'; profile: Profile; mission: MissionConfig; result: MissionResult; reward: Reward };

export type FlowEvent =
  /** База: изменение профиля (покупка, улучшение, состав). */
  | { type: 'profile'; profile: Profile }
  /** База → бой: миссия, правила состава и сид нового матча (сид порождает UI-слой: в sim случайности нет). */
  | { type: 'sortie'; mission: MissionConfig; lineupSize: number; zones: readonly Vec2[]; seed: number }
  /** Бой → итог: конечное состояние матча. Пока матч идёт, переход невозможен. */
  | { type: 'finish'; final: SimState }
  /** Итог → база. */
  | { type: 'home' }
  /** Обучение пройдено или пропущено: в любом экране ставит флаг в профиле (награда и покупки его сохраняют). */
  | { type: 'tutorialDone' };

export const initialFlow = (profile: Profile): Flow => ({ screen: 'base', profile });

/**
 * Переход потока. Недопустимое событие возвращает то же состояние (тот же объект):
 * из боя на базу — только через `finish` (итог), повторный `finish` на итоге награду не начисляет.
 */
export function flowStep(flow: Flow, event: FlowEvent): Flow {
  switch (event.type) {
    case 'profile':
      return flow.screen === 'base' ? { screen: 'base', profile: event.profile } : flow;
    case 'sortie': {
      if (flow.screen !== 'base' || sortieRejection(flow.profile, event.lineupSize)) return flow;
      const lineup = profileLineup(flow.profile, event.mission.zones ?? event.zones);
      return { screen: 'battle', profile: flow.profile, mission: event.mission, lineup, seed: event.seed };
    }
    case 'finish': {
      if (flow.screen !== 'battle') return flow;
      const result = missionResult(event.final);
      if (!result) return flow;
      const reward = missionReward(flow.mission, result);
      return { screen: 'result', profile: creditReward(flow.profile, reward), mission: flow.mission, result, reward };
    }
    case 'home':
      return flow.screen === 'result' ? { screen: 'base', profile: flow.profile } : flow;
    case 'tutorialDone':
      return flow.profile.tutorialDone ? flow : { ...flow, profile: { ...flow.profile, tutorialDone: true } };
  }
}
