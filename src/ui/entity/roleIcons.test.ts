import { expect, test } from 'vitest';
import { GROUPS } from '../../content';
import { FALLBACK_ROLE_ICON, ROLE_ICONS, roleIcon } from './roleIcons';

test('у каждой роли из реестра групп есть собственный (не запасной) значок', () => {
  const roles = new Set(Object.values(GROUPS).map((g) => g.role));
  expect(roles.size).toBeGreaterThan(0);
  for (const role of roles) {
    const icon = roleIcon(role);
    expect(icon, role).not.toBe(FALLBACK_ROLE_ICON);
    expect(icon.paths.length, role).toBeGreaterThan(0);
  }
});

test('значки разных ролей различаются, а неизвестная роль даёт запасной', () => {
  const drawn = Object.values(ROLE_ICONS).map((i) => i.paths.join('|'));
  expect(new Set(drawn).size).toBe(drawn.length);
  expect(drawn).not.toContain(FALLBACK_ROLE_ICON.paths.join('|'));
  expect(roleIcon('submarine')).toBe(FALLBACK_ROLE_ICON);
  expect(roleIcon(undefined)).toBe(FALLBACK_ROLE_ICON);
  expect(roleIcon('toString')).toBe(FALLBACK_ROLE_ICON);
});
