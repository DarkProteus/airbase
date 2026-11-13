import type { Content } from '../sim';
import { ENEMIES } from './enemies';
import { GROUPS } from './groups';
import { UNITS } from './units';

export { ENEMIES } from './enemies';
export { DEFAULT_LINEUP, GROUPS } from './groups';
export { MISSIONS } from './missions';
export { UNITS } from './units';

export const CONTENT: Content = { units: UNITS, enemies: ENEMIES, groups: GROUPS };
