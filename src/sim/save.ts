import { maxLevel } from './economy';
import type { GroupRegistry, Profile } from './profile';

/** Версия формата сохранения: меняется при несовместимой смене формы профиля. */
export const SAVE_VERSION = 1;

/** Сохранение в строку: `{ version, profile }`. Хранилище — вне sim, здесь только чистый формат. */
export const serializeProfile = (profile: Profile): string => JSON.stringify({ version: SAVE_VERSION, profile });

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isCount = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0;

/**
 * Чтение сохранения. Любой мусор, чужая форма или неизвестная версия -> undefined (вызывающий берёт стартовый профиль).
 * Устаревшее по контенту (группы, которых уже нет в реестре) не отбрасывает весь прогресс: такие записи
 * выкидываются из уровней и состава, уровень выше максимума срезается, состав чистится от непокупных групп,
 * дублей и лишних слотов сверх `lineupSize`. Поля, добавленные позже (`tutorialDone`), в старом сохранении
 * отсутствуют — версия формата не меняется, профиль читается как есть (обучение ещё не пройдено).
 */
export function parseProfile(raw: string | null | undefined, groups: GroupRegistry, lineupSize: number): Profile | undefined {
  if (typeof raw !== 'string') return undefined;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return undefined;
  }
  if (!isRecord(data) || data.version !== SAVE_VERSION || !isRecord(data.profile)) return undefined;
  const { currency, levels, lineup } = data.profile;
  if (typeof currency !== 'number' || !Number.isFinite(currency) || currency < 0) return undefined;
  if (!isRecord(levels) || !Object.values(levels).every(isCount)) return undefined;
  if (!Array.isArray(lineup) || !lineup.every((id) => typeof id === 'string')) return undefined;

  const known = (id: string) => Object.hasOwn(groups, id);
  const kept: Record<string, number> = {};
  for (const [id, level] of Object.entries(levels) as [string, number][]) {
    if (known(id)) kept[id] = Math.min(level, maxLevel(groups[id]!));
  }
  const slots = (lineup as string[]).filter((id, i, all) => Object.hasOwn(kept, id) && all.indexOf(id) === i).slice(0, lineupSize);
  // Флаг обучения необязателен: старые сохранения его не знают, любое значение кроме true — «не пройдено».
  const tutorialDone = data.profile.tutorialDone === true;
  return { currency, levels: kept, lineup: slots, ...(tutorialDone ? { tutorialDone } : {}) };
}
