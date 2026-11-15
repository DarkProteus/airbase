import { describe, expect, test } from 'vitest';
import { CONTENT, DEFAULT_LINEUP, GROUPS, MISSIONS } from '../../content';
import { createSim, groupStats, snapshot, step, TICK_RATE } from '../../sim';
import type { Command, SimEvent } from '../../sim';
import { groupRows, hudLine, objectiveInfo, PHASE_LABEL, REJECT_TEXT, rejectionNotice, world, zoneClick } from './selectors';

const mission = MISSIONS.evac!;
const play = (...commands: Command[]) => {
  const sim = createSim(mission, CONTENT, 1);
  step(sim, commands);
  return world(mission, CONTENT, snapshot(sim));
};

describe('тексты', () => {
  test('текст на любой отказ из событий; без отказов — undefined', () => {
    const ev = (reason: keyof typeof REJECT_TEXT): SimEvent => ({ type: 'rejected', command: { type: 'setZone', group: 1, zone: { x: 0, y: 0 } }, reason });
    expect(rejectionNotice([{ type: 'waveStart', wave: 0 }])).toBeUndefined();
    expect(rejectionNotice([ev('outOfMap')])).toBe(REJECT_TEXT.outOfMap);
    expect(rejectionNotice([ev('outOfMap'), ev('unknownGroup')])).toBe(REJECT_TEXT.unknownGroup);
  });

  test('строка HUD: награда, цель миссии, исход', () => {
    const w = play();
    expect(hudLine(mission, { ...w.state, money: 300 })).toContain('награда 300');
    expect(hudLine(mission, { ...w.state, status: 'lost' })).toContain('поражение');
    expect(hudLine(mission, w.state)).toContain('объект 20/20');
    // Миссия без цели показывает жизни базы.
    const { objective: _, ...noGoal } = mission;
    const { objective: __, ...state } = w.state;
    expect(hudLine({ ...noGoal, path: [{ x: 0, y: 0 }, { x: 1, y: 0 }] }, state)).toContain('жизни 1');
    expect(objectiveInfo(noGoal, state)).toBeUndefined();
  });

  test('цель миссии: прочность и остаток до победы из снапшота', () => {
    const at = (id: string, ticks: number) => {
      // Без волн: прочность меняет только сам тест.
      const m = { ...MISSIONS[id]!, waves: [] };
      const sim = createSim(m, CONTENT, 1);
      for (let i = 0; i < ticks; i++) step(sim);
      sim.state.objective!.hp -= 5;
      return { m, s: snapshot(sim) };
    };
    const evac = at('evac', 3 * TICK_RATE);
    expect(objectiveInfo(evac.m, evac.s)).toEqual({ type: 'defend', hp: 15, maxHp: 20, progress: 3 / 90, left: 87 });
    expect(hudLine(evac.m, evac.s)).toContain('объект 15/20 · держаться 87 с');
    expect(hudLine(evac.m, evac.s)).not.toContain('жизни');

    const convoy = at('convoy', 20 * TICK_RATE);
    const info = objectiveInfo(convoy.m, convoy.s)!;
    expect(info).toMatchObject({ type: 'escort', hp: 19, maxHp: 24 });
    // 5 клеток из 21 за 20 с при скорости 0,25.
    expect(info.left).toBeCloseTo(16, 6);
    expect(info.progress).toBeCloseTo(5 / 21, 6);
    expect(hudLine(convoy.m, convoy.s)).toContain('колонна 19/24 · путь 23%');
  });
});

describe('панель авиагрупп', () => {
  const fly = (ticks: number, ...commands: Command[]) => {
    const sim = createSim(mission, CONTENT, 1, DEFAULT_LINEUP);
    step(sim, commands);
    for (let i = 1; i < ticks; i++) step(sim);
    return { sim, w: world(mission, CONTENT, snapshot(sim)) };
  };
  const untilPhase = (phase: string) => {
    const sim = createSim(mission, CONTENT, 1, DEFAULT_LINEUP);
    for (let i = 0; sim.state.groups[0]!.phase !== phase; i++) {
      if (i > 1e5) throw new Error('no phase');
      step(sim);
    }
    return world(mission, CONTENT, snapshot(sim));
  };

  test('по строке на группу состава: имя из конфига, фаза, полный бак и боекомплект на взлёте', () => {
    const rows = groupRows(fly(1).w);
    expect(rows.map((r) => [r.name, r.phase, r.phaseLabel])).toEqual(
      DEFAULT_LINEUP.map((e) => [GROUPS[e.group]!.name, 'takeoff', PHASE_LABEL.takeoff]),
    );
    const f16 = GROUPS.f16!;
    expect(rows[0]).toMatchObject({
      fuel: { seconds: f16.fuel, ratio: 1 },
      ammo: { left: f16.ammo, max: f16.ammo },
      rearmSeconds: null,
      zoneRadius: f16.zoneRadius,
    });
  });

  test('без состава — пустой список', () => {
    expect(groupRows(play())).toEqual([]);
  });

  test('в полёте топливо убывает по тикам, доля согласована с секундами', () => {
    const w = untilPhase('patrol');
    const r = groupRows(w)[0]!;
    const g = w.state.groups[0]!;
    expect(r.phase).toBe('patrol');
    expect(r.fuel.seconds).toBeCloseTo(g.fuel / TICK_RATE);
    expect(r.fuel.ratio).toBeCloseTo(r.fuel.seconds / GROUPS.f16!.fuel);
    expect(r.fuel.ratio).toBeLessThan(1);
    expect(r.rearmSeconds).toBeNull();
  });

  test('боекомплект: остаток уменьшается после выстрелов, максимум — из статов группы', () => {
    const g0 = createSim(mission, CONTENT, 1, DEFAULT_LINEUP).state.groups[0]!;
    const w = { ...untilPhase('patrol') };
    w.state = { ...w.state, groups: w.state.groups.map((g) => ({ ...g, ammo: g.ammo - 5 })) };
    const r = groupRows(w)[0]!;
    expect(r.ammo).toEqual({ left: g0.ammo - 5, max: groupStats(w, g0).ammo });
  });

  test('время до конца перезарядки — только в фазе rearm и убывает до нуля', () => {
    // Зоны у объекта: без команд игрока матч должен длиться дольше первого вылета.
    const sim = createSim(mission, CONTENT, 1, DEFAULT_LINEUP.map((e) => ({ ...e, zone: { x: 5, y: 5 } })));
    const left: number[] = [];
    const g = sim.state.groups[0]!;
    for (let i = 0; !(g.sorties === 1 && g.phase === 'takeoff'); i++) {
      if (i > 1e5) throw new Error('rearm not finished');
      step(sim);
      const r = groupRows(world(mission, CONTENT, sim.state))[0]!;
      if (r.phase === 'rearm') left.push(r.rearmSeconds!);
      else expect(r.rearmSeconds).toBeNull();
    }
    expect(left.length).toBeGreaterThan(2);
    expect(left[0]!).toBeCloseTo(GROUPS.f16!.rearmTime);
    expect(left.at(-1)).toBeCloseTo(1 / TICK_RATE); // следующий тик завершает перезарядку
    expect([...left].sort((a, b) => b - a)).toEqual(left);
  });
});

describe('клик по карте при выбранной группе', () => {
  const w = world(mission, CONTENT, snapshot(createSim(mission, CONTENT, 1, DEFAULT_LINEUP)));

  test('группа не выбрана — не наше действие', () => {
    expect(zoneClick(w, null, { x: 3, y: 3 })).toBeNull();
  });

  test('выбрана — команда setZone в клетку; отказы предсказаны теми же проверками sim', () => {
    expect(zoneClick(w, 1, { x: 3, y: 3 })).toEqual({ command: { type: 'setZone', group: 1, zone: { x: 3, y: 3 } }, rejection: undefined });
    expect(zoneClick(w, 1, { x: -1, y: 3 })).toMatchObject({ rejection: 'outOfMap' });
    expect(zoneClick(w, 99, { x: 3, y: 3 })).toMatchObject({ rejection: 'unknownGroup' });
  });

  test('команда из клика переносит зону в sim', () => {
    const sim = createSim(mission, CONTENT, 1, DEFAULT_LINEUP);
    step(sim, [zoneClick(world(mission, CONTENT, sim.state), 2, { x: 9, y: 2 })!.command]);
    expect(sim.state.groups[1]!.zone).toEqual({ x: 9, y: 2 });
  });
});
