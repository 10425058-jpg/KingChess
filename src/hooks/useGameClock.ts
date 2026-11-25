import { useEffect } from 'react';
import { TIME_CONTROLS, getLiveClocks, monotonicNow } from '../clock/clockController';
import { useGameStore } from '../stores/gameStore';

/**
 * Monitors active timed games and triggers exact monotonic timeout transitions
 * without forcing the 64-square board to re-render on every tick.
 */
export function useGameClock(): void {
  const view = useGameStore((s) => s.view);
  const timeControlId = useGameStore((s) => s.timeControlId);
  const activeColor = useGameStore((s) => s.clock.activeColor);
  const isPaused = useGameStore((s) => s.clock.isPaused);
  const result = useGameStore((s) => s.result);
  const triggerTimeout = useGameStore((s) => s.triggerTimeout);

  useEffect(() => {
    const cfg = TIME_CONTROLS[timeControlId];
    if (view !== 'game' || !cfg.isTimed || isPaused || !activeColor || result !== null) {
      return;
    }

    const checkTimeout = () => {
      const state = useGameStore.getState();
      if (state.result !== null || state.clock.isPaused || !state.clock.activeColor) {
        return;
      }
      const live = getLiveClocks(state.clock, monotonicNow());
      if (live.timedOutColor) {
        triggerTimeout(live.timedOutColor, monotonicNow());
      }
    };

    const intervalId = window.setInterval(checkTimeout, 100);
    return () => {
      window.clearInterval(intervalId);
    };
  }, [view, timeControlId, activeColor, isPaused, result, triggerTimeout]);
}
