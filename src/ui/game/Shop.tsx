import { UnitCard } from '../entity/UnitCard';
import type { ShopItem } from './selectors';

interface Props {
  items: readonly ShopItem[];
  selected: string | null;
  onSelect: (unit: string) => void;
}

/** Магазин: по карточке на каждый юнит реестра; недоступные по деньгам отключены. */
export function Shop({ items, selected, onSelect }: Props) {
  return (
    <div className="shop" data-testid="shop">
      {items.map(({ unit, affordable }) => (
        <div
          key={unit.id}
          className="shop-item"
          data-testid="shop-item"
          data-id={unit.id}
          data-selected={selected === unit.id}
          data-disabled={!affordable}
          role="button"
          aria-disabled={!affordable}
          tabIndex={affordable ? 0 : -1}
          onClick={() => affordable && onSelect(unit.id)}
          onKeyDown={(e) => affordable && (e.key === 'Enter' || e.key === ' ') && onSelect(unit.id)}
        >
          <UnitCard unit={unit} />
        </div>
      ))}
    </div>
  );
}
