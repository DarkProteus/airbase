import { createSim, DT, snapshot, step } from '../../sim';
import type { Command, Content, MissionConfig, SimEvent, SimState } from '../../sim';

/**
 * Тонкий игровой цикл вне src/sim: аккумулятор реального времени -> целое число фиксированных шагов sim.
 * Время кадра берётся из rAF-метки (здесь, в UI-слое), sim остаётся детерминированным и считает в тиках.
 */

export interface GameDriver {
  /** Поставить команду в очередь; применится на ближайшем шаге. */
  dispatch(command: Command): void;
  stop(): void;
}

/** Не больше шагов за кадр: после паузы вкладки не «догоняем» лавиной. */
const MAX_STEPS_PER_FRAME = 8;

/** Снапшот с событиями всех шагов кадра вместо одного последнего тика (снапшот — копия, мутировать можно). */
export function withEvents(state: SimState, events: readonly SimEvent[]): SimState {
  state.events = [...events];
  return state;
}

export function startGame(
  mission: MissionConfig,
  content: Content,
  seed: number,
  onSnapshot: (state: SimState) => void,
): GameDriver {
  const sim = createSim(mission, content, seed);
  let queue: Command[] = [];
  let acc = 0;
  let last: number | null = null;
  let raf = 0;
  let stopped = false;

  onSnapshot(snapshot(sim));

  const frame = (now: number) => {
    if (stopped) return;
    raf = requestAnimationFrame(frame);
    const dt = last === null ? 0 : (now - last) / 1000;
    last = now;
    acc += dt;
    let steps = 0;
    // События живут один тик, а в стор уходит только последний снапшот: копим события всех шагов кадра.
    const events: SimEvent[] = [];
    // Команды применяются на первом шаге кадра, даже если шагов в этом кадре нет — ждём следующего.
    while (acc >= DT && steps < MAX_STEPS_PER_FRAME && sim.state.status === 'running') {
      step(sim, queue);
      events.push(...sim.state.events);
      queue = [];
      acc -= DT;
      steps++;
    }
    if (steps === MAX_STEPS_PER_FRAME) acc = 0;
    if (steps > 0) onSnapshot(withEvents(snapshot(sim), events));
  };
  raf = requestAnimationFrame(frame);

  return {
    dispatch: (command) => void queue.push(command),
    stop: () => {
      stopped = true;
      cancelAnimationFrame(raf);
    },
  };
}
