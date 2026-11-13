import { damageEnemy, DT, TICK_RATE, type EnemyState, type Sim } from './engine';
import { pointAt } from './path';
import { applyModifiers } from './stats';
import type { AirGroupConfig, Content, MissionConfig, Vec2, WeaponConfig } from './types';

/** Фазы вылета по порядку; после rearm группа снова взлетает. */
export type SortiePhase = 'takeoff' | 'transit' | 'patrol' | 'return' | 'rearm';

/** Строка состава на вылет: какая группа, какого уровня и где её стартовая зона (центр). */
export interface LineupEntry {
  group: string;
  level: number;
  zone: Vec2;
}

export interface GroupState {
  id: number;
  type: string;
  level: number;
  /** Центр зоны патрулирования; радиус — из статов группы. */
  zone: Vec2;
  phase: SortiePhase;
  /** Тиков с начала текущей фазы. */
  phaseTick: number;
  pos: Vec2;
  /** Остаток топлива в тиках полёта. */
  fuel: number;
  ammo: number;
  /** Тиков до следующего выстрела, по одному на каждое оружие. */
  cooldowns: number[];
  /** Сколько вылетов завершено. */
  sorties: number;
}

/** Эффективные параметры группы после модификаторов; времена в секундах. */
export interface GroupStats {
  speed: number;
  fuel: number;
  ammo: number;
  rearmTime: number;
  zoneRadius: number;
  weapons: WeaponConfig[];
}

const EPS = 1e-9;
const ticks = (seconds: number): number => Math.max(0, Math.round(seconds * TICK_RATE));
const dist = (a: Vec2, b: Vec2): number => Math.hypot(a.x - b.x, a.y - b.y);

/** Клетка лежит на границе сетки карты. */
export const onMapEdge = (size: MissionConfig['size'], p: Vec2): boolean =>
  inMap(size, p) && (p.x === 0 || p.y === 0 || p.x === size.w - 1 || p.y === size.h - 1);

export const inMap = (size: MissionConfig['size'], p: Vec2): boolean =>
  p.x >= 0 && p.y >= 0 && p.x <= size.w - 1 && p.y <= size.h - 1;

function groupConfig(content: Content, type: string): AirGroupConfig {
  const cfg = content.groups?.[type];
  if (!cfg) throw new Error(`unknown group: ${type}`);
  return cfg;
}

/** Параметры группы: конфиг + свои self-модификаторы (auras и купленные уровни улучшений). */
export function groupStats(w: { readonly content: Content }, g: Pick<GroupState, 'type' | 'level'>): GroupStats {
  const cfg = groupConfig(w.content, g.type);
  const mods = [...cfg.auras, ...cfg.upgrades.slice(0, g.level).flatMap((u) => u.modifiers)].filter(
    (m) => m.scope === 'self' && m.side !== 'enemy',
  );
  const s = applyModifiers({ speed: cfg.speed, fuel: cfg.fuel, ammo: cfg.ammo, rearmTime: cfg.rearmTime, range: cfg.zoneRadius }, mods);
  return {
    speed: s.speed ?? 0,
    fuel: s.fuel ?? 0,
    ammo: Math.floor(s.ammo ?? 0),
    rearmTime: s.rearmTime ?? 0,
    zoneRadius: s.range ?? 0,
    weapons: cfg.weapons.map((weapon) => {
      const ws = applyModifiers({ damage: weapon.damage, fireRate: weapon.fireRate }, mods);
      return { ...weapon, damage: ws.damage ?? 0, fireRate: ws.fireRate ?? 0 };
    }),
  };
}

/** Группа в начале матча: на аэродроме, заправлена и заряжена, начинает взлёт. */
export function createGroup(mission: MissionConfig, content: Content, entry: LineupEntry, id: number): GroupState {
  const cfg = groupConfig(content, entry.group);
  if (!onMapEdge(mission.size, mission.airfield)) throw new Error(`airfield must be on the map edge: ${mission.id}`);
  if (!inMap(mission.size, entry.zone)) throw new Error(`zone outside the map: ${entry.group}`);
  if (entry.level < 0 || entry.level > cfg.upgrades.length) throw new Error(`bad level for ${entry.group}: ${entry.level}`);
  const st = groupStats({ content }, { type: entry.group, level: entry.level });
  if (st.speed <= 0) throw new Error(`group speed must be positive: ${entry.group}`);
  return {
    id,
    type: entry.group,
    level: entry.level,
    zone: { ...entry.zone },
    phase: 'takeoff',
    phaseTick: 0,
    pos: { ...mission.airfield },
    fuel: ticks(st.fuel),
    ammo: st.ammo,
    cooldowns: cfg.weapons.map(() => 0),
    sorties: 0,
  };
}

function setPhase(g: GroupState, phase: SortiePhase): void {
  g.phase = phase;
  g.phaseTick = 0;
}

/** Сдвигает pos к цели на шаг; true — долетели. */
function moveTo(pos: Vec2, target: Vec2, stepLen: number): boolean {
  const d = dist(pos, target);
  if (d <= stepLen + EPS) {
    pos.x = target.x;
    pos.y = target.y;
    return true;
  }
  pos.x += ((target.x - pos.x) / d) * stepLen;
  pos.y += ((target.y - pos.y) / d) * stepLen;
  return false;
}

/** Сколько тиков лететь между точками: время = расстояние / скорость. */
export const flightTicks = (from: Vec2, to: Vec2, speed: number): number => Math.ceil(dist(from, to) / (speed * DT) - 1e-6);

/** Каждое оружие бьёт самого продвинутого врага с целевым тегом внутри зоны; выстрел расходует боекомплект. */
function fire(sim: Sim, g: GroupState, st: GroupStats): void {
  const s = sim.state;
  st.weapons.forEach((weapon, i) => {
    if (g.ammo <= 0 || g.cooldowns[i]! > 0 || weapon.damage <= 0 || weapon.fireRate <= 0) return;
    let target: EnemyState | undefined;
    for (const e of s.enemies) {
      const tags = sim.content.enemies[e.type]!.tags;
      if (weapon.targetTags.length && !weapon.targetTags.some((t) => tags.includes(t))) continue;
      if (dist(pointAt(sim.path, e.dist), g.zone) <= st.zoneRadius && (!target || e.dist > target.dist)) target = e;
    }
    if (!target) return;
    g.ammo--;
    g.cooldowns[i] = Math.max(1, Math.round(TICK_RATE / weapon.fireRate));
    s.events.push({ type: 'groupShot', group: g.id, enemy: target.id, damage: weapon.damage });
    damageEnemy(sim, target.id, weapon.damage);
  });
}

/**
 * Один тик цикла вылета всех групп. Топливо тратится в воздухе (перелёт, патруль, возврат);
 * группа уходит на возврат, когда остатка хватает только долететь до аэродрома, или когда кончился боекомплект.
 * Длительность взлёта и перезарядки — минимум один тик.
 */
export function stepGroups(sim: Sim): void {
  const home = sim.mission.airfield;
  for (const g of sim.state.groups) {
    const cfg = groupConfig(sim.content, g.type);
    const st = groupStats(sim, g);
    const stepLen = st.speed * DT;
    g.cooldowns = g.cooldowns.map((c) => Math.max(0, c - 1));
    g.phaseTick++;
    const bingo = () => g.fuel <= flightTicks(g.pos, home, st.speed);
    switch (g.phase) {
      case 'takeoff':
        if (g.phaseTick >= ticks(cfg.takeoffTime)) setPhase(g, 'transit');
        break;
      case 'transit':
        g.fuel--;
        if (moveTo(g.pos, g.zone, stepLen)) setPhase(g, 'patrol');
        else if (bingo()) setPhase(g, 'return');
        break;
      case 'patrol':
        g.fuel--;
        // Зону могли перенести: в патруле группа держится её центра.
        if (!moveTo(g.pos, g.zone, stepLen)) setPhase(g, 'transit');
        else fire(sim, g, st);
        if ((st.ammo > 0 && g.ammo <= 0) || bingo()) setPhase(g, 'return');
        break;
      case 'return':
        g.fuel = Math.max(0, g.fuel - 1);
        if (moveTo(g.pos, home, stepLen)) {
          g.sorties++;
          sim.state.events.push({ type: 'sortieDone', group: g.id, sortie: g.sorties });
          setPhase(g, 'rearm');
        }
        break;
      case 'rearm':
        if (g.phaseTick >= ticks(st.rearmTime)) {
          g.fuel = ticks(st.fuel);
          g.ammo = st.ammo;
          setPhase(g, 'takeoff');
        }
        break;
    }
  }
}
