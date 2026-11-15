import { describe, expect, test } from 'vitest';
import { CONTENT, DEFAULT_ZONES, GROUPS, LINEUP_SIZE, MISSIONS, START_PROFILE } from '../content';
import {
  auraSources,
  configStats,
  createSim,
  flowStep,
  forkLevel,
  groupStats,
  initialFlow,
  invested,
  maxLevel,
  ownModifiers,
  parseProfile,
  profileLineup,
  serializeProfile,
  upgradeGroup,
  upgradeRejection,
} from '.';
import type { Flow, Profile } from '.';

const up = (p: Profile, id: string, spec?: string) => upgradeGroup(p, GROUPS, id, spec);
const RICH: Profile = { currency: 10_000, levels: { f16: 0, a10: 0, growler: 0, c130: 0, e3: 0, kc135: 0 }, lineup: ['f16', 'a10', 'growler'] };
/** Профиль, где группа куплена и доведена до уровня перед развилкой. */
const beforeFork = (id: string): Profile => {
  let p = RICH;
  for (let lv = 1; lv < forkLevel(GROUPS[id]!)!; lv++) p = up(p, id);
  return p;
};
const mission = MISSIONS[Object.keys(MISSIONS)[0]!]!;

describe('контент: глубина и развилки', () => {
  test.each(Object.values(GROUPS))('$id: 3-4 уровня, ровно одна развилка на 2-м или 3-м, цены растут', (cfg) => {
    expect(maxLevel(cfg)).toBeGreaterThanOrEqual(3);
    expect(maxLevel(cfg)).toBeLessThanOrEqual(4);
    expect(cfg.upgrades.filter((u) => u.options)).toHaveLength(1);
    expect([2, 3]).toContain(forkLevel(cfg));
    const costs = cfg.upgrades.map((u) => u.cost);
    expect(costs).toEqual([...costs].sort((a, b) => a - b));
    expect(new Set(costs).size).toBe(costs.length);
    const [a, b] = cfg.upgrades[forkLevel(cfg)! - 1]!.options!;
    expect(a.id).not.toBe(b.id);
    expect(a.name && b.name && a.description && b.description).toBeTruthy();
    expect(JSON.stringify(a.modifiers)).not.toBe(JSON.stringify(b.modifiers));
  });

  test('старая линейка сохранена: первые уровни прежние по цене, развилка после них', () => {
    const old: Record<string, number[]> = { f16: [80, 140], a10: [90, 150], growler: [120], c130: [100], e3: [100, 150], kc135: [90, 140] };
    for (const [id, costs] of Object.entries(old)) {
      expect(GROUPS[id]!.upgrades.slice(0, costs.length).map((u) => u.cost)).toEqual(costs);
      expect(GROUPS[id]!.upgrades.slice(0, costs.length).some((u) => u.options)).toBe(false);
    }
  });
});

describe('покупка и выбор ветки', () => {
  test('до развилки улучшения идут как раньше, без выбора', () => {
    const p = beforeFork('f16');
    expect(p.levels.f16).toBe(2);
    expect(p.specs).toBeUndefined();
    expect(p.currency).toBe(10_000 - 80 - 140);
  });

  test('без выбора на развилке — отказ specRequired, деньги не списаны; неизвестный вариант — unknownSpec', () => {
    const p = beforeFork('f16');
    expect(upgradeRejection(p, GROUPS, 'f16')).toBe('specRequired');
    expect(up(p, 'f16')).toBe(p);
    expect(upgradeRejection(p, GROUPS, 'f16', 'nope')).toBe('unknownSpec');
    expect(up(p, 'f16', 'nope')).toBe(p);
    // Вариант чужой группы тоже не подходит.
    expect(upgradeRejection(p, GROUPS, 'f16', 'antitank')).toBe('unknownSpec');
  });

  test.each(Object.values(GROUPS).flatMap((cfg) => cfg.upgrades[forkLevel(cfg)! - 1]!.options!.map((o) => [cfg.id, o.id] as const)))(
    '%s: покупка развилки с вариантом %s списывает цену и запоминает выбор',
    (id, option) => {
      const p = beforeFork(id);
      const cost = GROUPS[id]!.upgrades[forkLevel(GROUPS[id]!)! - 1]!.cost;
      const n = up(p, id, option);
      expect(n.currency).toBe(p.currency - cost);
      expect(n.levels[id]).toBe(forkLevel(GROUPS[id]!));
      expect(n.specs).toEqual({ [id]: option });
      expect(p.specs).toBeUndefined(); // исходный профиль не мутирован
    },
  );

  test('нехватка валюты на развилке — отказ даже с выбором', () => {
    const p = { ...beforeFork('a10'), currency: 10 };
    expect(upgradeRejection(p, GROUPS, 'a10', 'antitank')).toBe('notEnoughCurrency');
  });

  test('на обычном уровне лишний выбор игнорируется и не сохраняется', () => {
    const n = up(RICH, 'f16', 'hunter');
    expect(n.levels.f16).toBe(1);
    expect(n.specs).toBeUndefined();
  });

  test('после развилки группа улучшается дальше без выбора, выбор сохраняется', () => {
    const g = 'growler';
    const forked = up(beforeFork(g), g, 'jamming');
    const maxed = up(forked, g);
    expect(maxed.levels[g]).toBe(maxLevel(GROUPS[g]!));
    expect(maxed.specs).toEqual({ [g]: 'jamming' });
  });
});

describe('итоговые параметры: ветки отличаются, расчёт един в sim и на карточке', () => {
  const forkOf = (id: string) => GROUPS[id]!.upgrades[forkLevel(GROUPS[id]!)! - 1]!.options!;

  test.each(Object.keys(GROUPS))('%s: обе ветки дают разные параметры или ауры', (id) => {
    const cfg = GROUPS[id]!;
    const lv = maxLevel(cfg);
    const [a, b] = forkOf(id).map((o) => ({ stats: configStats(cfg, lv, [], o.id), mods: ownModifiers(cfg, lv, o.id) })) as [
      { stats: ReturnType<typeof configStats>; mods: unknown },
      { stats: ReturnType<typeof configStats>; mods: unknown },
    ];
    expect(JSON.stringify(a.mods)).not.toBe(JSON.stringify(b.mods));
    // Выбор ветки меняет и собственные параметры, и/или ауры: хотя бы что-то одно различается.
    const sameStats = JSON.stringify(a.stats) === JSON.stringify(b.stats);
    const aura = (o: string) => ownModifiers(cfg, lv, o).filter((m) => m.scope !== 'self');
    expect(sameStats && JSON.stringify(aura(forkOf(id)[0].id)) === JSON.stringify(aura(forkOf(id)[1].id))).toBe(false);
  });

  test('F-16: перехватчик быстрее стреляет, охотник бьёт сильнее (пробивает броню 10)', () => {
    const f = GROUPS.f16!;
    const inter = configStats(f, 3, [], 'interceptor');
    const hunt = configStats(f, 3, [], 'hunter');
    expect(inter.weapons[0]!.fireRate).toBeGreaterThan(hunt.weapons[0]!.fireRate);
    expect(hunt.weapons[0]!.damage).toBeGreaterThan(inter.weapons[0]!.damage);
    expect(inter.ammo).toBeGreaterThan(hunt.ammo);
  });

  test('в матче выбор доезжает до GroupState, groupStats и аур', () => {
    const profile = up(up(up(beforeFork('e3'), 'e3', 'wide'), 'e3'), 'e3'); // последний вызов на максимуме — без эффекта
    const entry = profileLineup({ ...profile, lineup: ['e3'] }, DEFAULT_ZONES)[0]!;
    expect(entry).toMatchObject({ group: 'e3', level: 3, spec: 'wide' });
    const sim = createSim(mission, CONTENT, 1, [entry]);
    const g = sim.state.groups[0]!;
    expect(g).toMatchObject({ level: 3, spec: 'wide' });
    expect(groupStats(sim, g)).toEqual(configStats(GROUPS.e3!, 3, [], 'wide'));

    // Вторая ветка: другой радиус зоны и другая аура.
    const other = createSim(mission, CONTENT, 1, [{ ...entry, spec: 'datalink' }]);
    expect(groupStats(other, other.state.groups[0]!).zoneRadius).toBeLessThan(groupStats(sim, g).zoneRadius);
    const range = (s: ReturnType<typeof createSim>) => {
      s.state.groups[0]!.phase = 'patrol';
      return auraSources(s)[0]!.mods.filter((m) => m.stat === 'range').reduce((sum, m) => sum + m.value, 0);
    };
    expect(range(other)).toBeGreaterThan(range(sim));
  });

  test('стоимость учитывает уровень-развилку как обычную цену', () => {
    expect(invested(GROUPS.f16!, 3)).toBe(100 + 80 + 140 + 220);
  });
});

describe('поведение без выбора (старое сохранение, рассинхрон)', () => {
  test('развилка куплена, выбора нет или он неизвестен — первый вариант, без падений', () => {
    const cfg = GROUPS.f16!;
    const first = configStats(cfg, 3, [], cfg.upgrades[2]!.options![0].id);
    expect(configStats(cfg, 3)).toEqual(first);
    expect(configStats(cfg, 3, [], 'nope')).toEqual(first);
    const sim = createSim(mission, CONTENT, 1, [{ group: 'f16', level: 3, zone: { x: 3, y: 4 } }]);
    expect(sim.state.groups[0]!.spec).toBe('interceptor');
    expect(groupStats(sim, sim.state.groups[0]!)).toEqual(first);
    const bad = createSim(mission, CONTENT, 1, [{ group: 'f16', level: 3, spec: 'nope', zone: { x: 3, y: 4 } }]);
    expect(bad.state.groups[0]!.spec).toBe('interceptor');
  });

  test('развилка не куплена — специализации в матче нет, выбор игнорируется', () => {
    const sim = createSim(mission, CONTENT, 1, [{ group: 'f16', level: 2, spec: 'hunter', zone: { x: 3, y: 4 } }]);
    expect(sim.state.groups[0]!.spec).toBeUndefined();
    expect(groupStats(sim, sim.state.groups[0]!)).toEqual(configStats(GROUPS.f16!, 2));
  });
});

describe('сохранение', () => {
  const parse = (raw: string) => parseProfile(raw, GROUPS, LINEUP_SIZE);
  const raw = (profile: unknown) => JSON.stringify({ version: 1, profile });

  test('serialize -> parse сохраняет выбор ветки', () => {
    const p = up(beforeFork('growler'), 'growler', 'designation');
    const back = parse(serializeProfile(p));
    expect(back).toEqual(p);
    expect(back?.specs).toEqual({ growler: 'designation' });
  });

  test('старое сохранение (уровни по старой линейке, без поля specs) читается целиком', () => {
    const old = { currency: 321, levels: { f16: 2, a10: 2, growler: 1, c130: 1, e3: 2, kc135: 2 }, lineup: ['f16', 'a10', 'e3'], tutorialDone: true };
    const p = parse(raw(old))!;
    expect(p).toEqual(old);
    expect(p.specs).toBeUndefined();
    // Следующий шаг у каждой группы — развилка, ждущая выбора, а не потерянный прогресс.
    for (const id of Object.keys(old.levels)) expect(upgradeRejection(p, GROUPS, id)).toBe('specRequired');
  });

  test('мусор в specs отбрасывается, остальное читается', () => {
    const base = { currency: 5, levels: { f16: 3, a10: 2 }, lineup: ['f16'] };
    const p = parse(
      raw({ ...base, specs: { f16: 'hunter', a10: 'antitank', ghost: 'x', c130: 'cargo' } }),
    )!;
    // a10 ещё не дошёл до развилки, ghost неизвестен, c130 не куплена.
    expect(p.specs).toEqual({ f16: 'hunter' });
    expect(p.levels).toEqual(base.levels);
    expect(parse(raw({ ...base, specs: { f16: 'nope' } }))!.specs).toBeUndefined();
    expect(parse(raw({ ...base, specs: [1] }))!.specs).toBeUndefined();
    expect(parse(raw({ ...base, specs: { f16: 7 } }))!.specs).toBeUndefined();
  });

  test('уровень выше нового максимума срезается, выбор остаётся', () => {
    const p = parse(raw({ currency: 0, levels: { f16: 99 }, lineup: [], specs: { f16: 'hunter' } }))!;
    expect(p.levels.f16).toBe(maxLevel(GROUPS.f16!));
    expect(p.specs).toEqual({ f16: 'hunter' });
  });
});

describe('поток: выбор уходит в бой', () => {
  test('sortie кладёт spec в состав боя; состав без выбора — без поля', () => {
    const profile: Profile = { ...START_PROFILE, levels: { f16: 3, a10: 1 }, specs: { f16: 'hunter' }, lineup: ['f16', 'a10', 'f16'].slice(0, 2) };
    const zones = DEFAULT_ZONES;
    const lineup = profileLineup(profile, zones);
    expect(lineup[0]).toMatchObject({ group: 'f16', spec: 'hunter' });
    expect('spec' in lineup[1]!).toBe(false);
    const battle = flowStep(initialFlow(profile), { type: 'sortie', mission, lineupSize: 2, zones, seed: 1 }) as Extract<Flow, { screen: 'battle' }>;
    expect(battle.lineup[0]!.spec).toBe('hunter');
    expect(battle.profile.specs).toEqual({ f16: 'hunter' });
  });
});
