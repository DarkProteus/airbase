import { describe, expect, test } from 'vitest';
import { CONTENT, DEFAULT_ZONES, MISSIONS } from '../content';
import { createSim, damageEnemy, profileLineup, step, TICK_RATE } from '.';
import type { MatchStats, SimEvent, Sim } from '.';

/** Матч до конца; возвращает движок, все события и независимо посчитанное по состоянию до тиков: сколько тиков каждая группа была в патруле. */
function play(missionId: string, groups: string[], seed: number, follow = false) {
  const lineup = profileLineup({ currency: 0, levels: Object.fromEntries(groups.map((g) => [g, 0])), lineup: groups }, DEFAULT_ZONES);
  const sim = createSim(MISSIONS[missionId]!, CONTENT, seed, lineup);
  const events: SimEvent[] = [];
  const patrol = new Map<number, number>();
  while (sim.state.status === 'running' && sim.state.tick < 900 * TICK_RATE) {
    for (const g of sim.state.groups) if (g.phase === 'patrol') patrol.set(g.id, (patrol.get(g.id) ?? 0) + 1);
    // follow: зоны держатся на цели миссии, как у бота баланса (иначе зоны стоят где были на старте).
    const at = sim.state.objective!.pos;
    step(
      sim,
      follow ? sim.state.groups.filter((g) => Math.hypot(g.zone.x - at.x, g.zone.y - at.y) > 0.5).map((g) => ({ type: 'setZone' as const, group: g.id, zone: { ...at } })) : [],
    );
    events.push(...sim.state.events);
  }
  return { sim, events, patrol };
}

/** Статистика, пересчитанная только из событий и расписания спавнов: независимая проверка счётчиков движка. */
function replay(sim: Sim, events: SimEvent[]): Pick<MatchStats, 'waves'> & { groups: Map<number, { kills: number; damage: number }> } {
  const schedule = sim.waveSpawns.flatMap((spawns, wave) => spawns.map((sp) => ({ wave, hp: sim.content.enemies[sp.enemy]!.hp })));
  const info = new Map<number, { wave: number; hp: number; by?: number }>();
  const waves = sim.waveSpawns.map(() => ({ spawned: 0, killed: 0, leaked: 0, damage: 0 }));
  const groups = new Map<number, { kills: number; damage: number }>();
  let spawned = 0;
  for (const ev of events) {
    if (ev.type === 'spawn') {
      const it = schedule[spawned++]!;
      info.set(ev.enemy, { wave: it.wave, hp: it.hp });
      waves[it.wave]!.spawned++;
    } else if (ev.type === 'groupShot') {
      const e = info.get(ev.enemy)!;
      const row = groups.get(ev.group) ?? { kills: 0, damage: 0 };
      row.damage += Math.min(ev.damage, e.hp);
      e.hp -= ev.damage;
      e.by = ev.group;
      groups.set(ev.group, row);
    } else if (ev.type === 'kill') {
      const e = info.get(ev.enemy)!;
      waves[e.wave]!.killed++;
      groups.get(e.by!)!.kills++;
    } else if (ev.type === 'leak') {
      const w = waves[info.get(ev.enemy)!.wave]!;
      w.leaked++;
      w.damage += ev.damage;
    }
  }
  return { waves, groups };
}

const sum = (xs: number[]): number => xs.reduce((a, b) => a + b, 0);

describe('статистика матча', () => {
  test('детерминирована: один сид — одна и та же статистика, и она не пустая', () => {
    const a = play('convoy', ['f16', 'a10', 'growler'], 7).sim.state;
    const b = play('convoy', ['f16', 'a10', 'growler'], 7).sim.state;
    expect(a.stats).toEqual(b.stats);
    expect(a.tick).toBe(b.tick);
    expect(sum(a.stats.groups.map((g) => g.damage))).toBeGreaterThan(0);
  });

  // победа с группами, поражение при неудачных зонах и со слабым составом, поражение вовсе без групп
  const cases: [string, string[], boolean, 'won' | 'lost'][] = [
    ['convoy', ['f16', 'a10', 'c130'], false, 'won'],
    ['evac', ['f16', 'a10', 'growler'], true, 'won'],
    // Все зоны точно на колонне, без выноса навстречу врагам: этого составу не хватает.
    ['convoy', ['f16', 'a10', 'c130'], true, 'lost'],
    ['evac', ['f16'], false, 'lost'],
    ['evac', [], false, 'lost'],
  ];
  describe.each(cases)('%s с составом %j (зоны за целью: %s)', (mission, groups, follow, outcome) => {
    const { sim, events, patrol } = play(mission, groups, 11, follow);
    const { stats } = sim.state;
    const again = replay(sim, events);

    test('исход матча', () => expect(sim.state.status).toBe(outcome));

    test('убийства, выстрелы и прорывы сходятся с событиями', () => {
      expect(sum(stats.groups.map((g) => g.kills))).toBe(events.filter((e) => e.type === 'kill').length);
      expect(sum(stats.groups.map((g) => g.kills))).toBe(sim.state.kills);
      expect(sum(stats.waves.map((w) => w.killed))).toBe(sim.state.kills);
      expect(sum(stats.waves.map((w) => w.leaked))).toBe(events.filter((e) => e.type === 'leak').length);
      expect(sum(stats.waves.map((w) => w.spawned))).toBe(events.filter((e) => e.type === 'spawn').length);
      const leakDamage = sum(events.flatMap((e) => (e.type === 'leak' ? [e.damage] : [])));
      expect(sum(stats.waves.map((w) => w.damage))).toBe(leakDamage);
      expect(stats.waves.map((w) => w.damage)).toEqual(again.waves.map((w) => w.damage));
    });

    test('каждый заспавненный враг уничтожен, дошёл или ещё на поле', () => {
      stats.waves.forEach((w, i) => {
        const alive = sim.state.enemies.filter((e) => e.wave === i).length;
        expect(w.killed + w.leaked + alive).toBe(w.spawned);
      });
      if (outcome === 'won') expect(sim.state.enemies).toHaveLength(0);
    });

    test('по группам сходится с пересчётом из событий выстрелов (урон — фактический, не выше остатка здоровья)', () => {
      expect(stats.waves).toEqual(again.waves);
      for (const g of stats.groups) {
        const row = again.groups.get(g.id) ?? { kills: 0, damage: 0 };
        expect(g.kills).toBe(row.kills);
        expect(g.damage).toBeCloseTo(row.damage, 9);
      }
      const nominal = sum(events.flatMap((e) => (e.type === 'groupShot' ? [e.damage] : [])));
      expect(sum(stats.groups.map((g) => g.damage))).toBeLessThanOrEqual(nominal);
    });

    test('вылеты и патруль сходятся с состоянием и событиями', () => {
      for (const g of sim.state.groups) {
        const t = stats.groups.find((x) => x.id === g.id)!;
        expect(t.sorties).toBe(g.sorties);
        expect(t.sorties).toBe(events.filter((e) => e.type === 'sortieDone' && e.group === g.id).length);
        expect(t.patrolTicks).toBe(patrol.get(g.id) ?? 0);
        expect(t.patrolTicks).toBeLessThanOrEqual(sim.state.tick);
        expect(t.type).toBe(g.type);
      }
    });
  });

  test('без состава никто не стреляет: нулевые счётчики групп, а все враги дошли', () => {
    const { sim } = play('evac', [], 3);
    expect(sim.state.stats.groups).toEqual([]);
    expect(sum(sim.state.stats.waves.map((w) => w.killed))).toBe(0);
    expect(sum(sim.state.stats.waves.map((w) => w.leaked))).toBeGreaterThan(0);
  });

  test('урон засчитывается по остатку здоровья, убийство — стрелку; без стрелка группы не затронуты', () => {
    const sim = createSim(MISSIONS.evac!, CONTENT, 1, profileLineup({ currency: 0, levels: { f16: 0 }, lineup: ['f16'] }, DEFAULT_ZONES));
    sim.state.wave = 1;
    sim.state.enemies.push({ id: 90, type: 'drone', wave: 0, hp: 10, speed: 1, dist: 0, pos: { x: 1, y: 1 } });
    sim.state.enemies.push({ id: 91, type: 'drone', wave: 0, hp: 10, speed: 1, dist: 0, pos: { x: 1, y: 1 } });
    const f16 = sim.state.groups[0]!.id;
    expect(damageEnemy(sim, 90, 25, f16)).toBe(true);
    expect(sim.state.stats.groups[0]).toMatchObject({ damage: 10, kills: 1 });
    expect(damageEnemy(sim, 91, 4)).toBe(false);
    expect(sim.state.stats.groups[0]).toMatchObject({ damage: 10, kills: 1 });
    expect(sim.state.stats.waves[0]!.killed).toBe(1);
  });
});
