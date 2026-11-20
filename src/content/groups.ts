import type { AirGroupConfig } from '../sim';
import { MODELS } from './models';

/** Истребитель: быстрый, бьёт только воздушные цели. */
const f16: AirGroupConfig = {
  id: 'f16',
  name: 'F-16',
  role: 'fighter',
  cost: 100,
  tags: ['air', 'strike'],
  speed: 3,
  fuel: 60,
  ammo: 70,
  takeoffTime: 2,
  rearmTime: 5,
  zoneRadius: 3,
  weapons: [{ damage: 12, fireRate: 2.5, targetTags: ['air'], shot: 'gun' }],
  auras: [],
  upgrades: [
    { cost: 80, modifiers: [{ stat: 'damage', op: 'mul', value: 1.3, scope: 'self' }] },
    // Скорострельность, а не боекомплект: топливо кончается раньше патронов, лишние патроны ничего не меняли (TASK-43).
    { cost: 140, modifiers: [{ stat: 'fireRate', op: 'mul', value: 1.15, scope: 'self' }] },
    {
      cost: 220,
      modifiers: [],
      options: [
        {
          id: 'interceptor',
          name: 'Перехватчик',
          description: 'Скорострельность ×1,3, боекомплект +24, скорость +0,5: давит рои лёгких целей.',
          modifiers: [
            { stat: 'fireRate', op: 'mul', value: 1.3, scope: 'self' },
            { stat: 'ammo', op: 'add', value: 24, scope: 'self' },
            { stat: 'speed', op: 'add', value: 0.5, scope: 'self' },
          ],
        },
        {
          id: 'hunter',
          name: 'Охотник',
          description: 'Урон выстрела ×1,35: пробивает броню вертолётов.',
          modifiers: [{ stat: 'damage', op: 'mul', value: 1.35, scope: 'self' }],
        },
      ],
    },
  ],
  visual: { shape: 'pyramid', model: MODELS.f16, color: '#4f9de8', scale: 1.1 },
};

/** Штурмовик: медленнее, бьёт только наземные цели тяжёлыми выстрелами. */
const a10: AirGroupConfig = {
  id: 'a10',
  name: 'A-10',
  role: 'attacker',
  cost: 120,
  tags: ['air', 'strike'],
  speed: 2.4,
  fuel: 65,
  ammo: 20,
  takeoffTime: 2,
  rearmTime: 6,
  zoneRadius: 2.5,
  weapons: [{ damage: 45, fireRate: 1.2, targetTags: ['ground', 'low'], shot: 'missile' }],
  auras: [],
  upgrades: [
    { cost: 90, modifiers: [{ stat: 'damage', op: 'mul', value: 1.3, scope: 'self' }] },
    { cost: 150, modifiers: [{ stat: 'ammo', op: 'add', value: 10, scope: 'self' }] },
    {
      cost: 230,
      modifiers: [],
      options: [
        {
          id: 'antitank',
          name: 'Противотанковый',
          description: 'Урон выстрела ×1,4: тяжёлые наземные цели гибнут за несколько ракет.',
          modifiers: [{ stat: 'damage', op: 'mul', value: 1.4, scope: 'self' }],
        },
        {
          id: 'patrol',
          name: 'Дальний патруль',
          description: 'Радиус зоны +1, топливо +20 с: прикрывает больше пути и дольше держится.',
          modifiers: [
            { stat: 'range', op: 'add', value: 1, scope: 'self' },
            { stat: 'fuel', op: 'add', value: 20, scope: 'self' },
          ],
        },
      ],
    },
  ],
  visual: { shape: 'cube', model: MODELS.a10, color: '#8fbf5a', scale: 1.1 },
};

/** РЭБ: не стреляет; пока патрулирует, в его зоне враги медленнее, а ударные (strike) группы бьют сильнее. */
const growler: AirGroupConfig = {
  id: 'growler',
  name: 'EA-18G Growler',
  role: 'support',
  cost: 120,
  tags: ['air', 'ew'],
  speed: 2.8,
  fuel: 70,
  ammo: 0,
  takeoffTime: 2,
  rearmTime: 6,
  zoneRadius: 3,
  weapons: [],
  auras: [
    { stat: 'speed', op: 'mul', value: 0.7, scope: 'aura', side: 'enemy' },
    { stat: 'damage', op: 'mul', value: 1.3, scope: 'aura', tags: ['strike'] },
  ],
  upgrades: [
    // Аура-скорострельность вместо радиуса: союзники и так внутри зоны, лишние полметра охвата ничего не давали (TASK-43).
    { cost: 120, modifiers: [{ stat: 'fireRate', op: 'mul', value: 1.2, scope: 'aura', tags: ['strike'] }] },
    {
      cost: 170,
      modifiers: [],
      options: [
        {
          id: 'jamming',
          name: 'Подавление',
          description: 'Враги в зоне замедлены ещё на 25%: больше времени у ударных групп.',
          modifiers: [{ stat: 'speed', op: 'mul', value: 0.75, scope: 'aura', side: 'enemy' }],
        },
        {
          id: 'designation',
          name: 'Целеуказание',
          description: 'Бонус урона ударных групп в зоне ×1,2 сверх базового.',
          modifiers: [{ stat: 'damage', op: 'mul', value: 1.2, scope: 'aura', tags: ['strike'] }],
        },
      ],
    },
    // Усиление ауры вместо перезарядки: за матч группа вылетает 1–1,3 раза, две секунды перезарядки ничего не давали (TASK-43).
    {
      cost: 230,
      modifiers: [
        { stat: 'damage', op: 'mul', value: 1.15, scope: 'aura', tags: ['strike'] },
        { stat: 'speed', op: 'mul', value: 0.8, scope: 'aura', side: 'enemy' },
      ],
    },
  ],
  visual: { shape: 'cylinder', model: MODELS.growler, color: '#a56fe0', scale: 1 },
};

/** Экономика: не воюет; каждый завершённый вылет добавляет бонус к награде миссии. */
const c130: AirGroupConfig = {
  id: 'c130',
  name: 'C-130',
  role: 'economy',
  cost: 90,
  tags: ['air', 'logistics'],
  speed: 2,
  fuel: 30,
  ammo: 0,
  takeoffTime: 3,
  rearmTime: 6,
  zoneRadius: 1.5,
  income: 40,
  weapons: [],
  auras: [],
  upgrades: [
    { cost: 100, modifiers: [{ stat: 'income', op: 'add', value: 15, scope: 'self' }] },
    {
      cost: 150,
      modifiers: [],
      options: [
        {
          id: 'cargo',
          name: 'Крупные грузы',
          description: 'Бонус за вылет +25: больше дохода с каждого рейса.',
          modifiers: [{ stat: 'income', op: 'add', value: 25, scope: 'self' }],
        },
        {
          id: 'turnaround',
          name: 'Быстрый оборот',
          description: 'Перезарядка −3 с, скорость ×1,25 и бонус за вылет +15: рейсов за миссию больше, и каждый приносит больше.',
          modifiers: [
            { stat: 'rearmTime', op: 'add', value: -3, scope: 'self' },
            { stat: 'speed', op: 'mul', value: 1.25, scope: 'self' },
            { stat: 'income', op: 'add', value: 15, scope: 'self' },
          ],
        },
      ],
    },
    { cost: 210, modifiers: [{ stat: 'income', op: 'add', value: 15, scope: 'self' }] },
  ],
  visual: { shape: 'cube', model: MODELS.c130, color: '#d9c25c', scale: 1.2 },
};

/** ДРЛО: не стреляет; пока патрулирует, в его зоне у союзных групп шире зона патруля. */
const e3: AirGroupConfig = {
  id: 'e3',
  name: 'E-3 Sentry',
  role: 'awacs',
  cost: 130,
  tags: ['air', 'awacs'],
  speed: 2,
  fuel: 80,
  ammo: 0,
  takeoffTime: 3,
  rearmTime: 7,
  zoneRadius: 3.5,
  weapons: [],
  auras: [
    { stat: 'range', op: 'add', value: 2.5, scope: 'aura' },
    // Обнаружение: малозаметные враги в зоне ДРЛО становятся мишенями для всех групп.
    { stat: 'detect', op: 'add', value: 1, side: 'enemy', scope: 'aura' },
  ],
  upgrades: [
    // Улучшения ДРЛО — осведомлённость (дальность захвата союзников, охват обнаружения), TASK-43. Это потолок рычага:
    // союзники патрулируют в 0–2 единицах от центра зоны ДРЛО при радиусе 3,5, и охват уже избыточен: ни +10 к дальности
    // союзников, ни обнаружение на радиусе 10 не дают больше 4 новых пар (подробности в docs/balance-0.2.md).
    { cost: 100, modifiers: [{ stat: 'range', op: 'add', value: 3, scope: 'aura' }] },
    {
      cost: 150,
      modifiers: [
        { stat: 'range', op: 'add', value: 3, scope: 'aura' },
        { stat: 'range', op: 'add', value: 1.5, scope: 'self' },
        // Обнаружение малозаметных врагов на радиусе 8 вместо радиуса зоны.
        { stat: 'detect', op: 'add', value: 1, side: 'enemy', scope: 'aura', radius: 8 },
      ],
    },
    {
      cost: 220,
      modifiers: [],
      options: [
        {
          id: 'wide',
          name: 'Широкий обзор',
          description: 'Радиус зоны +1,5: аура накрывает больше союзников и врагов.',
          modifiers: [{ stat: 'range', op: 'add', value: 1.5, scope: 'self' }],
        },
        {
          id: 'datalink',
          name: 'Усиленная связь',
          description: 'Бонус к радиусу зон союзников в ауре +1,5 сверху.',
          modifiers: [{ stat: 'range', op: 'add', value: 1.5, scope: 'aura' }],
        },
      ],
    },
  ],
  visual: { shape: 'cylinder', model: MODELS.e3, color: '#3fc1c9', scale: 1.2 },
};

/** Заправщик: не стреляет; пока патрулирует, у союзных групп в его зоне бак «больше» — они дольше держатся в патруле. */
const kc135: AirGroupConfig = {
  id: 'kc135',
  name: 'KC-135',
  role: 'tanker',
  cost: 110,
  tags: ['air', 'tanker'],
  speed: 2,
  fuel: 70,
  ammo: 0,
  takeoffTime: 3,
  rearmTime: 6,
  zoneRadius: 3,
  weapons: [],
  auras: [{ stat: 'fuel', op: 'mul', value: 1.5, scope: 'aura' }],
  upgrades: [
    // Улучшения заправщика (TASK-45): рычаги только топливо и оборот — баки самого заправщика (аура дольше на позиции),
    // сила ауры, перезарядка. Потолок рычага: топливо спасает только группы, которые уходят по топливу (F-16, Growler, ДРЛО),
    // и сдвигает единственную «дыру» их вылета, а проигрыш остальных составов решает недостаток огневой мощи, а не бак.
    // Подробности и перебор вариантов — в docs/balance-0.2.md.
    {
      cost: 90,
      modifiers: [
        { stat: 'fuel', op: 'add', value: 40, scope: 'self' },
        { stat: 'fuel', op: 'mul', value: 1.1, scope: 'aura' },
      ],
    },
    {
      cost: 140,
      modifiers: [
        { stat: 'fuel', op: 'mul', value: 1.2, scope: 'aura' },
        { stat: 'rearmTime', op: 'add', value: -4, scope: 'self' },
      ],
    },
    {
      cost: 210,
      modifiers: [],
      options: [
        {
          id: 'bigtank',
          name: 'Усиленная заправка',
          description: 'Топливо союзников в ауре ×2 сверху, свой бак +30 с: группы почти весь матч держатся в патруле.',
          modifiers: [
            { stat: 'fuel', op: 'mul', value: 2, scope: 'aura' },
            { stat: 'fuel', op: 'add', value: 30, scope: 'self' },
          ],
        },
        {
          id: 'wide',
          name: 'Непрерывное дежурство',
          description: 'Топливо союзников в ауре ×1,3, свой бак +30 с, перезарядка −4 с: заправщик реже пропадает из патруля и быстрее возвращается на позицию.',
          modifiers: [
            { stat: 'fuel', op: 'mul', value: 1.3, scope: 'aura' },
            { stat: 'fuel', op: 'add', value: 30, scope: 'self' },
            { stat: 'rearmTime', op: 'add', value: -4, scope: 'self' },
          ],
        },
      ],
    },
  ],
  visual: { shape: 'cylinder', model: MODELS.kc135, color: '#c9d4e0', scale: 1.2 },
};

export const GROUPS: Record<string, AirGroupConfig> = {
  [f16.id]: f16,
  [a10.id]: a10,
  [growler.id]: growler,
  [c130.id]: c130,
  [e3.id]: e3,
  [kc135.id]: kc135,
};

/** Сколько групп игрок берёт на вылет. */
export const LINEUP_SIZE = 3;
