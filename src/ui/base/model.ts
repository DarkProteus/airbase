import { bestStars, MAX_STARS, missionUnlocked } from '../../sim';
import type { MissionConfig, ObjectiveConfig, Profile, ProfileRejection } from '../../sim';

/** Причина отказа операции базы -> текст для игрока. */
export const REJECTION_TEXT: Record<ProfileRejection, string> = {
  unknownGroup: 'Неизвестная группа',
  alreadyOwned: 'Уже куплена',
  notOwned: 'Сначала купите группу',
  notEnoughCurrency: 'Не хватает валюты',
  maxLevel: 'Максимальный уровень',
  specRequired: 'Выберите специализацию',
  unknownSpec: 'Неизвестная специализация',
  lineupFull: 'Состав полон',
  lineupIncomplete: 'Состав неполный: нужно ровно {n}',
};

/** Текст причины; в {n} подставляется размер состава. */
export const rejectionText = (reason: ProfileRejection, lineupSize: number): string =>
  REJECTION_TEXT[reason].replace('{n}', String(lineupSize));

/** Тип цели миссии -> короткая подпись для выбора миссии. Новый тип цели — новая строка здесь. */
export const OBJECTIVE_LABEL: Record<ObjectiveConfig['type'], string> = {
  defend: 'Оборона объекта',
  escort: 'Сопровождение колонны',
};

/** Строка под названием миссии: тип цели и награда за исход. */
export function missionSummary(mission: MissionConfig): string {
  const kind = mission.objective ? OBJECTIVE_LABEL[mission.objective.type] : 'Оборона базы';
  const { win = 0, loss = 0 } = mission.reward ?? {};
  return `${kind} · награда: победа ${win}, поражение ${loss}`;
}

/** Карточка миссии на базе: открыта ли, лучший результат и что нужно пройти, чтобы открыть. */
export interface MissionCard {
  id: string;
  name: string;
  summary: string;
  locked: boolean;
  /** Лучший результат, 0 — не пройдена; из `maxStars`. */
  stars: number;
  maxStars: number;
  /** Название миссии, победа в которой откроет эту (только для закрытой). */
  unlockBy?: string;
}

/** Карточки миссий в порядке кампании (миссии вне кампании — в конце, открыты). */
export function missionCards(missions: Readonly<Record<string, MissionConfig>>, campaign: readonly string[], profile: Pick<Profile, 'progress' | 'unlocked'>): MissionCard[] {
  const ids = [...campaign.filter((id) => missions[id]), ...Object.keys(missions).filter((id) => !campaign.includes(id))];
  return ids.map((id) => {
    const m = missions[id]!;
    const locked = !missionUnlocked(profile, campaign, id);
    const prev = missions[campaign[campaign.indexOf(id) - 1] ?? ''];
    return {
      id,
      name: m.name,
      summary: missionSummary(m),
      locked,
      stars: bestStars(profile, id),
      maxStars: MAX_STARS,
      ...(locked && prev ? { unlockBy: prev.name } : {}),
    };
  });
}

/** Миссия, выбранная на базе по умолчанию: самая дальняя открытая. */
export const defaultMission = (cards: readonly MissionCard[]): string | undefined => cards.filter((c) => !c.locked).at(-1)?.id ?? cards[0]?.id;

/** Строка звёзд: закрашенные и пустые. */
export const starsText = (stars: number, max: number = MAX_STARS): string => '★'.repeat(Math.max(0, Math.min(max, stars))) + '☆'.repeat(Math.max(0, max - Math.max(0, stars)));

/** Сброс прогресса в два шага: сначала вопрос, потом сам сброс. */
export type ResetStep = 'idle' | 'confirm';

/** Переход шага сброса; `reset: true` — подтверждено, прогресс надо сбросить. Подтвердить, не спросив, нельзя. */
export function resetStep(step: ResetStep, action: 'ask' | 'confirm' | 'cancel'): { step: ResetStep; reset: boolean } {
  if (action === 'ask') return { step: 'confirm', reset: false };
  if (action === 'confirm' && step === 'confirm') return { step: 'idle', reset: true };
  return { step: 'idle', reset: false };
}
