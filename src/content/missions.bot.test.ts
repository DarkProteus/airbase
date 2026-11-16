import { describe, expect, test } from 'vitest';
import { createSim, step, TICK_RATE, runMatch } from '../sim';
import type { MissionConfig } from '../sim';
import { CONTENT, ENEMIES, GROUPS, LINEUP_SIZE, MISSIONS } from '.';

/** Сиды прогонов: фиксированные, чтобы исход был воспроизводим; три — компромисс между надёжностью и скоростью. */
const SEEDS = [1, 2, 3];

/**
 * Составы, которыми проходится каждая миссия (группы уровня 0 — бот не покупает улучшений):
 * evac/convoy/bastion/river — F-16 бьёт воздух, A-10 бьёт землю и вертолёты, Growler замедляет врагов и усиливает ударные группы;
 * radar — малозаметные БПЛА видны только в зоне ДРЛО, поэтому вместо штурмовика E-3;
 * pass — воздушная миссия с носителями на длинном маршруте: Growler и заправщик вместо штурмовика.
 */
const WINNERS: Record<string, string[]> = {
  evac: ['f16', 'a10', 'growler'],
  convoy: ['f16', 'a10', 'growler'],
  radar: ['f16', 'growler', 'e3'],
  bastion: ['f16', 'a10', 'growler'],
  river: ['f16', 'a10', 'growler'],
  pass: ['f16', 'growler', 'kc135'],
};

const wins = (m: MissionConfig, lineup: string[]) => SEEDS.filter((seed) => runMatch(m, CONTENT, seed, lineup).status === 'won').length;

/** Прогоны переиспользуются между проверками: ключ — миссия и состав. */
const cache = new Map<string, number>();
const winsOf = (m: MissionConfig, lineup: string[]): number => {
  const key = `${m.id}:${lineup.join('+')}`;
  if (!cache.has(key)) cache.set(key, wins(m, lineup));
  return cache.get(key)!;
};

/**
 * Оружие по каким целям миссия требует (теги врагов). Землю требуют те миссии, где танков и вертолётов хватает, чтобы убить цель
 * без штурмовика. «Укрепрайон», «Колонна» и «Речной караван» требуют только землю: штурмовик с Growler проходит их и без
 * истребителя (TASK-42, F-16 не обязателен), а истребитель без штурмовика — нет. Воздух требуют «Эвакуация», «Радарный пост» и «Горный перевал».
 */
const NEEDS: Record<string, string[]> = {
  evac: ['air', 'ground'],
  convoy: ['ground'],
  radar: ['air'],
  bastion: ['ground'],
  river: ['ground'],
  pass: ['air'],
};
/** Теги врагов миссии, взятые из конфигов, а не из id. */
const enemyTags = (m: MissionConfig): Set<string> => new Set(m.waves.flatMap((w) => w.groups.flatMap((g) => ENEMIES[g.enemy]!.tags)));
const hasStealth = (m: MissionConfig) => m.waves.some((w) => w.groups.some((g) => ENEMIES[g.enemy]!.stealth));

/** Группа бьёт цели с тегом (по данным оружия). */
const shoots = (id: string, tag: string) => GROUPS[id]!.weapons.some((w) => w.targetTags.includes(tag));
/** Группа открывает малозаметных: вражеская аура с detect. */
const detects = (id: string) => GROUPS[id]!.auras.some((a) => a.stat === 'detect' && a.side === 'enemy');

/** Состав победителя без групп с нужной способностью: их место занимают первые подходящие по реестру без неё. */
function without(winner: string[], has: (id: string) => boolean): string[] {
  const kept = winner.filter((id) => !has(id));
  const fill = Object.keys(GROUPS).filter((id) => !has(id) && !kept.includes(id));
  return [...kept, ...fill].slice(0, LINEUP_SIZE);
}

describe('миссии проходимы ботом, но не любым составом (headless)', () => {
  test('составы — по LINEUP_SIZE разных групп', () => {
    for (const lineup of Object.values(WINNERS)) {
      expect(lineup).toHaveLength(LINEUP_SIZE);
      expect(new Set(lineup).size).toBe(LINEUP_SIZE);
    }
    expect(Object.keys(WINNERS).sort()).toEqual(Object.keys(MISSIONS).sort());
    expect(Object.keys(NEEDS).sort()).toEqual(Object.keys(MISSIONS).sort());
  });

  describe.each(Object.values(MISSIONS))('$id', (m) => {
    test('требуемые типы оружия действительно встречаются среди врагов миссии', () => {
      for (const tag of NEEDS[m.id]!) expect(enemyTags(m).has(tag), tag).toBe(true);
    });

    test('проходится своим составом на всех сидах', () => {
      expect(winsOf(m, WINNERS[m.id]!)).toBe(SEEDS.length);
    });

    test.each(NEEDS[m.id]!)('не проходится составом без оружия по целям «%s»', (tag) => {
      const lineup = without(WINNERS[m.id]!, (id) => shoots(id, tag));
      expect(lineup.some((id) => shoots(id, tag))).toBe(false);
      expect(winsOf(m, lineup)).toBe(0);
    });

    test.skipIf(!hasStealth(m) || !WINNERS[m.id]!.some(detects))('не проходится составом без обнаружения малозаметных', () => {
      expect(winsOf(m, without(WINNERS[m.id]!, detects))).toBe(0);
    });
  });

  test('выигрышные составы различаются: победитель одной миссии не проходит другую', () => {
    // Радарный пост требует ДРЛО, укрепрайон — штурмовика: составы не взаимозаменяемы.
    expect(winsOf(MISSIONS.radar!, WINNERS.bastion!)).toBe(0);
    expect(winsOf(MISSIONS.bastion!, WINNERS.radar!)).toBe(0);
    // Состав перевала (заправщик вместо ДРЛО и штурмовика) на радарном посту остаётся без обнаружения.
    expect(winsOf(MISSIONS.radar!, WINNERS.pass!)).toBe(0);
    expect(new Set(Object.values(WINNERS).map((l) => [...l].sort().join('+'))).size).toBeGreaterThanOrEqual(3);
  });
});

/** Стартовые зоны миссии осмысленны: в defend-миссии состав-победитель держит объект на них без единого переноса зон. */
describe('стартовые зоны без переноса', () => {
  const stationary = (m: MissionConfig, lineup: string[], seed: number) => {
    const sim = createSim(m, CONTENT, seed, lineup.map((group, i) => ({ group, level: 0, zone: m.zones![i]! })));
    while (sim.state.status === 'running' && sim.state.tick < 600 * TICK_RATE) step(sim);
    return sim.state.status;
  };

  test.each(['radar', 'bastion'])('%s: победитель выигрывает на зонах миссии, не двигая их', (id) => {
    const m = MISSIONS[id]!;
    expect(m.objective!.type).toBe('defend');
    for (const seed of SEEDS) expect(stationary(m, WINNERS[id]!, seed), `${id}: сид ${seed}`).toBe('won');
  });
});
