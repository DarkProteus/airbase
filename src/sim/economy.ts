import type { SimState } from './engine';
import type { AirGroupConfig, Content, MissionConfig, UpgradeConfig, UpgradeOption } from './types';

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

/** Номер уровня (с 1), покупка которого — развилка специализаций; undefined — у группы развилки нет. */
export const forkLevel = (cfg: AirGroupConfig): number | undefined => {
  const i = cfg.upgrades.findIndex((u) => u.options);
  return i < 0 ? undefined : i + 1;
};

/** Варианты развилки, если следующее улучшение с уровня `level` — развилка. */
export const nextOptions = (cfg: AirGroupConfig, level: number): UpgradeOption[] | undefined => cfg.upgrades[level]?.options;

/** Выбранный вариант уровня-развилки; не указан или неизвестен (старое сохранение, рассинхрон) — первый вариант. */
export const pickOption = (upgrade: UpgradeConfig, spec?: string): UpgradeOption | undefined =>
  upgrade.options && (upgrade.options.find((o) => o.id === spec) ?? upgrade.options[0]);

/** Действующая специализация на уровне `level`: вариант развилки, если она уже куплена, иначе undefined. */
export function activeSpec(cfg: AirGroupConfig, level: number, spec?: string): UpgradeOption | undefined {
  const upgrade = cfg.upgrades.slice(0, level).find((u) => u.options);
  return upgrade && pickOption(upgrade, spec);
}
