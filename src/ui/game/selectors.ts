import { activeSpec, effectiveGroupStats, groupStats, objectiveGoal, objectiveRoute, rearmTicksLeft, TICK_RATE, toTicks, zoneRejection } from '../../sim';
import { attackLinks, groupTargetKinds, targetKind } from './markup';
import type { TargetKind } from './markup';
import type { Command, Content, MissionConfig, ObjectiveConfig, RejectReason, SimEvent, SimState, SortiePhase, Vec2, World } from '../../sim';

/**
 * Чистые селекторы UI: из снапшота, миссии и конфигов считают строки HUD и подсказки.
 * Сами правила (допустима ли зона) — функции sim, те же, что применяет движок.
 */

export const world = (mission: MissionConfig, content: Content, state: SimState): World => ({ mission, content, state });

export const REJECT_TEXT: Record<RejectReason, string> = {
  unknownGroup: 'Авиагруппа не найдена',
  outOfMap: 'Зона вне карты',
};

/** Текст последнего отказа среди событий тика (undefined — отказов не было). */
export function rejectionNotice(events: readonly SimEvent[]): string | undefined {
  const rejected = events.filter((e): e is Extract<SimEvent, { type: 'rejected' }> => e.type === 'rejected');
  const last = rejected.at(-1);
  return last && REJECT_TEXT[last.reason];
}

export const PHASE_TEXT = { prep: 'подготовка', wave: 'волна' } as const;
export const STATUS_TEXT = { running: '', won: 'победа', lost: 'поражение' } as const;

/** Состояние цели миссии для HUD: прочность и прогресс к победе; undefined — у миссии нет цели. */
export interface ObjectiveInfo {
  type: ObjectiveConfig['type'];
  hp: number;
  maxHp: number;
  /** Доля пути к победе, 0..1. */
  progress: number;
  /** Сколько осталось до победы в единицах цели: defend — секунд, escort — клеток маршрута. */
  left: number;
}

export function objectiveInfo(mission: MissionConfig, s: SimState): ObjectiveInfo | undefined {
  const cfg = mission.objective;
  const st = s.objective;
  if (!cfg || !st) return undefined;
  const goal = objectiveGoal(cfg, objectiveRoute(cfg));
  const left = Math.max(0, goal - st.progress);
  return {
    type: cfg.type,
    hp: Math.max(0, st.hp),
    maxHp: cfg.hp,
    progress: goal > 0 ? Math.min(1, st.progress / goal) : 1,
    left: cfg.type === 'defend' ? left / TICK_RATE : left,
  };
}

/** Подписи цели по типу: имя и остаток до победы. Новый тип цели — новая строка здесь. */
export const OBJECTIVE_TEXT: Record<ObjectiveConfig['type'], { name: string; left: (o: ObjectiveInfo) => string }> = {
  defend: { name: 'объект', left: (o) => `держаться ${Math.ceil(o.left)} с` },
  escort: { name: 'колонна', left: (o) => `путь ${Math.floor(o.progress * 100)}%` },
};

/** Строка HUD из снапшота: у миссии с целью вместо жизней базы — прочность цели и остаток до победы. */
export function hudLine(mission: MissionConfig, s: SimState): string {
  const o = objectiveInfo(mission, s);
  const goal = o ? `${OBJECTIVE_TEXT[o.type].name} ${o.hp}/${o.maxHp} · ${OBJECTIVE_TEXT[o.type].left(o)}` : `жизни ${s.lives}`;
  const parts = [`награда ${s.money}`, goal, `волна ${s.wave}/${mission.waves.length} (${PHASE_TEXT[s.phase]})`];
  if (s.status !== 'running') parts.push(STATUS_TEXT[s.status]);
  return parts.join(' · ');
}

export const PHASE_LABEL: Record<SortiePhase, string> = {
  takeoff: 'взлёт',
  transit: 'перелёт',
  patrol: 'патруль',
  return: 'возврат',
  rearm: 'перезарядка',
};

/** Строка HUD по авиагруппе: всё из снапшота и конфига, секунды и доли — готовые к показу числа. */
export interface GroupRow {
  id: number;
  name: string;
  phase: SortiePhase;
  phaseLabel: string;
  /** Остаток топлива: секунды полёта и доля от полного бака (0..1). */
  fuel: { seconds: number; ratio: number };
  /** Остаток и максимум боекомплекта на вылет. */
  ammo: { left: number; max: number };
  /** Секунд до конца перезарядки; null вне фазы rearm. */
  rearmSeconds: number | null;
  /** Название действующей специализации (куплена развилка улучшений); нет — undefined. */
  spec: string | undefined;
  /** Радиус зоны патрулирования в клетках (после модификаторов и аур союзников). */
  zoneRadius: number;
  /** Цвет группы из конфига: им же рисуются её зона и трассеры. */
  color: string | undefined;
  /** Типы целей, которые бьёт её оружие; пусто — группа не стреляет. */
  targets: TargetKind[];
  /** Кого атакует сейчас (недавний выстрел по живому врагу); null — никого. */
  attack: { enemyName: string; kind: TargetKind | undefined } | null;
}

export function groupRows(w: World): GroupRow[] {
  const links = attackLinks(w.state);
  return w.state.groups.map((g) => {
    const st = groupStats(w, g);
    const cfg = w.content.groups[g.type];
    const link = links.find((l) => l.group === g.id);
    const target = link && w.state.enemies.find((e) => e.id === link.enemy);
    const enemyCfg = target && w.content.enemies[target.type];
    const capacity = toTicks(st.fuel);
    return {
      id: g.id,
      name: w.content.groups[g.type]?.name ?? g.type,
      phase: g.phase,
      phaseLabel: PHASE_LABEL[g.phase],
      fuel: { seconds: g.fuel / TICK_RATE, ratio: capacity > 0 ? Math.min(1, g.fuel / capacity) : 0 },
      ammo: { left: g.ammo, max: st.ammo },
      rearmSeconds: g.phase === 'rearm' ? rearmTicksLeft(w, g) / TICK_RATE : null,
      spec: cfg && activeSpec(cfg, g.level, g.spec)?.name,
      zoneRadius: effectiveGroupStats(w, g).zoneRadius,
      color: cfg?.visual?.color,
      targets: cfg ? groupTargetKinds(cfg) : [],
      attack: enemyCfg ? { enemyName: enemyCfg.name, kind: targetKind(enemyCfg.tags) } : null,
    };
  });
}

export type ZoneAction = { command: Command; rejection: RejectReason | undefined };

/** Клик по карте при выбранной группе: команда setZone и предсказанный теми же проверками sim отказ. null — группа не выбрана. */
export function zoneClick(w: World, group: number | null, cell: Vec2): ZoneAction | null {
  if (group === null) return null;
  return { command: { type: 'setZone', group, zone: { x: cell.x, y: cell.y } }, rejection: zoneRejection(w, group, cell) };
}
