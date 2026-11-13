import type { Content } from '../sim';
import { ENEMIES } from './enemies';
import { GROUPS } from './groups';

export { ENEMIES } from './enemies';
export { DEFAULT_LINEUP, GROUPS, LINEUP_SIZE } from './groups';
export { MISSIONS } from './missions';

export const CONTENT: Content = { enemies: ENEMIES, groups: GROUPS };
