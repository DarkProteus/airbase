import type { SimState, UnitState } from './engine';
import type { Content, MissionConfig } from './types';

/** Доля вложенного (покупка + купленные улучшения), возвращаемая при продаже; округление вниз. */
export const SELL_REFUND = 0.5;

/** Причина отказа команды экономики. */
export type RejectReason = 'money' | 'slot' | 'unknown' | 'maxLevel';

/** Всё, что нужно проверкам: Sim подходит как есть, UI собирает из миссии, контента и снапшота. */
export interface World {
  readonly mission: MissionConfig;
  readonly content: Content;
  readonly state: SimState;
}

/** Проверки живут здесь: движок применяет команду только при их успехе, UI вызывает те же функции для подсказок. */
export function buyRejection(w: World, unit: string, slot: number): RejectReason | undefined {
  const cfg = w.content.units[unit];
  if (!cfg) return 'unknown';
  if (!w.mission.slots[slot] || w.state.units.some((u) => u.slot === slot)) return 'slot';
  if (w.state.money < cfg.cost) return 'money';
  return undefined;
}

/** Цена следующего уровня; undefined — улучшать некуда. */
export function nextUpgradeCost(w: World, unit: UnitState): number | undefined {
  return w.content.units[unit.type]?.upgrades[unit.level]?.cost;
}

export function upgradeRejection(w: World, unitId: number): RejectReason | undefined {
  const u = w.state.units.find((x) => x.id === unitId);
  if (!u || !w.content.units[u.type]) return 'unknown';
  const cost = nextUpgradeCost(w, u);
  if (cost === undefined) return 'maxLevel';
  return w.state.money < cost ? 'money' : undefined;
}

/** Сколько всего вложено в юнит: цена покупки + купленные уровни. */
export function invested(w: World, unit: UnitState): number {
  const cfg = w.content.units[unit.type]!;
  return cfg.cost + cfg.upgrades.slice(0, unit.level).reduce((sum, g) => sum + g.cost, 0);
}

export const sellRefund = (w: World, unit: UnitState): number => Math.floor(invested(w, unit) * SELL_REFUND);
