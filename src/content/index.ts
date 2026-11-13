import type { Content } from '../sim';
import { ENEMIES } from './enemies';
import { UNITS } from './units';

export { ENEMIES } from './enemies';
export { MISSIONS } from './missions';
export { UNITS } from './units';

export const CONTENT: Content = { units: UNITS, enemies: ENEMIES };
