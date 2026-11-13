import type { ProfileRejection } from '../../sim';

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
