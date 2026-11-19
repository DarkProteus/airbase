import { expect, test } from 'vitest';
import { CONTENT, DEFAULT_ZONES, GROUPS, MISSIONS } from '../content';
import { configStats, createSim, groupStats } from '../sim';
import { viewGroup, viewGroupWhatIf } from './entity';

test('карточка: варианты следующей развилки показывают изменения параметров теми же расчётами', () => {
  const view = viewGroup(GROUPS.a10!, 2);
  expect(view.options.map((o) => o.option.id)).toEqual(['antitank', 'patrol']);
  const [anti, patrol] = view.options;
  expect(anti!.after).toEqual(configStats(GROUPS.a10!, 3, [], 'antitank'));
  expect(anti!.changes.map((c) => c.label)).toEqual(['урон']);
  expect(patrol!.changes.map((c) => c.label).sort()).toEqual(['радиус зоны', 'топливо, с']);
  expect(viewGroup(GROUPS.a10!, 1).options).toEqual([]); // развилка не следующая
  expect(viewGroup(GROUPS.a10!, 3, [], [], 'patrol').options).toEqual([]);
});

test('карточка и матч дают одинаковые параметры выбранной ветки; без выбора — первый вариант', () => {
  const mission = MISSIONS[Object.keys(MISSIONS)[0]!]!;
  for (const [id, spec] of [['f16', 'hunter'], ['e3', 'datalink'], ['kc135', 'wide']] as const) {
    const sim = createSim(mission, CONTENT, 1, [{ group: id, level: 3, spec, zone: DEFAULT_ZONES[0]! }]);
    const view = viewGroup(GROUPS[id]!, 3, [], [], spec);
    expect(view.spec?.id).toBe(spec);
    expect(groupStats(sim, sim.state.groups[0]!)).toEqual(view.own);
    expect(view.stats).toEqual(view.own);
  }
  expect(viewGroup(GROUPS.f16!, 3).spec?.id).toBe('interceptor');
  expect(viewGroup(GROUPS.f16!, 2).spec).toBeUndefined();
});

test('«что-если» галереи учитывает выбор ветки источника аур', () => {
  const target = GROUPS.f16!;
  const dmg = (spec: string) => viewGroupWhatIf(target, 0, [{ group: GROUPS.growler!, level: 2, spec }]).stats.weapons[0]!.damage;
  expect(dmg('designation')).toBeGreaterThan(dmg('jamming'));
});
