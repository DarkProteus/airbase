import { describe, expect, test } from 'vitest';
import { CONTENT, UNITS } from '../content';
import { buyRejection, createSim, invested, nextUpgradeCost, SELL_REFUND, sellRefund, snapshot, step, unitStats, upgradeRejection } from '.';
import type { Command, Content, MissionConfig, Sim, SimEvent } from '.';

/** Мишень-враг нужна только для валидности миссии; волна далеко (prep большой), чтобы экономика не шумела. */
const content: Content = {
  units: CONTENT.units,
  enemies: { e: { id: 'e', name: 'E', hp: 10, speed: 1, reward: 0, leakDamage: 1, tags: [] } },
};
const mission = (over: Partial<MissionConfig> = {}): MissionConfig => ({
  id: 'm',
  name: 'M',
  size: { w: 21, h: 3 },
  path: [{ x: 0, y: 0 }, { x: 20, y: 0 }],
  slots: [{ x: 5, y: 1 }, { x: 8, y: 1 }, { x: 11, y: 1 }],
  startMoney: 1000,
  baseLives: 10,
  waves: [{ prep: 1000, groups: [{ enemy: 'e', count: 1, interval: 0 }] }],
  ...over,
});

/** Применяет команды одним тиком и возвращает события этого тика. */
const cmd = (sim: Sim, ...commands: Command[]): SimEvent[] => {
  step(sim, commands);
  return sim.state.events;
};
const rejected = (events: SimEvent[]) => events.filter((e) => e.type === 'rejected').map((e) => (e as Extract<SimEvent, { type: 'rejected' }>).reason);

describe('покупка', () => {
  test('списывает цену, ставит юнит на уровне 0 в слот', () => {
    const sim = createSim(mission(), content, 1);
    const ev = cmd(sim, { type: 'buy', unit: 'f16', slot: 1 });
    expect(sim.state.money).toBe(1000 - UNITS.f16!.cost);
    expect(sim.state.units).toEqual([{ id: 1, type: 'f16', slot: 1, level: 0, cooldown: 0 }]);
    expect(ev).toContainEqual({ type: 'bought', unit: 1 });
  });

  test('отказ при нехватке денег: ничего не меняется, событие rejected/money', () => {
    const sim = createSim(mission({ startMoney: UNITS.f16!.cost - 1 }), content, 1);
    const ev = cmd(sim, { type: 'buy', unit: 'f16', slot: 0 });
    expect(rejected(ev)).toEqual(['money']);
    expect(sim.state.money).toBe(UNITS.f16!.cost - 1);
    expect(sim.state.units).toEqual([]);
  });

  test('отказ при занятом слоте и несуществующем слоте/юните', () => {
    const sim = createSim(mission(), content, 1);
    cmd(sim, { type: 'buy', unit: 'f16', slot: 0 });
    const money = sim.state.money;
    expect(rejected(cmd(sim, { type: 'buy', unit: 'c130', slot: 0 }))).toEqual(['slot']);
    expect(rejected(cmd(sim, { type: 'buy', unit: 'c130', slot: 9 }))).toEqual(['slot']);
    expect(rejected(cmd(sim, { type: 'buy', unit: 'nope', slot: 1 }))).toEqual(['unknown']);
    expect(sim.state.money).toBe(money);
    expect(sim.state.units).toHaveLength(1);
  });

  test('работает и во время волны', () => {
    const sim = createSim(mission({ waves: [{ prep: 0, groups: [{ enemy: 'e', count: 1, interval: 0 }] }] }), content, 1);
    step(sim);
    expect(sim.state.phase).toBe('wave');
    cmd(sim, { type: 'buy', unit: 'f16', slot: 0 });
    expect(sim.state.units).toHaveLength(1);
  });
});

describe('улучшение', () => {
  test('списывает цену следующего уровня и повышает уровень по очереди до максимума', () => {
    const f16 = UNITS.f16!;
    const sim = createSim(mission(), content, 1);
    cmd(sim, { type: 'buy', unit: 'f16', slot: 0 });
    let money = sim.state.money;
    f16.upgrades.forEach((g, i) => {
      const ev = cmd(sim, { type: 'upgrade', unit: 1 });
      money -= g.cost;
      expect(sim.state.money).toBe(money);
      expect(sim.state.units[0]!.level).toBe(i + 1);
      expect(ev).toContainEqual({ type: 'upgraded', unit: 1, level: i + 1 });
    });
  });

  test('отказ: нехватка денег, максимальный уровень, неизвестный юнит', () => {
    const sim = createSim(mission({ startMoney: UNITS.c130!.cost + UNITS.c130!.upgrades[0]!.cost - 1 }), content, 1);
    cmd(sim, { type: 'buy', unit: 'c130', slot: 0 });
    const money = sim.state.money;
    expect(rejected(cmd(sim, { type: 'upgrade', unit: 1 }))).toEqual(['money']);
    expect(rejected(cmd(sim, { type: 'upgrade', unit: 42 }))).toEqual(['unknown']);
    expect(sim.state.money).toBe(money);
    expect(sim.state.units[0]!.level).toBe(0);

    const rich = createSim(mission(), content, 1);
    cmd(rich, { type: 'buy', unit: 'c130', slot: 0 }, { type: 'upgrade', unit: 1 });
    const after = rich.state.money;
    expect(rejected(cmd(rich, { type: 'upgrade', unit: 1 }))).toEqual(['maxLevel']);
    expect(rich.state.money).toBe(after);
  });

  test('уровень меняет статы юнита (данные UnitConfig.upgrades, без ветвлений по id)', () => {
    const f16 = UNITS.f16!;
    const sim = createSim(mission(), content, 1);
    cmd(sim, { type: 'buy', unit: 'f16', slot: 0 });
    const u = sim.state.units[0]!;
    expect(unitStats(sim, u).damage).toBe(f16.stats.damage);
    cmd(sim, { type: 'upgrade', unit: u.id });
    expect(unitStats(sim, u).damage).toBeCloseTo(f16.stats.damage! * 1.4);
    expect(unitStats(sim, u).range).toBe(f16.stats.range);
    cmd(sim, { type: 'upgrade', unit: u.id });
    expect(unitStats(sim, u).range).toBe(f16.stats.range! + 1);
  });

  test('улучшение экономики увеличивает доход волны', () => {
    const c130 = UNITS.c130!;
    const sim = createSim(mission({ waves: [{ prep: 1, groups: [{ enemy: 'e', count: 1, interval: 0 }] }] }), content, 1);
    cmd(sim, { type: 'buy', unit: 'c130', slot: 0 }, { type: 'upgrade', unit: 1 });
    const before = sim.state.money;
    let income = 0;
    for (let i = 0; i < 60 && !income; i++) {
      step(sim);
      for (const e of sim.state.events) if (e.type === 'income') income = e.amount;
    }
    expect(income).toBe(c130.stats.income! + 25);
    expect(sim.state.money).toBe(before + income);
  });

  test('работает во время волны', () => {
    const sim = createSim(mission({ waves: [{ prep: 0, groups: [{ enemy: 'e', count: 1, interval: 0 }] }] }), content, 1);
    cmd(sim, { type: 'buy', unit: 'f16', slot: 0 });
    expect(sim.state.phase).toBe('wave');
    cmd(sim, { type: 'upgrade', unit: 1 });
    expect(sim.state.units[0]!.level).toBe(1);
  });
});

describe('продажа', () => {
  test('возвращает SELL_REFUND от цены покупки и купленных улучшений (вниз), освобождает слот', () => {
    expect(SELL_REFUND).toBe(0.5);
    const f16 = UNITS.f16!;
    const sim = createSim(mission(), content, 1);
    cmd(sim, { type: 'buy', unit: 'f16', slot: 2 }, { type: 'upgrade', unit: 1 });
    const spent = f16.cost + f16.upgrades[0]!.cost;
    expect(sim.state.money).toBe(1000 - spent);
    const ev = cmd(sim, { type: 'sell', unit: 1 });
    const refund = Math.floor(spent * SELL_REFUND);
    expect(sim.state.money).toBe(1000 - spent + refund);
    expect(sim.state.units).toEqual([]);
    expect(ev).toContainEqual({ type: 'sold', unit: 1, refund });
    // слот свободен снова
    cmd(sim, { type: 'buy', unit: 'f16', slot: 2 });
    expect(sim.state.units).toHaveLength(1);
  });

  test('округление вниз при нечётной сумме', () => {
    const odd: Content = { ...content, units: { u: { id: 'u', name: 'U', role: 't', cost: 101, tags: [], stats: {}, modifiers: [], upgrades: [] } } };
    const sim = createSim(mission({ startMoney: 101 }), odd, 1);
    cmd(sim, { type: 'buy', unit: 'u', slot: 0 }, { type: 'sell', unit: 1 });
    expect(sim.state.money).toBe(50);
  });

  test('отказ для неизвестного юнита (в т.ч. уже проданного), деньги не меняются', () => {
    const sim = createSim(mission(), content, 1);
    expect(rejected(cmd(sim, { type: 'sell', unit: 7 }))).toEqual(['unknown']);
    cmd(sim, { type: 'buy', unit: 'f16', slot: 0 }, { type: 'sell', unit: 1 });
    const money = sim.state.money;
    expect(rejected(cmd(sim, { type: 'sell', unit: 1 }))).toEqual(['unknown']);
    expect(sim.state.money).toBe(money);
  });

  test('проданный юнит перестаёт стрелять и давать ауру/доход', () => {
    const sim = createSim(mission(), content, 1);
    cmd(sim, { type: 'buy', unit: 'f16', slot: 0 }, { type: 'buy', unit: 'growler', slot: 1 });
    const f16 = sim.state.units[0]!;
    expect(unitStats(sim, f16).fireRate).toBeCloseTo(UNITS.f16!.stats.fireRate! * 1.5);
    cmd(sim, { type: 'sell', unit: 2 });
    expect(unitStats(sim, f16).fireRate).toBe(UNITS.f16!.stats.fireRate);
  });
});

describe('чистые проверки (общие для движка и UI)', () => {
  test('совпадают с исходом команд и не мутируют состояние', () => {
    const sim = createSim(mission({ startMoney: 110 }), content, 1);
    const before = snapshot(sim);
    expect(buyRejection(sim, 'f16', 0)).toBeUndefined();
    expect(buyRejection(sim, 'growler', 0)).toBe('money');
    expect(buyRejection(sim, 'x', 0)).toBe('unknown');
    expect(buyRejection(sim, 'f16', 5)).toBe('slot');
    expect(sim.state).toEqual(before);

    cmd(sim, { type: 'buy', unit: 'f16', slot: 0 });
    const u = sim.state.units[0]!;
    expect(buyRejection(sim, 'f16', 0)).toBe('slot');
    expect(upgradeRejection(sim, u.id)).toBe('money');
    expect(nextUpgradeCost(sim, u)).toBe(UNITS.f16!.upgrades[0]!.cost);
    expect(invested(sim, u)).toBe(UNITS.f16!.cost);
    expect(sellRefund(sim, u)).toBe(Math.floor(UNITS.f16!.cost * SELL_REFUND));
  });

  test('детерминизм: одинаковые команды -> одинаковые состояния', () => {
    const run = () => {
      const sim = createSim(mission(), content, 7);
      step(sim, [{ type: 'buy', unit: 'f16', slot: 0 }, { type: 'buy', unit: 'c130', slot: 1 }]);
      step(sim, [{ type: 'upgrade', unit: 1 }, { type: 'sell', unit: 2 }]);
      return snapshot(sim);
    };
    expect(run()).toEqual(run());
  });
});
