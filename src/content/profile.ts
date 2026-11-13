import type { LineupEntry, Profile, Vec2 } from '../sim';
import { profileLineup } from '../sim';

/** Стартовый профиль: куплены F-16 и A-10, на третью группу (например C-130) нужно накопить/купить. */
export const START_PROFILE: Profile = {
  currency: 200,
  levels: { f16: 0, a10: 0 },
  lineup: ['f16', 'a10'],
};

/** Стартовые зоны патруля по слотам состава: у целей обеих миссий (карта 13×11). */
export const DEFAULT_ZONES: Vec2[] = [
  { x: 4, y: 5 },
  { x: 5, y: 6 },
  { x: 5, y: 5 },
];

/** Состав для dev-шортката и тестов, пока в профиле нет полного состава: F-16, A-10, Growler, уровень 0. */
export const DEFAULT_LINEUP: LineupEntry[] = profileLineup(
  { currency: 0, levels: { f16: 0, a10: 0, growler: 0 }, lineup: ['f16', 'a10', 'growler'] },
  DEFAULT_ZONES,
);
