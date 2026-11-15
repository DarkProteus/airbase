import { roleIcon } from './roleIcons';

/** Значок роли группы: один и тот же на карточке (база, галерея) и в панели групп боя. Всё берётся из таблицы roleIcons. */
export function RoleIcon({ role, size = 18 }: { role: string | undefined; size?: number }) {
  const icon = roleIcon(role);
  return (
    <span className="role-icon" title={icon.label} role="img" aria-label={icon.label} data-role={role}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {icon.paths.map((d, i) => (
          <path key={i} d={d} />
        ))}
      </svg>
    </span>
  );
}
