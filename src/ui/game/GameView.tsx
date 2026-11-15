import { useEffect, useRef } from 'react';
import { CONTENT } from '../../content';
import { createScene } from '../../render';
import { useGameStore } from '../../store/game';
import { startGame } from './driver';
import { GroupPanel } from './GroupPanel';
import { waveWarning } from './markup';
import { entryLabel, WaveWarning } from './WaveWarning';
import { groupRows, REJECT_TEXT, rejectionNotice, world, zoneClick } from './selectors';
import type { LineupEntry, MissionConfig, SimState } from '../../sim';

/** Точки входа ближайшей волны для подсветки на карте (пусто, если волна не ожидается). */
const warningPoints = (mission: MissionConfig, state: SimState) =>
  (waveWarning(world(mission, CONTENT, state))?.entries ?? []).map((e) => ({ at: e.at, label: entryLabel(e.spawn) }));

/** Холст карты и панель авиагрупп; `lineup` держать стабильным (смена `mission`/`lineup`/`seed` перезапускает бой). Игра мутируется только командами sim через драйвер. */
export function GameView({ mission, lineup, seed }: { mission: MissionConfig; lineup: readonly LineupEntry[]; seed: number }) {
  const host = useRef<HTMLDivElement>(null);
  const snapshot = useGameStore((st) => st.snapshot);
  const selectedGroup = useGameStore((st) => st.selectedGroup);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const { setSnapshot, setNotice, selectGroup } = useGameStore.getState();
    const game = startGame(mission, CONTENT, seed, setSnapshot, lineup);
    const scene = createScene(el, mission, CONTENT, {
      // Выбрана группа — клик по карте ставит или переносит её зону.
      onMapClick: (cell) => {
        const st = useGameStore.getState();
        if (!st.snapshot) return;
        const action = zoneClick(world(mission, CONTENT, st.snapshot), st.selectedGroup, cell);
        if (!action) return;
        // Команда уходит в sim в любом случае (решает движок); подсказка — те же проверки sim.
        game.dispatch(action.command);
        if (action.rejection) setNotice(REJECT_TEXT[action.rejection]);
      },
    });
    const first = useGameStore.getState().snapshot;
    if (first) {
      scene.update(first);
      scene.setWarning(warningPoints(mission, first));
    }
    scene.setSelectedGroup(useGameStore.getState().selectedGroup);
    const unsub = useGameStore.subscribe((s, prev) => {
      if (s.selectedGroup !== prev.selectedGroup) scene.setSelectedGroup(s.selectedGroup);
      if (!s.snapshot || s.snapshot === prev.snapshot) return;
      scene.update(s.snapshot);
      scene.setWarning(warningPoints(mission, s.snapshot));
      const text = rejectionNotice(s.snapshot.events);
      if (text) setNotice(text);
    });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') selectGroup(null);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      unsub();
      game.stop();
      scene.dispose();
      // Следующий бой не должен видеть снапшот, выбор и сообщение прошлого.
      setSnapshot(null);
      selectGroup(null);
      setNotice(null);
    };
  }, [mission, lineup, seed]);

  const store = useGameStore.getState;
  const warning = snapshot && waveWarning(world(mission, CONTENT, snapshot));
  return (
    <>
      <div ref={host} className="game-view" />
      {warning && <WaveWarning warning={warning} />}
      {snapshot && (
        <GroupPanel
          rows={groupRows(world(mission, CONTENT, snapshot))}
          selected={selectedGroup}
          roles={Object.fromEntries(snapshot.groups.map((g) => [g.id, CONTENT.groups[g.type]?.role]))}
          onSelect={(g) => store().selectGroup(g)}
        />
      )}
    </>
  );
}
