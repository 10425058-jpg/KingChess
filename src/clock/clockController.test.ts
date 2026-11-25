import { describe, expect, it } from 'vitest';
import {
  TIME_CONTROLS,
  advanceClockOnMove,
  createInitialClockState,
  formatClockMs,
  getLiveClocks,
  pauseClock,
  restoreClockFromSnapshot,
  resumeClock,
} from './clockController';

describe('clockController', () => {
  it('measures elapsed time monotonically and applies increment once per legal move', () => {
    let clock = createInitialClockState('3+2', 'w', 1000);
    expect(clock.wMs).toBe(180_000);
    expect(clock.bMs).toBe(180_000);

    // 4 seconds pass while White thinks
    const live1 = getLiveClocks(clock, 5000);
    expect(live1.wMs).toBe(176_000);
    expect(live1.bMs).toBe(180_000);
    expect(live1.timedOutColor).toBeNull();

    // White plays legal move at t=5000 -> -4000ms + 2000ms increment = 178,000ms
    const step1 = advanceClockOnMove(clock, 'w', 'b', 5000);
    expect(step1.timedOut).toBe(false);
    expect(step1.snapshot).toEqual({ wMs: 178_000, bMs: 180_000 });
    expect(step1.nextClock.activeColor).toBe('b');

    // Black thinks for 10 seconds and moves at t=15000 -> 170,000 + 2,000 = 172,000ms
    clock = step1.nextClock;
    const step2 = advanceClockOnMove(clock, 'b', 'w', 15_000);
    expect(step2.snapshot).toEqual({ wMs: 178_000, bMs: 172_000 });
  });

  it('pauses, resumes, detects timeout, and restores snapshot on undo', () => {
    let clock = createInitialClockState('5+0', 'w', 10_000);
    clock = pauseClock(clock, 12_500);
    expect(clock.wMs).toBe(297_500);
    expect(clock.isPaused).toBe(true);

    // Time elapsing while paused must not deduct
    expect(getLiveClocks(clock, 99_999).wMs).toBe(297_500);

    clock = resumeClock(clock, 100_000);
    expect(getLiveClocks(clock, 102_500).wMs).toBe(295_000);

    // Timeout detection
    const expired = getLiveClocks(clock, 100_000 + 300_000);
    expect(expired.wMs).toBe(0);
    expect(expired.timedOutColor).toBe('w');

    // Restore from snapshot (e.g. undo)
    const restored = restoreClockFromSnapshot(
      '5+0',
      { wMs: 297_500, bMs: 300_000 },
      'w',
      false,
      200_000,
    );
    expect(restored.wMs).toBe(297_500);
    expect(restored.lastUpdatedAtMs).toBe(200_000);
  });

  it('formats standard and low-time clock displays cleanly', () => {
    expect(TIME_CONTROLS['15+10'].incrementMs).toBe(10_000);
    expect(formatClockMs(180_000)).toBe('03:00');
    expect(formatClockMs(9_450)).toBe('0:09.4');
    expect(formatClockMs(0)).toBe('0:00.0');
  });
});
