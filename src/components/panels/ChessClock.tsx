import { useEffect, useState } from 'react';
import {
  TIME_CONTROLS,
  formatClockMs,
  getLiveClocks,
  monotonicNow,
} from '../../clock/clockController';
import { useGameStore } from '../../stores/gameStore';
import type { PieceColor } from '../../types/chess';

interface ChessClockProps {
  color: PieceColor;
}

export function ChessClock({ color }: ChessClockProps) {
  const clock = useGameStore((s) => s.clock);
  const [, setTick] = useState(0);

  const cfg = TIME_CONTROLS[clock.timeControlId];
  const isRunning =
    cfg.isTimed &&
    !clock.isPaused &&
    clock.activeColor === color &&
    clock.lastUpdatedAtMs !== null;

  useEffect(() => {
    if (!isRunning) {
      return;
    }
    const id = window.setInterval(() => {
      setTick((t) => (t + 1) % 1_000_000);
    }, 100);
    return () => window.clearInterval(id);
  }, [isRunning]);

  if (!cfg.isTimed) {
    return (
      <div
        className="kc-clock"
        aria-label={`${color === 'w' ? 'White' : 'Black'} clock: Untimed`}
        data-testid={`clock-${color}`}
      >
        ∞
      </div>
    );
  }

  const live = getLiveClocks(clock, monotonicNow());
  const ms = color === 'w' ? live.wMs : live.bMs;
  const isLow = ms <= 20_000;

  return (
    <div
      className={[
        'kc-clock',
        isRunning ? 'is-running' : '',
        isLow ? 'is-low' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      aria-label={`${color === 'w' ? 'White' : 'Black'} remaining time ${formatClockMs(ms)}`}
      data-testid={`clock-${color}`}
    >
      {formatClockMs(ms)}
    </div>
  );
}
