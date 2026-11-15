import { activeSpec, auraMods, configStats, invested, maxLevel, nextOptions, nextUpgradeCost, ownModifiers } from '../../sim';
import type { AirGroupConfig, AuraSource, GroupStats, ModelConfig, Modifier, UpgradeOption, VisualConfig, VisualShape } from '../../sim';

/** Чистая логика отображения сущностей: без React, без three. Строится только из конфигов. */

export interface FieldRow {
  key: string;
  value: string;
}

/** Поля, которые карточка показывает отдельно (заголовок, превью), а не строкой. */
const HEADER_KEYS = new Set(['id', 'name', 'visual']);

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

export function clampLevel(group: AirGroupConfig, level: number): number {
  return Math.max(0, Math.min(maxLevel(group), Math.floor(level)));
}

/** Подходит ли модификатор цели с данными тегами (нужны все теги модификатора). */
export function modifierMatchesTags(mod: Modifier, tags: readonly string[]): boolean {
  return (mod.tags ?? []).every((t) => tags.includes(t));
}

/** Вариант развилки на карточке: что даст выбор (параметры «было → стало» считает configStats) и сам вариант. */
export interface OptionView {
  option: UpgradeOption;
  /** Собственные параметры группы после покупки уровня с этим вариантом (без внешних аур). */
  after: GroupStats;
  /** Изменившиеся собственные параметры: подпись, было, стало. Эффекты аур — в `option.description`. */
  changes: StatChange[];
}

export interface StatChange {
  label: string;
  from: number;
  to: number;
}

export interface GroupView {
  level: number;
  /** Действующая специализация (развилка куплена); без выбора в профиле — первый вариант. */
  spec: UpgradeOption | undefined;
  /** Варианты, если следующее улучшение — развилка; иначе пусто. */
  options: OptionView[];
  maxLevel: number;
  /** Теги с учётом включённых в песочнице. */
  tags: string[];
  /** Параметры уровня 0 без внешних модификаторов — точка отсчёта для подсветки изменений. */
  baseStats: GroupStats;
  /** Параметры этого уровня без внешних аур — «было» для «что-если». */
  own: GroupStats;
  stats: GroupStats;
  /** Суммарная стоимость: покупка + улучшения до level. */
  totalCost: number;
  /** Стоимость следующего улучшения, если оно есть. */
  nextUpgradeCost: number | undefined;
  /** Модификаторы, реально применённые к параметрам. */
  appliedModifiers: Modifier[];
}

/** Подписи числовых собственных параметров для списка изменений. */
const CHANGE_ROWS: { label: string; key: Exclude<keyof GroupStats, 'weapons'> }[] = [
  { label: 'скорость', key: 'speed' },
  { label: 'топливо, с', key: 'fuel' },
  { label: 'боекомплект', key: 'ammo' },
  { label: 'перезарядка, с', key: 'rearmTime' },
  { label: 'радиус зоны', key: 'zoneRadius' },
  { label: 'бонус за вылет', key: 'income' },
];

/** Что изменилось в собственных параметрах между двумя расчётами (урон и скорострельность — по каждому оружию). */
export function statChanges(from: GroupStats, to: GroupStats): StatChange[] {
  const out: StatChange[] = CHANGE_ROWS.filter((r) => from[r.key] !== to[r.key]).map((r) => ({ label: r.label, from: from[r.key], to: to[r.key] }));
  to.weapons.forEach((w, i) => {
    const was = from.weapons[i];
    if (!was) return;
    if (was.damage !== w.damage) out.push({ label: 'урон', from: was.damage, to: w.damage });
    if (was.fireRate !== w.fireRate) out.push({ label: 'скорострельность', from: was.fireRate, to: w.fireRate });
  });
  return out;
}

/**
 * Расчёт карточки группы теми же функциями, что в sim (configStats, invested).
 * «Что-если» песочница: extraTags добавляются группе, extraModifiers (ауры союзников) применяются, если подходят по тегам.
 */
export function viewGroup(
  group: AirGroupConfig,
  level = 0,
  extraModifiers: readonly Modifier[] = [],
  extraTags: readonly string[] = [],
  spec?: string,
): GroupView {
  const lv = clampLevel(group, level);
  const tags = [...new Set([...group.tags, ...extraTags])];
  // Как в sim: свои ауры и side: 'enemy' на владельца не действуют — их отсекает configStats.
  const external = extraModifiers.filter((m) => m.side !== 'enemy' && modifierMatchesTags(m, tags));
  const own = configStats(group, lv, [], spec);
  return {
    level: lv,
    spec: activeSpec(group, lv, spec),
    options: (nextOptions(group, lv) ?? []).map((option) => {
      const after = configStats(group, lv + 1, [], option.id);
      return { option, after, changes: statChanges(own, after) };
    }),
    maxLevel: maxLevel(group),
    tags,
    baseStats: configStats(group, 0),
    own,
    stats: configStats(group, lv, external, spec),
    totalCost: invested(group, lv),
    nextUpgradeCost: nextUpgradeCost(group, lv),
    appliedModifiers: [...ownModifiers(group, lv, spec), ...external],
  };
}

/** Группа-источник аур для «что-если»: конфиг и уровень, на котором она патрулирует. */
export interface WhatIfSource {
  group: AirGroupConfig;
  level: number;
  /** Выбранный вариант развилки; нет — первый. */
  spec?: string;
}

/**
 * Ауры источников, действующие на группу `target`: то же правило, что в sim (auraMods) —
 * сторона, scope, теги цели, своя аура на владельца не действует. Цель считается стоящей в зоне каждого источника.
 */
export function whatIfAuras(target: AirGroupConfig, tags: readonly string[], sources: readonly WhatIfSource[]): Modifier[] {
  const origin = { x: 0, y: 0 };
  const src: AuraSource[] = sources.map(({ group, level, spec }, id) => ({
    id,
    zone: origin,
    radius: configStats(group, clampLevel(group, level), [], spec).zoneRadius,
    mods: ownModifiers(group, clampLevel(group, level), spec).filter((m) => m.scope !== 'self'),
  }));
  const self = sources.findIndex((s) => s.group.id === target.id);
  return auraMods(src, 'ally', origin, tags, self < 0 ? undefined : self);
}

/** Карточка группы в песочнице: уровень, теги и ауры включённых источников «что-если». */
export function viewGroupWhatIf(
  group: AirGroupConfig,
  level: number,
  sources: readonly WhatIfSource[],
  extraTags: readonly string[] = [],
  spec?: string,
): GroupView {
  const tags = [...new Set([...group.tags, ...extraTags])];
  return viewGroup(group, level, whatIfAuras(group, tags, sources), extraTags, spec);
}

export function formatModifier(m: Modifier): string {
  const val = m.op === 'add' ? (m.value >= 0 ? `+${m.value}` : String(m.value)) : `×${m.value}`;
  const scope = m.scope === 'self' ? '' : m.scope === 'aura' ? ` aura(${m.radius ?? 'зона'})` : ' global';
  const tags = m.tags?.length ? ` [${m.tags.join('+')}]` : '';
  return `${m.side === 'enemy' ? 'враги: ' : ''}${m.stat} ${val}${scope}${tags}`;
}

export type PreviewShape = VisualShape;

/** Высота полёта по умолчанию для сущностей с тегом air, клеток. */
export const DEFAULT_ALTITUDE = 0.9;

export interface Visual {
  shape: PreviewShape;
  /** Составная модель из конфига; нет — рисуется примитив shape. */
  model?: ModelConfig;
  /** Цвет '#rrggbb' — годится и для CSS, и для THREE.Color. */
  color: string;
  /** Парит над землёй (altitude > 0). */
  flying: boolean;
  /** Высота полёта в клетках (0 для наземных). */
  altitude: number;
  /** Относительный размер: scale из конфига или 0.7..1.3 для запасного варианта. */
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

/** HSL (h в градусах, s и l в долях) -> '#rrggbb'. */
export function hslToHex(h: number, s: number, l: number): string {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(c * 255)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/**
 * Единый источник «конфиг -> визуал» для сцены и превью галереи.
 * Берёт entity.visual; запасной вариант (если поля нет) — форма и цвет от роли и тегов.
 */
export function visualOf(entity: { role?: string; tags: readonly string[]; visual?: VisualConfig }): Visual {
  const tags = [...entity.tags].sort();
  const v = entity.visual;
  const altitude = Math.max(0, v?.altitude ?? (tags.includes('air') ? DEFAULT_ALTITUDE : 0));
  if (v) return { shape: v.shape, ...(v.model ? { model: v.model } : {}), color: v.color, flying: altitude > 0, altitude, size: v.scale ?? 1 };
  const key = entity.role ?? tags.join('+');
  const h = hashString(key);
  const th = hashString(tags.join('+'));
  return {
    shape: SHAPES[th % SHAPES.length] ?? 'cube',
    color: hslToHex(h % 360, 0.65, 0.55),
    flying: altitude > 0,
    altitude,
    size: 0.7 + ((h >>> 9) % 61) / 100,
  };
}
