import type { ClockSnapshot, ClockState, PieceColor, TimeControlId } from '../types/chess';

export interface TimeControlConfig {
  id: TimeControlId;
  label: string;
  shortLabel: string;
  baseMs: number;
  incrementMs: number;
  isTimed: boolean;
}

export const TIME_CONTROLS: Record<TimeControlId, TimeControlConfig> = {
  untimed: {
    id: 'untimed',
    label: 'Untimed',
    shortLabel: '∞',
    baseMs: 0,
    incrementMs: 0,
    isTimed: false,
  },
  '3+2': {
    id: '3+2',
    label: '3 min + 2 sec',
    shortLabel: '3+2',
    baseMs: 3 * 60 * 1000,
    incrementMs: 2 * 1000,
    isTimed: true,
  },
  '5+0': {
    id: '5+0',
    label: '5 min',
    shortLabel: '5+0',
    baseMs: 5 * 60 * 1000,
    incrementMs: 0,
    isTimed: true,
  },
  '10+0': {
    id: '10+0',
    label: '10 min',
    shortLabel: '10+0',
    baseMs: 10 * 60 * 1000,
    incrementMs: 0,
    isTimed: true,
  },
  '15+10': {
    id: '15+10',
    label: '15 min + 10 sec',
    shortLabel: '15+10',
    baseMs: 15 * 60 * 1000,
    incrementMs: 10 * 1000,
    isTimed: true,
  },
};

export const TIME_CONTROL_ORDER: readonly TimeControlId[] = [
  'untimed',
  '3+2',
  '5+0',
  '10+0',
  '15+10',
];

export function monotonicNow(): number {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
}

export function createInitialClockState(
  timeControlId: TimeControlId,
  activeColor: PieceColor | null,
  nowMs: number = monotonicNow(),
): ClockState {
  const cfg = TIME_CONTROLS[timeControlId];
  return {
    timeControlId,
    wMs: cfg.baseMs,
    bMs: cfg.baseMs,
    activeColor: cfg.isTimed ? activeColor : null,
    isPaused: false,
    lastUpdatedAtMs: cfg.isTimed && activeColor ? nowMs : null,
  };
}

export function getLiveClocks(
  clock: ClockState,
  nowMs: number = monotonicNow(),
): { wMs: number; bMs: number; timedOutColor: PieceColor | null } {
  const cfg = TIME_CONTROLS[clock.timeControlId];
  if (!cfg.isTimed) {
    return { wMs: 0, bMs: 0, timedOutColor: null };
  }

  let wMs = clock.wMs;
  let bMs = clock.bMs;

  if (!clock.isPaused && clock.activeColor && clock.lastUpdatedAtMs !== null) {
    const elapsed = Math.max(0, nowMs - clock.lastUpdatedAtMs);
    if (clock.activeColor === 'w') {
      wMs = Math.max(0, wMs - elapsed);
    } else {
      bMs = Math.max(0, bMs - elapsed);
    }
  }

  const timedOutColor: PieceColor | null =
    wMs <= 0 ? 'w' : bMs <= 0 ? 'b' : null;

  return { wMs, bMs, timedOutColor };
}

export function advanceClockOnMove(
  clock: ClockState,
  moverColor: PieceColor,
  nextActiveColor: PieceColor | null,
  nowMs: number = monotonicNow(),
): { nextClock: ClockState; snapshot: ClockSnapshot; timedOut: boolean } {
  const cfg = TIME_CONTROLS[clock.timeControlId];
  if (!cfg.isTimed) {
    const nextClock: ClockState = {
      timeControlId: clock.timeControlId,
      wMs: 0,
      bMs: 0,
      activeColor: null,
      isPaused: false,
      lastUpdatedAtMs: null,
    };
    return { nextClock, snapshot: { wMs: 0, bMs: 0 }, timedOut: false };
  }

  const live = getLiveClocks(clock, nowMs);
  const moverRemaining = moverColor === 'w' ? live.wMs : live.bMs;

  if (moverRemaining <= 0) {
    const stopped: ClockState = {
      timeControlId: clock.timeControlId,
      wMs: live.wMs,
      bMs: live.bMs,
      activeColor: null,
      isPaused: false,
      lastUpdatedAtMs: null,
    };
    return {
      nextClock: stopped,
      snapshot: { wMs: stopped.wMs, bMs: stopped.bMs },
      timedOut: true,
    };
  }

  // Apply increment once after the legal move completes
  const nextW = moverColor === 'w' ? live.wMs + cfg.incrementMs : live.wMs;
  const nextB = moverColor === 'b' ? live.bMs + cfg.incrementMs : live.bMs;

  const nextClock: ClockState = {
    timeControlId: clock.timeControlId,
    wMs: nextW,
    bMs: nextB,
    activeColor: nextActiveColor,
    isPaused: false,
    lastUpdatedAtMs: nextActiveColor ? nowMs : null,
  };

  return {
    nextClock,
    snapshot: { wMs: nextW, bMs: nextB },
    timedOut: false,
  };
}

export function pauseClock(
  clock: ClockState,
  nowMs: number = monotonicNow(),
): ClockState {
  const cfg = TIME_CONTROLS[clock.timeControlId];
  if (!cfg.isTimed) {
    return { ...clock, isPaused: true, lastUpdatedAtMs: null };
  }
  const live = getLiveClocks(clock, nowMs);
  return {
    ...clock,
    wMs: live.wMs,
    bMs: live.bMs,
    isPaused: true,
    lastUpdatedAtMs: null,
  };
}

export function resumeClock(
  clock: ClockState,
  nowMs: number = monotonicNow(),
): ClockState {
  const cfg = TIME_CONTROLS[clock.timeControlId];
  return {
    ...clock,
    isPaused: false,
    lastUpdatedAtMs: cfg.isTimed && clock.activeColor ? nowMs : null,
  };
}

export function stopClock(
  clock: ClockState,
  nowMs: number = monotonicNow(),
): ClockState {
  const live = getLiveClocks(clock, nowMs);
  return {
    ...clock,
    wMs: live.wMs,
    bMs: live.bMs,
    activeColor: null,
    isPaused: false,
    lastUpdatedAtMs: null,
  };
}

export function restoreClockFromSnapshot(
  timeControlId: TimeControlId,
  snapshot: ClockSnapshot,
  activeColor: PieceColor | null,
  isPaused: boolean,
  nowMs: number = monotonicNow(),
): ClockState {
  const cfg = TIME_CONTROLS[timeControlId];
  if (!cfg.isTimed) {
    return {
      timeControlId,
      wMs: 0,
      bMs: 0,
      activeColor: null,
      isPaused,
      lastUpdatedAtMs: null,
    };
  }
  return {
    timeControlId,
    wMs: Math.max(0, snapshot.wMs),
    bMs: Math.max(0, snapshot.bMs),
    activeColor,
    isPaused,
    lastUpdatedAtMs: !isPaused && activeColor ? nowMs : null,
  };
}

export function formatClockMs(ms: number): string {
  const clamped = Math.max(0, ms);
  if (clamped < 10_000) {
    const tenths = Math.floor(clamped / 100);
    const secs = Math.floor(tenths / 10);
    const remTenths = tenths % 10;
    return `0:${String(secs).padStart(2, '0')}.${remTenths}`;
  }
  const totalSeconds = Math.ceil(clamped / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
