import type { Content } from '../sim';
import { ENEMIES } from './enemies';
import { GROUPS } from './groups';

export { ENEMIES } from './enemies';
export { GROUPS, LINEUP_SIZE } from './groups';
export { MISSIONS } from './missions';
export { DEFAULT_LINEUP, DEFAULT_ZONES, START_PROFILE } from './profile';

export const CONTENT: Content = { enemies: ENEMIES, groups: GROUPS };
