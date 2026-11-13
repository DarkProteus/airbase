import { useEffect, useRef } from 'react';
import { CONTENT } from '../../content';
import { createScene } from '../../render';
import { useGameStore } from '../../store/game';
import { startGame } from './driver';
import type { MissionConfig } from '../../sim';

const SEED = 1;

/** Выбор юнита для клика по слоту: первый по реестру, на который хватает денег (иначе первый). */
function pickUnit(money: number): string | undefined {
  const units = Object.values(CONTENT.units);
  return (units.find((u) => u.cost <= money) ?? units[0])?.id;
}

/** Холст карты + запуск миссии. Игра мутируется только командами sim через драйвер. */
export function GameView({ mission }: { mission: MissionConfig }) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const setSnapshot = useGameStore.getState().setSnapshot;
    const driver = startGame(mission, CONTENT, SEED, setSnapshot);
    const scene = createScene(el, mission, CONTENT, {
      onSlotClick: (slot) => {
        const unit = pickUnit(useGameStore.getState().snapshot?.money ?? 0);
        if (unit) driver.dispatch({ type: 'buy', unit, slot });
      },
    });
    const first = useGameStore.getState().snapshot;
    if (first) scene.update(first);
    const unsub = useGameStore.subscribe((s, prev) => {
      if (s.snapshot && s.snapshot !== prev.snapshot) scene.update(s.snapshot);
    });
    return () => {
      unsub();
      driver.stop();
      scene.dispose();
      setSnapshot(null);
    };
  }, [mission]);

  return <div ref={host} className="game-view" />;
}
