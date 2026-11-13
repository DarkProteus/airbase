import { UnitCard } from '../entity/UnitCard';
import { REJECT_TEXT } from './selectors';
import type { UnitPanelModel } from './selectors';

interface Props {
  model: UnitPanelModel;
  onUpgrade: () => void;
  onSell: () => void;
  onClose: () => void;
}

/** Панель выбранного юнита: его карточка на текущем уровне + улучшить/продать. */
export function UnitPanel({ model, onUpgrade, onSell, onClose }: Props) {
  const { config, view, upgradeCost, upgradeBlocked, refund } = model;
  return (
    <div className="unit-panel" data-testid="unit-panel" data-id={model.unit.id}>
      <UnitCard unit={config} view={view} />
      <div className="unit-actions">
        <button
          type="button"
          data-testid="upgrade"
          disabled={upgradeBlocked !== undefined}
          title={upgradeBlocked && REJECT_TEXT[upgradeBlocked]}
          onClick={onUpgrade}
        >
          {upgradeCost === undefined ? 'Макс. уровень' : `Улучшить (${upgradeCost})`}
        </button>
        <button type="button" data-testid="sell" onClick={onSell}>
          Продать (+{refund})
        </button>
        <button type="button" data-testid="close-panel" onClick={onClose}>
          Закрыть
        </button>
      </div>
    </div>
  );
}
