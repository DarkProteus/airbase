import { maxLevel, nextOptions, nextUpgradeCost } from './economy';
import type { LineupEntry } from './sortie';
import type { AirGroupConfig, Vec2 } from './types';

/**
 * Профиль игрока между миссиями: валюта, купленные группы и состав на вылет.
 * Ключ в `levels` есть ⇔ группа куплена; значение — число купленных улучшений.
 */
export interface Profile {
  currency: number;
  levels: Record<string, number>;
  /** id выбранных групп по слотам: порядок слотов = порядок зон. */
  lineup: string[];
  /** Выбранные специализации: id группы -> id варианта развилки. Нет поля или записи (старое сохранение) = первый вариант. */
  specs?: Record<string, string>;
  /** Кампания: лучший результат по пройденным миссиям, id миссии -> звёзды (1–3). Нет записи — миссия не пройдена. */
  progress?: Record<string, number>;
  /** Миссии, открытые помимо цепочки кампании (миграция сохранения версии 1). */
  unlocked?: string[];
  /** Обучение первого вылета пройдено или пропущено; нет поля (старое сохранение) = ещё не показывали. */
  tutorialDone?: boolean;
}

/** Реестр групп, по которому считаются цены (контент передаёт вызывающий: sim его не импортирует). */
export type GroupRegistry = Readonly<Record<string, AirGroupConfig>>;

/** Причины отказа операций базы (список нужен UI, чтобы проверить, что у каждой есть текст). */
export const PROFILE_REJECTIONS = [
  'unknownGroup',
  'alreadyOwned',
  'notOwned',
  'notEnoughCurrency',
  'maxLevel',
  'specRequired',
  'unknownSpec',
  'lineupFull',
  'lineupIncomplete',
] as const;

export type ProfileRejection = (typeof PROFILE_REJECTIONS)[number];

export const isOwned = (profile: Profile, id: string): boolean => id in profile.levels;

/** Покупка: группа из реестра, ещё не куплена, хватает валюты. */
export function buyRejection(profile: Profile, groups: GroupRegistry, id: string): ProfileRejection | undefined {
  const cfg = groups[id];
  if (!cfg) return 'unknownGroup';
  if (isOwned(profile, id)) return 'alreadyOwned';
  if (profile.currency < cfg.cost) return 'notEnoughCurrency';
  return undefined;
}

/**
 * Улучшение: группа куплена, есть следующий уровень, хватает валюты.
 * Если следующий уровень — развилка, нужен `spec` — id одного из её вариантов (иначе specRequired / unknownSpec).
 */
export function upgradeRejection(profile: Profile, groups: GroupRegistry, id: string, spec?: string): ProfileRejection | undefined {
  const cfg = groups[id];
  if (!cfg) return 'unknownGroup';
  if (!isOwned(profile, id)) return 'notOwned';
  const level = profile.levels[id]!;
  if (level >= maxLevel(cfg)) return 'maxLevel';
  const options = nextOptions(cfg, level);
  if (options) {
    if (spec === undefined) return 'specRequired';
    if (!options.some((o) => o.id === spec)) return 'unknownSpec';
  }
  if (profile.currency < nextUpgradeCost(cfg, level)!) return 'notEnoughCurrency';
  return undefined;
}

/** Добавление в состав: куплена и есть место. Снятие (группа уже в составе) всегда возможно. */
export function lineupRejection(profile: Profile, groups: GroupRegistry, id: string, size: number): ProfileRejection | undefined {
  if (!groups[id]) return 'unknownGroup';
  if (profile.lineup.includes(id)) return undefined;
  if (!isOwned(profile, id)) return 'notOwned';
  if (profile.lineup.length >= size) return 'lineupFull';
  return undefined;
}

/** Вылет: в составе ровно `size` групп. */
export function sortieRejection(profile: Profile, size: number): ProfileRejection | undefined {
  return profile.lineup.length === size ? undefined : 'lineupIncomplete';
}

/** Покупка группы за её цену. При отказе — тот же профиль. */
export function buyGroup(profile: Profile, groups: GroupRegistry, id: string): Profile {
  if (buyRejection(profile, groups, id)) return profile;
  return { ...profile, currency: profile.currency - groups[id]!.cost, levels: { ...profile.levels, [id]: 0 } };
}

/** Следующий уровень улучшения за его цену; на развилке `spec` сохраняется в профиле. При отказе — тот же профиль. */
export function upgradeGroup(profile: Profile, groups: GroupRegistry, id: string, spec?: string): Profile {
  if (upgradeRejection(profile, groups, id, spec)) return profile;
  const level = profile.levels[id]!;
  const fork = nextOptions(groups[id]!, level) !== undefined;
  return {
    ...profile,
    currency: profile.currency - nextUpgradeCost(groups[id]!, level)!,
    levels: { ...profile.levels, [id]: level + 1 },
    ...(fork ? { specs: { ...profile.specs, [id]: spec! } } : {}),
  };
}

/** Добавить группу в состав или убрать, если она там уже есть. При отказе — тот же профиль. */
export function toggleLineup(profile: Profile, groups: GroupRegistry, id: string, size: number): Profile {
  if (lineupRejection(profile, groups, id, size)) return profile;
  const lineup = profile.lineup.includes(id) ? profile.lineup.filter((g) => g !== id) : [...profile.lineup, id];
  return { ...profile, lineup };
}

/** Состав профиля для createSim: уровни из профиля, зоны по слотам. */
export function profileLineup(profile: Profile, zones: readonly Vec2[]): LineupEntry[] {
  return profile.lineup.map((group, i) => {
    const zone = zones[i];
    if (!zone) throw new Error(`no zone for lineup slot ${i}`);
    const spec = profile.specs?.[group];
    return { group, level: profile.levels[group] ?? 0, ...(spec ? { spec } : {}), zone };
  });
}
