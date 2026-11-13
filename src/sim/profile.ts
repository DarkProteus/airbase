import { maxLevel, nextUpgradeCost } from './economy';
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

/** Улучшение: группа куплена, есть следующий уровень, хватает валюты. */
export function upgradeRejection(profile: Profile, groups: GroupRegistry, id: string): ProfileRejection | undefined {
  const cfg = groups[id];
  if (!cfg) return 'unknownGroup';
  if (!isOwned(profile, id)) return 'notOwned';
  const level = profile.levels[id]!;
  if (level >= maxLevel(cfg)) return 'maxLevel';
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

/** Следующий уровень улучшения за его цену. При отказе — тот же профиль. */
export function upgradeGroup(profile: Profile, groups: GroupRegistry, id: string): Profile {
  if (upgradeRejection(profile, groups, id)) return profile;
  const level = profile.levels[id]!;
  return {
    ...profile,
    currency: profile.currency - nextUpgradeCost(groups[id]!, level)!,
    levels: { ...profile.levels, [id]: level + 1 },
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
    return { group, level: profile.levels[group] ?? 0, zone };
  });
}
