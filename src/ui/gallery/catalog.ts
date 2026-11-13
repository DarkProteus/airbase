import { ENEMIES, GROUPS } from '../../content';
import type { AirGroupConfig, EnemyConfig, Modifier } from '../../sim';

/** Что показывает галерея: ровно содержимое реестров контента. */
export interface Registries {
  groups: Record<string, AirGroupConfig>;
  enemies: Record<string, EnemyConfig>;
}

export const CONTENT_REGISTRIES: Registries = { groups: GROUPS, enemies: ENEMIES };

export function listGroups(reg: Registries = CONTENT_REGISTRIES): AirGroupConfig[] {
  return Object.values(reg.groups);
}

export function listEnemies(reg: Registries = CONTENT_REGISTRIES): EnemyConfig[] {
  return Object.values(reg.enemies);
}

/** Все теги из реестров — для переключателей в песочнице. */
export function collectTags(reg: Registries = CONTENT_REGISTRIES): string[] {
  const tags = new Set<string>();
  for (const e of [...listGroups(reg), ...listEnemies(reg)]) for (const t of e.tags) tags.add(t);
  for (const u of listGroups(reg)) {
    for (const w of u.weapons) for (const t of w.targetTags) tags.add(t);
    for (const m of [...u.auras, ...u.upgrades.flatMap((g) => g.modifiers)]) for (const t of m.tags ?? []) tags.add(t);
  }
  return [...tags].sort();
}

export interface PoolModifier {
  /** Стабильный ключ: groupId/источник/индекс. */
  key: string;
  label: string;
  modifier: Modifier;
}

/** Пул модификаторов из реестра, которые можно включать как «что-если». */
export function modifierPool(reg: Registries = CONTENT_REGISTRIES): PoolModifier[] {
  return listGroups(reg).flatMap((u) => [
    ...u.auras.map((modifier, i) => ({ key: `${u.id}/base/${i}`, label: `${u.name}: постоянный`, modifier })),
    ...u.upgrades.flatMap((g, lv) =>
      g.modifiers.map((modifier, i) => ({ key: `${u.id}/up${lv + 1}/${i}`, label: `${u.name}: ур. ${lv + 1}`, modifier })),
    ),
  ]);
}
