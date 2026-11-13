import { useEffect, useRef } from 'react';
import { CONTENT } from '../../content';
import { createScene } from '../../render';
import { useGameStore } from '../../store/game';
import { startGame } from './driver';
import type { GameDriver } from './driver';
import { Shop } from './Shop';
import { UnitPanel } from './UnitPanel';
import { REJECT_TEXT, rejectionNotice, shopItems, slotClick, unitPanel, world } from './selectors';
import type { MissionConfig } from '../../sim';

const SEED = 1;

/** Холст карты, магазин и панель юнита. Игра мутируется только командами sim через драйвер. */
export function GameView({ mission }: { mission: MissionConfig }) {
  const host = useRef<HTMLDivElement>(null);
  const driver = useRef<GameDriver | null>(null);
  const snapshot = useGameStore((st) => st.snapshot);
  const shopSelection = useGameStore((st) => st.shopSelection);
  const selectedUnit = useGameStore((st) => st.selectedUnit);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const { setSnapshot, setNotice, selectUnit, selectShop } = useGameStore.getState();
    const game = startGame(mission, CONTENT, SEED, setSnapshot);
    driver.current = game;
    const scene = createScene(el, mission, CONTENT, {
      onSlotClick: (slot) => {
        const st = useGameStore.getState();
        if (!st.snapshot) return;
        const action = slotClick(world(mission, CONTENT, st.snapshot), st.shopSelection, slot);
        if (action.kind === 'select') selectUnit(action.unit);
        else if (action.kind === 'hint') setNotice(action.text);
        else {
          // Команда уходит в sim в любом случае (решает движок); подсказка — те же проверки sim, события тика могут не дойти до UI.
          game.dispatch(action.command);
          if (action.rejection) setNotice(REJECT_TEXT[action.rejection]);
        }
      },
    });
    const first = useGameStore.getState().snapshot;
    if (first) scene.update(first);
    const unsub = useGameStore.subscribe((s, prev) => {
      if (!s.snapshot || s.snapshot === prev.snapshot) return;
      scene.update(s.snapshot);
      const text = rejectionNotice(s.snapshot.events);
      if (text) setNotice(text);
    });
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      selectShop(null);
      selectUnit(null);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      unsub();
      game.stop();
      driver.current = null;
      scene.dispose();
      setSnapshot(null);
    };
  }, [mission]);

  const store = useGameStore.getState;
  const panel = snapshot ? unitPanel(world(mission, CONTENT, snapshot), selectedUnit) : null;
  return (
    <>
      <div ref={host} className="game-view" />
      <div className="dock">
        {snapshot && <Shop items={shopItems(CONTENT, snapshot)} selected={shopSelection} onSelect={(u) => store().selectShop(u)} />}
        {panel && (
          <UnitPanel
            model={panel}
            onUpgrade={() => driver.current?.dispatch({ type: 'upgrade', unit: panel.unit.id })}
            onSell={() => {
              driver.current?.dispatch({ type: 'sell', unit: panel.unit.id });
              store().selectUnit(null);
            }}
            onClose={() => store().selectUnit(null)}
          />
        )}
      </div>
    </>
  );
}
