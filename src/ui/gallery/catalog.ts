import { ENEMIES, GROUPS } from '../../content';
import { everyModifier } from '../../sim';
import type { AirGroupConfig, EnemyConfig } from '../../sim';

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
    for (const m of everyModifier(u)) for (const t of m.tags ?? []) tags.add(t);
  }
  return [...tags].sort();
}

/** Группы-источники аур для «что-если»: хотя бы один не-self модификатор (в конфиге, улучшениях или любом варианте развилки). */
export function listAuraSources(reg: Registries = CONTENT_REGISTRIES): AirGroupConfig[] {
  return listGroups(reg).filter((g) => everyModifier(g).some((m) => m.scope !== 'self'));
}
