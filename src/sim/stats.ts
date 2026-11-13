import type { Modifier, StatKey, Stats } from './types';

/** Итог = (база + Σadd) * Πmul, порядок модификаторов не важен. */
export function applyModifiers(base: Stats, mods: readonly Modifier[]): Stats {
  const add: Stats = {};
  const mul: Stats = {};
  for (const m of mods) {
    if (m.op === 'add') add[m.stat] = (add[m.stat] ?? 0) + m.value;
    else mul[m.stat] = (mul[m.stat] ?? 1) * m.value;
  }
  const out: Stats = {};
  const keys = new Set([...Object.keys(base), ...Object.keys(add), ...Object.keys(mul)] as StatKey[]);
  for (const k of keys) out[k] = ((base[k] ?? 0) + (add[k] ?? 0)) * (mul[k] ?? 1);
  return out;
}
