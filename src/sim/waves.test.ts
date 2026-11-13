import { describe, expect, test } from 'vitest';
import { CONTENT, ENEMIES, MISSIONS } from '../content';
import { createSim, damageEnemy, snapshot, step, TICK_RATE } from '.';
import type { Content, MissionConfig, SimEvent, Wave } from '.';

const content: Content = {
  units: {},
  enemies: { e: { id: 'e', name: 'E', hp: 10, speed: 2, reward: 1, leakDamage: 2, tags: [] } },
};

const one = { enemy: 'e', count: 1, interval: 0 };
const mission = (waves: Wave[], over: Partial<MissionConfig> = {}): MissionConfig => ({
  id: 'm',
  name: 'M',
  path: [{ x: 0, y: 0 }, { x: 20, y: 0 }],
  slots: [],
  startMoney: 0,
  baseLives: 10,
  waves,
  ...over,
});

/** Прогоняет тики и возвращает тики событий waveStart. */
function waveStarts(sim: ReturnType<typeof createSim>, ticks: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < ticks; i++) {
    const tick = sim.state.tick;
    step(sim);
    for (const ev of sim.state.events) if (ev.type === 'waveStart') out.push(tick);
  }
  return out;
}

describe('враги как данные', () => {
  test('≥3 типа врагов с полными параметрами', () => {
    const list = Object.values(ENEMIES);
    expect(list.length).toBeGreaterThanOrEqual(3);
    for (const e of list) {
      expect(ENEMIES[e.id]).toBe(e);
      expect(e.hp).toBeGreaterThan(0);
      expect(e.speed).toBeGreaterThan(0);
      expect(e.reward).toBeGreaterThan(0);
      expect(e.leakDamage).toBeGreaterThan(0);
      expect(e.tags.length).toBeGreaterThan(0);
    }
    expect(new Set(list.map((e) => e.hp)).size).toBe(list.length);
  });

  test('параметры врага влияют на движок: награда и урон базе берутся из конфига', () => {
    const sim = createSim(mission([{ prep: 0, groups: [one] }]), content, 1);
    step(sim);
    expect(sim.state.enemies[0]!.hp).toBe(10);
    for (let i = 0; i < 12 * TICK_RATE; i++) step(sim);
    expect(sim.state.lives).toBe(8);
  });
});

describe('миссия из конфига', () => {
  const m = MISSIONS.sortie!;
  const power = (w: Wave) => w.groups.reduce((a, g) => a + g.count * ENEMIES[g.enemy]!.hp, 0);

  test('≥5 волн с нарастающим составом, только из реестров', () => {
    expect(m.waves.length).toBeGreaterThanOrEqual(5);
    const p = m.waves.map(power);
    for (let i = 1; i < p.length; i++) expect(p[i]).toBeGreaterThan(p[i - 1]!);
    expect(new Set(m.waves.flatMap((w) => w.groups.map((g) => g.enemy))).size).toBeGreaterThanOrEqual(3);
    expect(() => createSim(m, CONTENT, 1)).not.toThrow();
  });
});

describe('старт волн по правилу конфига', () => {
  test('timer: подготовка идёт после конца спавна предыдущей волны, враги могут быть живы', () => {
    // Волна 1 стартует на тике 30, спавнит на его смещениях 0 и 30 (конец спавна — тик 60).
    const sim = createSim(
      mission([{ prep: 1, groups: [{ enemy: 'e', count: 2, interval: 1 }] }, { prep: 2, groups: [one] }]),
      content,
      1,
    );
    // Подготовка к волне 2 начинается тиком позже (61) и длится 2 с.
    const starts = waveStarts(sim, 200);
    expect(starts[0]).toBe(TICK_RATE);
    expect(starts[1]! - starts[0]!).toBe(TICK_RATE + 1 + 2 * TICK_RATE);
    expect(sim.state.enemies.length).toBeGreaterThan(0);
  });

  test('clear: следующая волна ждёт зачистки, затем фаза подготовки', () => {
    const sim = createSim(mission([{ prep: 0, groups: [one] }, { prep: 2, start: 'clear', groups: [one] }]), content, 1);
    const phases: string[] = [];
    let secondStart = -1;
    let clearedAt = -1;
    for (let i = 0; i < 200; i++) {
      step(sim);
      phases.push(`${sim.state.wave}${sim.state.phase}`);
      if (i === 60) {
        // Враг ещё жив, но спавн закончен: подготовка не началась.
        expect(sim.state.enemies).toHaveLength(1);
        expect(sim.state.wave).toBe(1);
        expect(sim.state.phase).toBe('wave');
        damageEnemy(sim, sim.state.enemies[0]!.id, 100);
        clearedAt = sim.state.tick;
      }
      if (secondStart < 0 && sim.state.events.some((e) => e.type === 'waveStart' && e.wave === 1)) secondStart = sim.state.tick;
      if (i === 61) expect(sim.state.phase).toBe('prep');
    }
    expect(phases).toContain('1prep');
    expect(secondStart - clearedAt).toBeGreaterThanOrEqual(2 * TICK_RATE);
    expect(secondStart - clearedAt).toBeLessThanOrEqual(2 * TICK_RATE + 2);
  });

  test('между волнами спавна нет: в фазе подготовки враги не появляются', () => {
    const sim = createSim(mission([{ prep: 1, groups: [one] }, { prep: 3, groups: [one] }]), content, 1);
    const spawnTicks: number[] = [];
    for (let i = 0; i < 200; i++) {
      const tick = sim.state.tick;
      step(sim);
      const spawned = sim.state.events.some((e: SimEvent) => e.type === 'spawn');
      if (spawned) spawnTicks.push(tick);
      if (sim.state.phase === 'prep' && sim.state.wave > 0) expect(spawned).toBe(false);
    }
    expect(spawnTicks).toHaveLength(2);
    expect(spawnTicks[1]! - spawnTicks[0]!).toBeGreaterThanOrEqual(3 * TICK_RATE);
  });
});

describe('исход матча', () => {
  test('won только после последней волны И зачистки', () => {
    const sim = createSim(mission([{ prep: 0, groups: [one] }, { prep: 1, groups: [one] }]), content, 1);
    for (let i = 0; i < 5; i++) step(sim);
    damageEnemy(sim, sim.state.enemies[0]!.id, 100);
    step(sim);
    expect(sim.state.status).toBe('running');
    while (sim.state.wave < 2) step(sim);
    step(sim);
    expect(sim.state.enemies).toHaveLength(1);
    expect(sim.state.status).toBe('running');
    damageEnemy(sim, sim.state.enemies[0]!.id, 100);
    step(sim);
    expect(sim.state.status).toBe('won');
  });

  test('lost при жизнях базы ≤ 0, до последней волны', () => {
    const waves = [{ prep: 0, groups: [one] }, ...Array.from({ length: 4 }, () => ({ prep: 100, groups: [one] }))];
    const sim = createSim(mission(waves, { baseLives: 2 }), content, 1);
    for (let i = 0; i < 60 * TICK_RATE && sim.state.status === 'running'; i++) step(sim);
    expect(sim.state.status).toBe('lost');
    expect(sim.state.lives).toBeLessThanOrEqual(0);
    expect(sim.state.wave).toBeLessThan(5);
  });
});

describe('детерминизм полной миссии', () => {
  /** Headless-прогон без юнитов: «бот» добивает врагов у середины пути. */
  function playthrough(seed: number) {
    const sim = createSim(MISSIONS.sortie!, CONTENT, seed);
    const log: unknown[] = [];
    for (let i = 0; i < 600 * TICK_RATE && sim.state.status === 'running'; i++) {
      step(sim);
      for (const e of [...sim.state.enemies]) if (e.dist > sim.path.length / 2) damageEnemy(sim, e.id, 1e9);
      log.push(sim.state.events.map((ev) => ({ ...ev })));
    }
    return { snap: snapshot(sim), log };
  }

  test('миссия проходится до won; один сид → идентичные события и снапшот, другой сид → иной', () => {
    const a = playthrough(1234);
    expect(a.snap.status).toBe('won');
    expect(a.snap.wave).toBe(MISSIONS.sortie!.waves.length);
    expect(playthrough(1234)).toEqual(a);
    expect(playthrough(99).snap).not.toEqual(a.snap);
  });
});
