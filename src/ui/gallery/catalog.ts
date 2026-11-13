import { ENEMIES, UNITS } from '../../content';
import type { EnemyConfig, Modifier, UnitConfig } from '../../sim';

/** Что показывает галерея: ровно содержимое реестров контента. */
export interface Registries {
  units: Record<string, UnitConfig>;
  enemies: Record<string, EnemyConfig>;
}

export const CONTENT_REGISTRIES: Registries = { units: UNITS, enemies: ENEMIES };

export function listUnits(reg: Registries = CONTENT_REGISTRIES): UnitConfig[] {
  return Object.values(reg.units);
}

export function listEnemies(reg: Registries = CONTENT_REGISTRIES): EnemyConfig[] {
  return Object.values(reg.enemies);
}

/** Все теги из реестров — для переключателей в песочнице. */
export function collectTags(reg: Registries = CONTENT_REGISTRIES): string[] {
  const tags = new Set<string>();
  for (const e of [...listUnits(reg), ...listEnemies(reg)]) for (const t of e.tags) tags.add(t);
  for (const u of listUnits(reg)) {
    for (const m of [...u.modifiers, ...u.upgrades.flatMap((g) => g.modifiers)]) for (const t of m.tags ?? []) tags.add(t);
  }
  return [...tags].sort();
}

export interface PoolModifier {
  /** Стабильный ключ: unitId/источник/индекс. */
  key: string;
  label: string;
  modifier: Modifier;
}

/** Пул модификаторов из реестра, которые можно включать как «что-если». */
export function modifierPool(reg: Registries = CONTENT_REGISTRIES): PoolModifier[] {
  return listUnits(reg).flatMap((u) => [
    ...u.modifiers.map((modifier, i) => ({ key: `${u.id}/base/${i}`, label: `${u.name}: постоянный`, modifier })),
    ...u.upgrades.flatMap((g, lv) =>
      g.modifiers.map((modifier, i) => ({ key: `${u.id}/up${lv + 1}/${i}`, label: `${u.name}: ур. ${lv + 1}`, modifier })),
    ),
  ]);
}
