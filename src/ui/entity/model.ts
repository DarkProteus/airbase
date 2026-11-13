import { applyModifiers } from '../../sim';
import type { Modifier, Stats, UnitConfig } from '../../sim';

/** Чистая логика отображения сущностей: без React, без three. Строится только из конфигов. */

export interface FieldRow {
  key: string;
  value: string;
}

/** Поля, которые карточка показывает отдельно (заголовок), а не строкой. */
const HEADER_KEYS = new Set(['id', 'name']);

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : String(Math.round(v * 1000) / 1000);
  if (typeof v === 'string' || typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) {
    if (v.every((x) => typeof x === 'string' || typeof x === 'number')) return v.join(', ') || '—';
    return `${v.length} шт.`;
  }
  return JSON.stringify(v);
}

/** Обобщённый список полей конфига: новое поле в конфиге появляется без правок UI. */
export function describeFields(config: object): FieldRow[] {
  return Object.entries(config)
    .filter(([k]) => !HEADER_KEYS.has(k))
    .map(([key, v]) => ({ key, value: formatValue(v) }));
}

export function maxUpgradeLevel(unit: UnitConfig): number {
  return unit.upgrades.length;
}

export function clampLevel(unit: UnitConfig, level: number): number {
  return Math.max(0, Math.min(maxUpgradeLevel(unit), Math.floor(level)));
}

/** Модификаторы владельца на уровне level: постоянные + upgrades[0..level-1]. */
export function unitModifiersAtLevel(unit: UnitConfig, level: number): Modifier[] {
  const lv = clampLevel(unit, level);
  return [...unit.modifiers, ...unit.upgrades.slice(0, lv).flatMap((u) => u.modifiers)];
}

/** Подходит ли модификатор цели с данными тегами (нужны все теги модификатора). */
export function modifierMatchesTags(mod: Modifier, tags: readonly string[]): boolean {
  return (mod.tags ?? []).every((t) => tags.includes(t));
}

export interface UnitView {
  level: number;
  maxLevel: number;
  /** Теги с учётом включённых в песочнице. */
  tags: string[];
  baseStats: Stats;
  stats: Stats;
  /** Суммарная стоимость: покупка + улучшения до level. */
  totalCost: number;
  /** Стоимость следующего улучшения, если оно есть. */
  nextUpgradeCost: number | undefined;
  /** Модификаторы, реально применённые к статам. */
  appliedModifiers: Modifier[];
}

/** «Что-если» песочница: extraTags добавляются юниту, extraModifiers применяются, если подходят по тегам. */
export function viewUnit(
  unit: UnitConfig,
  level = 0,
  extraModifiers: readonly Modifier[] = [],
  extraTags: readonly string[] = [],
): UnitView {
  const lv = clampLevel(unit, level);
  const tags = [...new Set([...unit.tags, ...extraTags])];
  const applied = [
    ...unitModifiersAtLevel(unit, lv),
    ...extraModifiers.filter((m) => modifierMatchesTags(m, tags)),
  ];
  return {
    level: lv,
    maxLevel: maxUpgradeLevel(unit),
    tags,
    baseStats: unit.stats,
    stats: applyModifiers(unit.stats, applied),
    totalCost: unit.cost + unit.upgrades.slice(0, lv).reduce((s, u) => s + u.cost, 0),
    nextUpgradeCost: unit.upgrades[lv]?.cost,
    appliedModifiers: applied,
  };
}

export function formatModifier(m: Modifier): string {
  const val = m.op === 'add' ? (m.value >= 0 ? `+${m.value}` : String(m.value)) : `×${m.value}`;
  const scope = m.scope === 'self' ? '' : m.scope === 'aura' ? ` aura(${m.radius ?? '?'})` : ' global';
  const tags = m.tags?.length ? ` [${m.tags.join('+')}]` : '';
  return `${m.stat} ${val}${scope}${tags}`;
}

export type PreviewShape = 'cube' | 'cylinder' | 'pyramid' | 'sphere';

export interface Visual {
  shape: PreviewShape;
  /** CSS-цвет, детерминированно от роли/тегов. */
  color: string;
  /** Парит над землёй (тег air). */
  flying: boolean;
  /** Относительный размер 0.7..1.3. */
  size: number;
}

const SHAPES: PreviewShape[] = ['cube', 'cylinder', 'pyramid', 'sphere'];

/** Стабильный строковый хеш (FNV-1a), только для визуала. */
export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Превью из имеющихся данных: цвет и форма — от роли (если есть) и тегов, парение — от тега air.
 * Визуальных полей в конфигах нет; если понадобятся — добавлять в UnitConfig/EnemyConfig отдельной задачей.
 */
export function visualOf(entity: { role?: string; tags: readonly string[] }): Visual {
  const tags = [...entity.tags].sort();
  const key = entity.role ?? tags.join('+');
  const h = hashString(key);
  const hue = h % 360;
  const th = hashString(tags.join('+'));
  return {
    shape: SHAPES[th % SHAPES.length] ?? 'cube',
    color: `hsl(${hue} 65% 55%)`,
    flying: tags.includes('air'),
    size: 0.7 + ((h >>> 9) % 61) / 100,
  };
}
