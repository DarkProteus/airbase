import type { RejectReason, World } from './economy';
import { damageEnemy, DT, enemyThreat, TICK_RATE, type EnemyState, type Sim } from './engine';
import { applyModifiers } from './stats';
import type { AirGroupConfig, Content, MissionConfig, Modifier, Vec2, WeaponConfig } from './types';

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
  /** Остаток топлива в тиках полёта (дробный, если аура союзника растягивает бак). */
  fuel: number;
  ammo: number;
  /** Тиков до следующего выстрела, по одному на каждое оружие. */
  cooldowns: number[];
  /** Сколько вылетов завершено. */
  sorties: number;
  /** Последний выстрел группы: по кому и в какой тик (для показа «кто кого атакует»). */
  lastShot?: { enemy: number; tick: number };
}

/** Эффективные параметры группы после модификаторов; времена в секундах. */
export interface GroupStats {
  speed: number;
  fuel: number;
  ammo: number;
  rearmTime: number;
  zoneRadius: number;
  /** Бонус к награде миссии за завершённый вылет. */
  income: number;
  weapons: WeaponConfig[];
}

/** Может ли оружие бить цель с такими тегами; пустой список целевых тегов — любые цели. */
export const weaponHits = (weapon: Pick<WeaponConfig, 'targetTags'>, enemyTags: readonly string[]): boolean =>
  weapon.targetTags.length === 0 || weapon.targetTags.some((t) => enemyTags.includes(t));

const EPS = 1e-9;
/** Секунды -> целые тики (округление к ближайшему). */
export const toTicks = (seconds: number): number => Math.max(0, Math.round(seconds * TICK_RATE));
const dist = (a: Vec2, b: Vec2): number => Math.hypot(a.x - b.x, a.y - b.y);

/** Клетка лежит на границе сетки карты. */
export const onMapEdge = (size: MissionConfig['size'], p: Vec2): boolean =>
  inMap(size, p) && (p.x === 0 || p.y === 0 || p.x === size.w - 1 || p.y === size.h - 1);

export const inMap = (size: MissionConfig['size'], p: Vec2): boolean =>
  p.x >= 0 && p.y >= 0 && p.x <= size.w - 1 && p.y <= size.h - 1;

/**
 * Проверка команды setZone: группа должна быть в матче, центр зоны — на карте (радиус зоны не ограничен картой).
 * Движок применяет команду только при успехе, UI вызывает ту же функцию для подсказок.
 */
export function zoneRejection(w: Pick<World, 'mission' | 'state'>, group: number, zone: Vec2): RejectReason | undefined {
  if (!w.state.groups.some((g) => g.id === group)) return 'unknownGroup';
  if (!Number.isFinite(zone.x) || !Number.isFinite(zone.y) || !inMap(w.mission.size, zone)) return 'outOfMap';
  return undefined;
}

function groupConfig(content: Content, type: string): AirGroupConfig {
  const cfg = content.groups[type];
  if (!cfg) throw new Error(`unknown group: ${type}`);
  return cfg;
}

/** Свои модификаторы группы: ауры конфига + купленные уровни улучшений. */
export const ownModifiers = (cfg: AirGroupConfig, level: number): Modifier[] => [
  ...cfg.auras,
  ...cfg.upgrades.slice(0, level).flatMap((u) => u.modifiers),
];

/**
 * Параметры группы по конфигу и уровню: свои self-модификаторы + внешние (`external` — ауры других групп,
 * уже отобранные по радиусу и тегам). Этой же функцией считают карточки базы и галереи.
 */
export function configStats(cfg: AirGroupConfig, level: number, external: readonly Modifier[] = []): GroupStats {
  const mods = [...ownModifiers(cfg, level).filter((m) => m.scope === 'self' && m.side !== 'enemy'), ...external];
  const s = applyModifiers(
    { speed: cfg.speed, fuel: cfg.fuel, ammo: cfg.ammo, rearmTime: cfg.rearmTime, range: cfg.zoneRadius, income: cfg.income ?? 0 },
    mods,
  );
  return {
    speed: s.speed ?? 0,
    fuel: s.fuel ?? 0,
    ammo: Math.floor(s.ammo ?? 0),
    rearmTime: s.rearmTime ?? 0,
    zoneRadius: s.range ?? 0,
    income: s.income ?? 0,
    weapons: cfg.weapons.map((weapon) => {
      const ws = applyModifiers({ damage: weapon.damage, fireRate: weapon.fireRate }, mods);
      return { ...weapon, damage: ws.damage ?? 0, fireRate: ws.fireRate ?? 0 };
    }),
  };
}

/** Собственные параметры группы матча — без аур других групп (ёмкость бака, боекомплект, радиус её ауры). */
export const groupStats = (w: { readonly content: Content }, g: Pick<GroupState, 'type' | 'level'>, external: readonly Modifier[] = []): GroupStats =>
  configStats(groupConfig(w.content, g.type), g.level, external);

/** Источник аур: патрулирующая группа; аура исходит из центра её зоны. */
export interface AuraSource {
  id: number;
  zone: Vec2;
  /** Радиус ауры по умолчанию — собственный радиус зоны владельца. */
  radius: number;
  mods: Modifier[];
}

type AuraWorld = Pick<World, 'content' | 'state'>;

/** Ауры действуют только в фазе patrol: на взлёте, в перелёте, на возврате и перезарядке эффекта нет. */
export function auraSources(w: AuraWorld): AuraSource[] {
  const out: AuraSource[] = [];
  for (const g of w.state.groups) {
    if (g.phase !== 'patrol') continue;
    const cfg = groupConfig(w.content, g.type);
    const mods = ownModifiers(cfg, g.level).filter((m) => m.scope !== 'self');
    if (mods.length) out.push({ id: g.id, zone: g.zone, radius: configStats(cfg, g.level).zoneRadius, mods });
  }
  return out;
}

/** Модификаторы источников, достающие цель в точке `pos` с тегами `tags`; `except` — id группы-цели (своя аура на владельца не действует). */
export function auraMods(sources: readonly AuraSource[], side: 'ally' | 'enemy', pos: Vec2, tags: readonly string[], except?: number): Modifier[] {
  const out: Modifier[] = [];
  for (const src of sources) {
    if (src.id === except) continue;
    for (const m of src.mods) {
      if ((m.side ?? 'ally') !== side) continue;
      if (m.scope !== 'global' && dist(src.zone, pos) > (m.radius ?? src.radius)) continue;
      if ((m.tags ?? []).every((t) => tags.includes(t))) out.push(m);
    }
  }
  return out;
}

/** Параметры группы в бою: собственные + ауры союзных групп, в чьей зоне она сейчас находится. */
export function effectiveGroupStats(w: AuraWorld, g: GroupState, sources: readonly AuraSource[] = auraSources(w)): GroupStats {
  return groupStats(w, g, auraMods(sources, 'ally', g.pos, groupConfig(w.content, g.type).tags, g.id));
}

/** Скорость врага с учётом вражеских модификаторов (side: 'enemy') патрулирующих групп. */
export function enemySpeed(w: AuraWorld, enemy: EnemyState, sources: readonly AuraSource[] = auraSources(w)): number {
  const mods = auraMods(sources, 'enemy', enemy.pos, w.content.enemies[enemy.type]!.tags);
  return mods.length ? (applyModifiers({ speed: enemy.speed }, mods).speed ?? enemy.speed) : enemy.speed;
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
    fuel: toTicks(st.fuel),
    ammo: st.ammo,
    cooldowns: cfg.weapons.map(() => 0),
    sorties: 0,
  };
}

/** Сколько тиков осталось до конца перезарядки; 0 вне фазы rearm. Конец — тот же порог, что в stepGroups (минимум один тик). */
export function rearmTicksLeft(w: { readonly content: Content }, g: GroupState): number {
  if (g.phase !== 'rearm') return 0;
  return Math.max(0, toTicks(groupStats(w, g).rearmTime) - g.phaseTick);
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

/** Каждое оружие бьёт самого опасного (enemyThreat) врага с целевым тегом внутри зоны; выстрел расходует боекомплект. */
function fire(sim: Sim, g: GroupState, st: GroupStats): void {
  const s = sim.state;
  st.weapons.forEach((weapon, i) => {
    if (g.ammo <= 0 || g.cooldowns[i]! > 0 || weapon.damage <= 0 || weapon.fireRate <= 0) return;
    let target: EnemyState | undefined;
    for (const e of s.enemies) {
      if (!weaponHits(weapon, sim.content.enemies[e.type]!.tags)) continue;
      if (dist(e.pos, g.zone) <= st.zoneRadius && (!target || enemyThreat(sim, e) > enemyThreat(sim, target))) target = e;
    }
    if (!target) return;
    g.ammo--;
    g.lastShot = { enemy: target.id, tick: s.tick };
    g.cooldowns[i] = Math.max(1, Math.round(TICK_RATE / weapon.fireRate));
    s.events.push({ type: 'groupShot', group: g.id, enemy: target.id, damage: weapon.damage });
    damageEnemy(sim, target.id, weapon.damage, g.id);
  });
}

/**
 * Один тик цикла вылета всех групп. Топливо тратится в воздухе (перелёт, патруль, возврат);
 * группа уходит на возврат, когда остатка хватает только долететь до аэродрома, или когда кончился боекомплект.
 * Длительность взлёта и перезарядки — минимум один тик.
 * Ауры союзников меняют параметры на лету: радиус зоны, урон, скорость; аура на fuel растягивает бак —
 * топливо расходуется медленнее в own.fuel / st.fuel раз. Завершённый вылет приносит income группы в награду миссии.
 */
export function stepGroups(sim: Sim): void {
  const home = sim.mission.airfield;
  const sources = auraSources(sim);
  for (const g of sim.state.groups) {
    const cfg = groupConfig(sim.content, g.type);
    const own = groupStats(sim, g);
    const st = effectiveGroupStats(sim, g, sources);
    const stepLen = st.speed * DT;
    const burn = st.fuel > 0 ? own.fuel / st.fuel : 1;
    g.cooldowns = g.cooldowns.map((c) => Math.max(0, c - 1));
    g.phaseTick++;
    const tally = sim.state.stats.groups.find((t) => t.id === g.id);
    if (tally && g.phase === 'patrol') tally.patrolTicks++;
    const bingo = () => g.fuel <= flightTicks(g.pos, home, st.speed);
    switch (g.phase) {
      case 'takeoff':
        if (g.phaseTick >= toTicks(cfg.takeoffTime)) setPhase(g, 'transit');
        break;
      case 'transit':
        g.fuel -= burn;
        if (moveTo(g.pos, g.zone, stepLen)) setPhase(g, 'patrol');
        else if (bingo()) setPhase(g, 'return');
        break;
      case 'patrol':
        g.fuel -= burn;
        // Зону могли перенести: в патруле группа держится её центра.
        if (!moveTo(g.pos, g.zone, stepLen)) setPhase(g, 'transit');
        else fire(sim, g, st);
        if ((own.ammo > 0 && g.ammo <= 0) || bingo()) setPhase(g, 'return');
        break;
      case 'return':
        g.fuel = Math.max(0, g.fuel - burn);
        if (moveTo(g.pos, home, stepLen)) {
          g.sorties++;
          if (tally) tally.sorties++;
          sim.state.events.push({ type: 'sortieDone', group: g.id, sortie: g.sorties });
          if (st.income > 0) {
            sim.state.money += st.income;
            sim.state.income += st.income;
            sim.state.events.push({ type: 'income', group: g.id, amount: st.income });
          }
          setPhase(g, 'rearm');
        }
        break;
      case 'rearm':
        if (g.phaseTick >= toTicks(own.rearmTime)) {
          g.fuel = toTicks(own.fuel);
          g.ammo = own.ammo;
          setPhase(g, 'takeoff');
        }
        break;
    }
  }
}
