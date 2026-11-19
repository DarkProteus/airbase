import { weaponHits } from '../sim';
import type { ShotKind, WeaponConfig } from '../sim';

// --- вид выстрела из данных оружия ---

/** Порог тяжёлого редкого выстрела, если вид не задан в конфиге: большой урон за выстрел и небольшая скорострельность. */
const HEAVY_DAMAGE = 30;
const HEAVY_FIRE_RATE = 2;

/** Вид выстрела оружия: явное поле конфига, иначе по числам — тяжёлый редкий выстрел это ракета, остальное пушка. */
export function shotKindOf(weapon: Pick<WeaponConfig, 'damage' | 'fireRate' | 'shot'>): ShotKind {
  return weapon.shot ?? (weapon.damage >= HEAVY_DAMAGE && weapon.fireRate <= HEAVY_FIRE_RATE ? 'missile' : 'gun');
}

/**
 * Оружие, сделавшее выстрел: среди оружия группы, бьющего эту цель, то, чей урон ближе всего к урону события
 * (урон в событии уже с модификаторами, поэтому сравниваем по отношению). Нет подходящего — undefined.
 */
export function shotWeapon(weapons: readonly WeaponConfig[], enemyTags: readonly string[], damage: number): WeaponConfig | undefined {
  let best: WeaponConfig | undefined;
  let bestGap = Infinity;
  for (const w of weapons) {
    if (!weaponHits(w, enemyTags)) continue;
    const gap = w.damage > 0 && damage > 0 ? Math.abs(Math.log(damage / w.damage)) : Infinity;
    if (!best || gap < bestGap) {
      best = w;
      bestGap = gap;
    }
  }
  return best;
}
