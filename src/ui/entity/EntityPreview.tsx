import type { VisualConfig } from '../../sim';
import { visualOf } from './model';
import type { Visual } from './model';

interface Props {
  /** Любая сущность с тегами (группа с ролью, враг). Всё берётся из конфига. */
  entity: { role?: string; tags: readonly string[]; visual?: VisualConfig };
  size?: number;
}

function Body({ v }: { v: Visual }) {
  const s = 22 * v.size;
  const c = v.color;
  const shade = (o: number) => ({ fill: '#000', opacity: o });
  switch (v.shape) {
    case 'cube':
      return (
        <g>
          <polygon points={`0,${-s} ${s},${-s / 2} 0,0 ${-s},${-s / 2}`} fill={c} />
          <polygon points={`${-s},${-s / 2} 0,0 0,${s} ${-s},${s / 2}`} fill={c} />
          <polygon points={`${-s},${-s / 2} 0,0 0,${s} ${-s},${s / 2}`} {...shade(0.25)} />
          <polygon points={`0,0 ${s},${-s / 2} ${s},${s / 2} 0,${s}`} fill={c} />
          <polygon points={`0,0 ${s},${-s / 2} ${s},${s / 2} 0,${s}`} {...shade(0.45)} />
        </g>
      );
    case 'cylinder':
      return (
        <g>
          <ellipse cx={0} cy={0.6 * s} rx={s} ry={s / 2} fill={c} />
          <rect x={-s} y={-s} width={2 * s} height={1.6 * s} fill={c} />
          <path
            d={`M0 ${1.1 * s} A${s} ${s / 2} 0 0 0 ${s} ${0.6 * s} L${s} ${-s} L0 ${-s} Z`}
            {...shade(0.3)}
          />
          <ellipse cx={0} cy={-s} rx={s} ry={s / 2} fill={c} />
        </g>
      );
    case 'pyramid':
      return (
        <g>
          <polygon points={`0,${-1.6 * s} ${-s},${s / 2} 0,${s}`} fill={c} />
          <polygon points={`0,${-1.6 * s} ${-s},${s / 2} 0,${s}`} {...shade(0.2)} />
          <polygon points={`0,${-1.6 * s} 0,${s} ${s},${s / 2}`} fill={c} />
          <polygon points={`0,${-1.6 * s} 0,${s} ${s},${s / 2}`} {...shade(0.45)} />
        </g>
      );
    case 'sphere':
      return (
        <g>
          <circle cx={0} cy={0} r={s} fill={c} />
          <circle cx={-s * 0.3} cy={-s * 0.3} r={s * 0.45} fill="#fff" opacity={0.25} />
        </g>
      );
  }
}

/** Превью сущности из конфига (visual): форма, цвет, масштаб и высота полёта те же, что в сцене. */
export function EntityPreview({ entity, size = 128 }: Props) {
  const v = visualOf(entity);
  const lift = v.altitude * 24;
  return (
    <svg
      width={size}
      height={size}
      viewBox="-75 -90 150 150"
      role="img"
      aria-label={`${v.shape} ${v.flying ? 'air' : 'ground'}`}
      data-shape={v.shape}
      data-flying={v.flying}
    >
      <ellipse cx={0} cy={22} rx={26 * v.size} ry={9 * v.size} fill="#000" opacity={v.flying ? 0.2 : 0.35} />
      <g transform={`translate(0 ${-lift + 8})`}>
        <Body v={v} />
      </g>
    </svg>
  );
}
