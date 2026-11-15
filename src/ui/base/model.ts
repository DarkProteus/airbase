import type { MissionConfig, ObjectiveConfig, ProfileRejection } from '../../sim';

/** Причина отказа операции базы -> текст для игрока. */
export const REJECTION_TEXT: Record<ProfileRejection, string> = {
  unknownGroup: 'Неизвестная группа',
  alreadyOwned: 'Уже куплена',
  notOwned: 'Сначала купите группу',
  notEnoughCurrency: 'Не хватает валюты',
  maxLevel: 'Максимальный уровень',
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
