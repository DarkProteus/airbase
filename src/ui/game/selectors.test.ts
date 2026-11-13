import { describe, expect, test } from 'vitest';
import { CONTENT, MISSIONS, UNITS } from '../../content';
import { createSim, SELL_REFUND, snapshot, step } from '../../sim';
import type { Command, SimEvent } from '../../sim';
import { hudLine, REJECT_TEXT, rejectionNotice, shopItems, slotClick, unitPanel, world } from './selectors';

const mission = MISSIONS.sortie!;
const play = (money: number, ...commands: Command[]) => {
  const sim = createSim({ ...mission, startMoney: money }, CONTENT, 1);
  step(sim, commands);
  return world(mission, CONTENT, snapshot(sim));
};

describe('магазин', () => {
  test('по карточке на юнит реестра; недоступные по деньгам помечены', () => {
    const w = play(100);
    const items = shopItems(CONTENT, w.state);
    expect(items.map((i) => i.unit.id)).toEqual(Object.keys(UNITS));
    expect(items.map((i) => [i.unit.id, i.affordable])).toEqual([['f16', true], ['growler', false], ['c130', true]]);
  });

  test('доступность следует за деньгами', () => {
    const w = play(1000, { type: 'buy', unit: 'f16', slot: 0 });
    expect(shopItems(CONTENT, w.state).every((i) => i.affordable === (w.state.money >= i.unit.cost))).toBe(true);
  });
});

describe('панель юнита', () => {
  test('уровень, цена улучшения и возврат от продажи берутся из sim/конфига', () => {
    const f16 = UNITS.f16!;
    const w = play(1000, { type: 'buy', unit: 'f16', slot: 0 });
    const p = unitPanel(w, 1)!;
    expect(p.view.level).toBe(0);
    expect(p.upgradeCost).toBe(f16.upgrades[0]!.cost);
    expect(p.upgradeBlocked).toBeUndefined();
    expect(p.refund).toBe(Math.floor(f16.cost * SELL_REFUND));

    const up = unitPanel(play(1000, { type: 'buy', unit: 'f16', slot: 0 }, { type: 'upgrade', unit: 1 }), 1)!;
    expect(up.view.level).toBe(1);
    expect(up.view.stats.damage).toBeCloseTo(f16.stats.damage! * 1.4);
    expect(up.upgradeCost).toBe(f16.upgrades[1]!.cost);
    expect(up.refund).toBe(Math.floor((f16.cost + f16.upgrades[0]!.cost) * SELL_REFUND));
  });

  test('улучшение заблокировано: нет денег и максимальный уровень', () => {
    const poor = unitPanel(play(100, { type: 'buy', unit: 'f16', slot: 0 }), 1)!;
    expect(poor.upgradeBlocked).toBe('money');
    const maxed = unitPanel(play(1000, { type: 'buy', unit: 'c130', slot: 0 }, { type: 'upgrade', unit: 1 }), 1)!;
    expect(maxed.upgradeCost).toBeUndefined();
    expect(maxed.upgradeBlocked).toBe('maxLevel');
  });

  test('нет юнита — нет панели', () => {
    expect(unitPanel(play(1000), 1)).toBeNull();
    expect(unitPanel(play(1000), null)).toBeNull();
  });
});

describe('клик по слоту', () => {
  test('занятый слот выбирает юнит', () => {
    const w = play(1000, { type: 'buy', unit: 'f16', slot: 2 });
    expect(slotClick(w, 'c130', 2)).toEqual({ kind: 'select', unit: 1 });
  });

  test('свободный слот без выбранной карточки — подсказка', () => {
    expect(slotClick(play(1000), null, 0).kind).toBe('hint');
  });

  test('свободный слот с выбранной карточкой — команда buy; отказ предсказан теми же проверками sim', () => {
    expect(slotClick(play(1000), 'f16', 3)).toEqual({ kind: 'buy', command: { type: 'buy', unit: 'f16', slot: 3 }, rejection: undefined });
    expect(slotClick(play(50), 'f16', 3)).toMatchObject({ kind: 'buy', rejection: 'money' });
  });
});

describe('тексты', () => {
  test('текст на любой отказ из событий; без отказов — undefined', () => {
    const ev = (reason: keyof typeof REJECT_TEXT): SimEvent => ({ type: 'rejected', command: { type: 'sell', unit: 1 }, reason });
    expect(rejectionNotice([{ type: 'bought', unit: 1 }])).toBeUndefined();
    expect(rejectionNotice([ev('money')])).toBe(REJECT_TEXT.money);
    expect(rejectionNotice([ev('slot'), ev('maxLevel')])).toBe(REJECT_TEXT.maxLevel);
  });

  test('строка HUD', () => {
    const w = play(300);
    expect(hudLine(mission, w.state)).toContain('$ 300');
    expect(hudLine(mission, { ...w.state, status: 'lost' })).toContain('поражение');
  });
});
