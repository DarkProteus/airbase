import { enemyDetected, ownModifiers, TICK_RATE, weaponHits } from '../../sim';
import type { AirGroupConfig, Content, MissionConfig, SimState, Vec2, World } from '../../sim';

/**
 * Боевая разметка: чистые функции от снапшота sim и конфигов. Рендер и React только рисуют результат.
 * Тип цели берётся из тегов конфига (TARGET_KINDS), в id сущностей ничего не зашито.
 */

/** Теги конфига, по которым цели делятся на типы; порядок — порядок показа. */
export const TARGET_KINDS = ['air', 'ground'] as const;
export type TargetKind = (typeof TARGET_KINDS)[number];

export const TARGET_KIND_LABEL: Record<TargetKind, string> = { air: 'воздух', ground: 'земля' };

/** Тип цели по тегам; undefined — тега типа нет (такую цель никак не помечаем). */
export const targetKind = (tags: readonly string[]): TargetKind | undefined => TARGET_KINDS.find((k) => tags.includes(k));

/** Типы целей, которые бьёт группа: объединение по всему её оружию (пустой targetTags — любые типы). Без оружия — пусто. */
export function groupTargetKinds(cfg: Pick<AirGroupConfig, 'weapons'>): TargetKind[] {
  return TARGET_KINDS.filter((k) => cfg.weapons.some((w) => weaponHits(w, [k])));
}

/** Может ли группа бить врага с такими тегами хотя бы одним оружием (то же правило, что при стрельбе в sim). */
export const groupCanHit = (cfg: Pick<AirGroupConfig, 'weapons'>, enemyTags: readonly string[]): boolean =>
  cfg.weapons.some((w) => weaponHits(w, enemyTags));

/** Полоска и метка врага на карте. */
export interface EnemyMark {
  id: number;
  /** Доля здоровья 0..1. */
  ratio: number;
  kind: TargetKind | undefined;
  /** Может ли выбранная группа бить этого врага; null — группа не выбрана (или она не из матча). */
  hittable: boolean | null;
  /** Малозаметный враг вне зоны обнаружения: сейчас его не атакует никто. */
  hidden: boolean;
}

/** Есть ли у группы аура обнаружения (стат detect по врагам) на каком-либо уровне улучшений. */
export const groupDetects = (cfg: Pick<AirGroupConfig, 'auras' | 'upgrades'>): boolean =>
  ownModifiers(cfg as AirGroupConfig, cfg.upgrades.length).some((m) => m.stat === 'detect' && m.side === 'enemy' && m.scope !== 'self' && m.value > 0);

export function enemyMarks(content: Content, state: SimState, selectedGroup: number | null = null): EnemyMark[] {
  const group = state.groups.find((g) => g.id === selectedGroup);
  const groupCfg = group && content.groups[group.type];
  return state.enemies.map((e) => {
    const cfg = content.enemies[e.type];
    return {
      id: e.id,
      ratio: cfg && cfg.hp > 0 ? Math.max(0, Math.min(1, e.hp / cfg.hp)) : 0,
      kind: cfg && targetKind(cfg.tags),
      hittable: groupCfg && cfg ? groupCanHit(groupCfg, cfg.tags) : null,
      hidden: cfg ? !enemyDetected({ content, state }, e) : false,
    };
  });
}

/** Сколько тиков после выстрела группа считается атакующей эту цель (0,5 с). */
export const ATTACK_LINGER_TICKS = TICK_RATE / 2;

export interface AttackLink {
  group: number;
  enemy: number;
}

/** Кто кого атакует сейчас: группы с недавним выстрелом по ещё живому врагу. */
export function attackLinks(state: SimState): AttackLink[] {
  const out: AttackLink[] = [];
  for (const g of state.groups) {
    const shot = g.lastShot;
    if (shot && state.tick - shot.tick <= ATTACK_LINGER_TICKS && state.enemies.some((e) => e.id === shot.enemy))
      out.push({ group: g.id, enemy: shot.enemy });
  }
  return out;
}

export interface WarningItem {
  enemy: string;
  name: string;
  count: number;
  kind: TargetKind | undefined;
  /** Названия групп состава, способных бить этого врага; пусто — бить некому. */
  hitBy: string[];
}

export interface WarningEntry {
  /** Индекс точки входа из `MissionConfig.spawns` (с 0). */
  spawn: number;
  at: Vec2;
  items: WarningItem[];
}

export interface WaveWarning {
  /** Номер волны с 1 и всего волн в миссии. */
  wave: number;
  waves: number;
  /** Секунд до старта; null — старт ждёт зачистки предыдущей волны. */
  seconds: number | null;
  total: number;
  entries: WarningEntry[];
}

/** Точка входа волновой группы: у миссии с путём — начало пути, иначе `spawns[spawn]`. */
const spawnPoint = (m: MissionConfig, spawn: number): Vec2 | undefined => (m.objective ? m.spawns?.[spawn] : m.path?.[0]);

/**
 * Предупреждение о следующей волне: отсчёт подготовки (phase prep) или ожидание зачистки
 * (волна с правилом start: 'clear' после окончания спавна). Иначе — null.
 */
export function waveWarning(w: World): WaveWarning | null {
  const { mission, state: s, content } = w;
  const next = mission.waves[s.wave];
  if (!next || s.status !== 'running') return null;
  let seconds: number | null;
  if (s.phase === 'prep') seconds = Math.max(0, Math.round(next.prep * TICK_RATE) - s.phaseTick) / TICK_RATE;
  else if (next.start === 'clear') seconds = null;
  else return null;

  const lineup = s.groups.flatMap((g) => content.groups[g.type] ?? []);
  const detects = lineup.some(groupDetects);
  // Малозаметного врага без группы обнаружения в составе бить некому.
  const hitters = (tags: readonly string[], stealth = false) => [
    ...new Set(lineup.filter((cfg) => groupCanHit(cfg, tags) && (!stealth || detects)).map((cfg) => cfg.name)),
  ];
  const bySpawn = new Map<number, WarningEntry>();
  let total = 0;
  for (const g of next.groups) {
    const idx = mission.objective ? (g.spawn ?? 0) : 0;
    const at = spawnPoint(mission, idx);
    const cfg = content.enemies[g.enemy];
    if (!at || !cfg) continue;
    let entry = bySpawn.get(idx);
    if (!entry) bySpawn.set(idx, (entry = { spawn: idx, at: { ...at }, items: [] }));
    const item = entry.items.find((i) => i.enemy === g.enemy);
    if (item) item.count += g.count;
    else entry.items.push({ enemy: g.enemy, name: cfg.name, count: g.count, kind: targetKind(cfg.tags), hitBy: hitters(cfg.tags, cfg.stealth) });
    total += g.count;
  }
  const entries = [...bySpawn.values()].sort((a, b) => a.spawn - b.spawn);
  return { wave: s.wave + 1, waves: mission.waves.length, seconds, total, entries };
}
