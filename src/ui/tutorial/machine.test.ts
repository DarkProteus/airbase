import { describe, expect, test } from 'vitest';
import { CONTENT, DEFAULT_ZONES, LINEUP_SIZE, MISSIONS, START_PROFILE } from '../../content';
import { createSim, profileLineup, snapshot, step, TICK_RATE } from '../../sim';
import type { Command, Sim } from '../../sim';
import { initialTutorial, isFinished, observe, TUTORIAL_STEPS, tutorialStep } from './machine';
import type { Signal, TutorialInput, TutorialState } from './machine';

const sig = (signals: Signal[], tick = 0): TutorialInput => ({ type: 'signals', signals, tick });
const stepOf = (s: TutorialState) => (s.status === 'active' ? TUTORIAL_STEPS[s.step]!.id : s.status);
const at = (step: number, since = 0): TutorialState => ({ status: 'active', step, since });
const idx = (id: string) => TUTORIAL_STEPS.findIndex((s) => s.id === id);

describe('шаги обучения — данные', () => {
  test('есть выбор группы, перенос зоны, типы целей, топливо и перезарядка; id уникальны, тексты непусты', () => {
    const ids = TUTORIAL_STEPS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ['select', 'zone', 'targets', 'fuel', 'rearm']) expect(ids).toContain(id);
    for (const s of TUTORIAL_STEPS) expect(s.title && s.text).toBeTruthy();
  });

  test('последний шаг завершается кнопкой, остальные — сигналом', () => {
    expect(TUTORIAL_STEPS.at(-1)!.until).toBeNull();
    for (const s of TUTORIAL_STEPS.slice(0, -1)) expect(s.until).not.toBeNull();
  });
});

describe('автомат', () => {
  test('старт — первый шаг', () => {
    expect(stepOf(initialTutorial)).toBe('select');
  });

  test('действие игрока и события матча ведут по шагам по порядку', () => {
    let s: TutorialState = initialTutorial;
    s = tutorialStep(s, sig(['select'], 10));
    expect(stepOf(s)).toBe('zone');
    s = tutorialStep(s, sig(['select', 'zoneSet'], 20));
    expect(stepOf(s)).toBe('targets');
    s = tutorialStep(s, sig(['enemy'], 20 + 4 * TICK_RATE));
    expect(stepOf(s)).toBe('fuel');
    s = tutorialStep(s, sig(['return'], 100 * TICK_RATE));
    expect(stepOf(s)).toBe('rearm');
    s = tutorialStep(s, sig(['rearm'], 200 * TICK_RATE));
    expect(stepOf(s)).toBe('done');
    s = tutorialStep(s, { type: 'next', tick: 300 * TICK_RATE });
    expect(s).toEqual({ status: 'done' });
    expect(isFinished(s)).toBe(true);
  });

  test('чужой сигнал и пустой набор шаг не двигают (тот же объект)', () => {
    expect(tutorialStep(initialTutorial, sig(['zoneSet', 'enemy', 'return', 'rearm']))).toBe(initialTutorial);
    expect(tutorialStep(initialTutorial, sig([]))).toBe(initialTutorial);
  });

  test('за один вход — не больше одного шага, даже если все сигналы уже истинны', () => {
    const all: Signal[] = ['select', 'zoneSet', 'enemy', 'return', 'rearm'];
    const s = tutorialStep(initialTutorial, sig(all, 1000 * TICK_RATE));
    expect(stepOf(s)).toBe('zone');
  });

  test('сигнал-факт ждёт holdSeconds шага, «Далее» — нет', () => {
    const targets = idx('targets');
    const hold = TUTORIAL_STEPS[targets]!.holdSeconds!;
    expect(hold).toBeGreaterThan(0);
    const s = at(targets, 100);
    expect(tutorialStep(s, sig(['enemy'], 100 + hold * TICK_RATE - 1))).toBe(s);
    expect(stepOf(tutorialStep(s, sig(['enemy'], 100 + hold * TICK_RATE)))).toBe('fuel');
    expect(stepOf(tutorialStep(s, { type: 'next', tick: 101 }))).toBe('fuel');
  });

  test('следующий шаг отсчитывает показ от тика перехода', () => {
    const s = tutorialStep(at(idx('zone'), 0), sig(['zoneSet'], 500));
    expect(s).toEqual({ status: 'active', step: idx('targets'), since: 500 });
  });

  test('«Далее» на любом шаге переходит вперёд; на последнем завершает обучение', () => {
    expect(stepOf(tutorialStep(initialTutorial, { type: 'next', tick: 0 }))).toBe('zone');
    expect(tutorialStep(at(TUTORIAL_STEPS.length - 1), { type: 'next', tick: 0 })).toEqual({ status: 'done' });
  });

  test('«Пропустить» завершает обучение с любого шага', () => {
    for (let i = 0; i < TUTORIAL_STEPS.length; i++) expect(tutorialStep(at(i), { type: 'skip' })).toEqual({ status: 'skipped' });
  });

  test('после окончания входы игнорируются', () => {
    for (const end of [{ status: 'done' }, { status: 'skipped' }] as const) {
      expect(tutorialStep(end, { type: 'next', tick: 0 })).toBe(end);
      expect(tutorialStep(end, sig(['select']))).toBe(end);
      expect(tutorialStep(end, { type: 'skip' })).toBe(end);
    }
  });

  test('шаги — параметр: автомат работает на любом списке', () => {
    const steps = [{ id: 'a', title: 'A', text: 'a', until: 'select' as const }];
    expect(tutorialStep(initialTutorial, sig(['select']), steps)).toEqual({ status: 'done' });
  });
});

describe('observe: сигналы из снапшота матча', () => {
  const sim = (): Sim => createSim(MISSIONS.convoy!, CONTENT, 1, profileLineup(START_PROFILE, DEFAULT_ZONES.slice(0, LINEUP_SIZE)));
  const run = (s: Sim, ticks: number, commands: Command[] = []) => {
    const events = [];
    for (let i = 0; i < ticks; i++) {
      step(s, i === 0 ? commands : []);
      events.push(...s.state.events);
    }
    return { ...snapshot(s), events };
  };

  test('в начале матча сигналов нет; выбор группы даёт select', () => {
    const s = sim();
    expect(observe(snapshot(s), null)).toEqual([]);
    expect(observe(snapshot(s), s.state.groups[0]!.id)).toEqual(['select']);
  });

  test('перенос зоны командой sim — событие zoneSet; появление врагов — enemy', () => {
    const s = sim();
    const id = s.state.groups[0]!.id;
    const snap = run(s, 10 * TICK_RATE, [{ type: 'setZone', group: id, zone: { x: 3, y: 3 } }]);
    const signals = observe(snap, null);
    expect(signals).toContain('zoneSet');
    expect(signals).toContain('enemy');
  });

  test('группа на возврате и на перезарядке дают return и rearm', () => {
    const s = sim();
    const seen = new Set<Signal>();
    while (s.state.tick < 200 * TICK_RATE && !(seen.has('return') && seen.has('rearm'))) {
      step(s);
      for (const x of observe(snapshot(s), null)) seen.add(x);
    }
    expect(seen.has('return')).toBe(true);
    expect(seen.has('rearm')).toBe(true);
  });

  test('observe матч не меняет', () => {
    const s = sim();
    const before = JSON.stringify(snapshot(s));
    observe(snapshot(s), 1);
    expect(JSON.stringify(snapshot(s))).toBe(before);
  });
});
