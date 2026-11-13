import { buyRejection, nextUpgradeCost, sellRefund, upgradeRejection } from '../../sim';
import type { Command, Content, MissionConfig, RejectReason, SimEvent, SimState, UnitConfig, UnitState, World } from '../../sim';
import { viewUnit } from '../entity/model';
import type { UnitView } from '../entity/model';

/**
 * Чистые селекторы UI: из снапшота, миссии и конфигов считают цены/доступность/тексты.
 * Сами правила (хватает ли денег, свободен ли слот) — функции sim, те же, что применяет движок.
 */

export const world = (mission: MissionConfig, content: Content, state: SimState): World => ({ mission, content, state });

export const REJECT_TEXT: Record<RejectReason, string> = {
  money: 'Не хватает денег',
  slot: 'Слот занят или недоступен',
  unknown: 'Юнит не найден',
  maxLevel: 'Максимальный уровень',
};

export interface ShopItem {
  unit: UnitConfig;
  /** Хватает ли денег на покупку (слот не учитывается: он выбирается позже). */
  affordable: boolean;
}

export function shopItems(content: Content, state: SimState): ShopItem[] {
  return Object.values(content.units).map((unit) => ({ unit, affordable: state.money >= unit.cost }));
}

export interface UnitPanelModel {
  unit: UnitState;
  config: UnitConfig;
  /** Статы и уровень юнита на его текущем уровне для универсальной карточки. */
  view: UnitView;
  /** Цена следующего улучшения; undefined — максимум. */
  upgradeCost: number | undefined;
  /** Почему улучшить нельзя (undefined — можно). */
  upgradeBlocked: RejectReason | undefined;
  /** Сколько вернёт продажа. */
  refund: number;
}

export function unitPanel(w: World, unitId: number | null): UnitPanelModel | null {
  const unit = w.state.units.find((u) => u.id === unitId);
  const config = unit && w.content.units[unit.type];
  if (!unit || !config) return null;
  return {
    unit,
    config,
    view: viewUnit(config, unit.level),
    upgradeCost: nextUpgradeCost(w, unit),
    upgradeBlocked: upgradeRejection(w, unit.id),
    refund: sellRefund(w, unit),
  };
}

export type SlotAction =
  | { kind: 'select'; unit: number }
  | { kind: 'buy'; command: Command; rejection: RejectReason | undefined }
  | { kind: 'hint'; text: string };

export const SELECT_HINT = 'Выберите юнит в магазине';

/** Что делает клик по слоту: занятый — выбирает юнит; свободный — ставит выбранную карточку магазина. */
export function slotClick(w: World, shop: string | null, slot: number): SlotAction {
  const occupant = w.state.units.find((u) => u.slot === slot);
  if (occupant) return { kind: 'select', unit: occupant.id };
  if (shop === null) return { kind: 'hint', text: SELECT_HINT };
  return { kind: 'buy', command: { type: 'buy', unit: shop, slot }, rejection: buyRejection(w, shop, slot) };
}

/** Текст последнего отказа среди событий тика (undefined — отказов не было). */
export function rejectionNotice(events: readonly SimEvent[]): string | undefined {
  const rejected = events.filter((e): e is Extract<SimEvent, { type: 'rejected' }> => e.type === 'rejected');
  const last = rejected.at(-1);
  return last && REJECT_TEXT[last.reason];
}

const PHASE_TEXT = { prep: 'подготовка', wave: 'волна' } as const;
const STATUS_TEXT = { running: '', won: 'победа', lost: 'поражение' } as const;

/** Строка HUD из снапшота. */
export function hudLine(mission: MissionConfig, s: SimState): string {
  const parts = [`$ ${s.money}`, `жизни ${s.lives}`, `волна ${s.wave}/${mission.waves.length} (${PHASE_TEXT[s.phase]})`];
  if (s.status !== 'running') parts.push(STATUS_TEXT[s.status]);
  return parts.join(' · ');
}
