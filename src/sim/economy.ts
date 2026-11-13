import type { SimState } from './engine';
import type { AirGroupConfig, Content, MissionConfig } from './types';

/** Причина отказа команды боя: зоны патрулирования. */
export type RejectReason = 'unknownGroup' | 'outOfMap';

/** Всё, что нужно проверкам: Sim подходит как есть, UI собирает из миссии, контента и снапшота. */
export interface World {
  readonly mission: MissionConfig;
  readonly content: Content;
  readonly state: SimState;
}

/** Цены и уровни групп — чистые расчёты по конфигу: ими пользуется экран базы, в бою покупок нет. */
export const maxLevel = (cfg: AirGroupConfig): number => cfg.upgrades.length;

/** Цена следующего уровня; undefined — улучшать некуда. */
export const nextUpgradeCost = (cfg: AirGroupConfig, level: number): number | undefined => cfg.upgrades[level]?.cost;

/** Сколько всего вложено в группу: цена покупки + купленные уровни. */
export const invested = (cfg: AirGroupConfig, level: number): number =>
  cfg.cost + cfg.upgrades.slice(0, level).reduce((sum, u) => sum + u.cost, 0);
