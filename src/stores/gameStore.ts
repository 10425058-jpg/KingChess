import type { Square } from 'chess.js';
import { create } from 'zustand';
import { soundEngine } from '../audio/soundEngine';
import {
  TIME_CONTROLS,
  advanceClockOnMove,
  createInitialClockState,
  getLiveClocks,
  monotonicNow,
  pauseClock,
  restoreClockFromSnapshot,
  resumeClock,
  stopClock,
} from '../clock/clockController';
import {
  DEFAULT_POSITION,
  createChessFromPosition,
  getLegalMovesForSquare,
  hasMatingMaterialForTimeout,
  isLegalMoveInput,
  parseUciMove,
  requiresPromotionChoice,
  type PositionSnapshot,
} from '../engine/chessRules';
import {
  clearSavedGameSession,
  loadSavedGameSession,
  saveGameSession,
} from '../storage/persistence';
import { useSettingsStore } from './settingsStore';
import type {
  ClockSnapshot,
  ClockState,
  DifficultyId,
  DrawClaimType,
  GameMode,
  GamePhase,
  GameResult,
  MoveRecord,
  PendingPromotion,
  PieceColor,
  PlayerColorChoice,
  PositionEvaluation,
  PromotionPiece,
  SavedGameV1,
  TimeControlId,
} from '../types/chess';

export interface StartGameConfig {
  mode: GameMode;
  playerColorChoice: PlayerColorChoice;
  difficulty: DifficultyId;
  timeControlId: TimeControlId;
  initialFen?: string;
  nowMs?: number;
}

export interface HintMove {
  from: Square;
  to: Square;
  uci: string;
}

interface GameStoreState {
  view: 'lobby' | 'game';
  phase: GamePhase;
  sessionId: number;
  positionToken: number;

  mode: GameMode;
  humanColor: PieceColor;
  difficulty: DifficultyId;
  timeControlId: TimeControlId;

  initialFen: string;
  moves: MoveRecord[];
  fens: string[];
  liveSnapshot: PositionSnapshot;
  viewPly: number;
  reviewSnapshot: PositionSnapshot;

  selectedSquare: Square | null;
  legalTargetsForSelected: Square[];
  captureTargetsForSelected: Square[];
  pendingPromotion: PendingPromotion | null;
  flipped: boolean;
  lastMoveWasDrag: boolean;

  clock: ClockState;
  clockSnapshots: ClockSnapshot[];
  result: GameResult | null;
  showGameOverModal: boolean;
  drawOfferFrom: PieceColor | null;

  evaluation: PositionEvaluation | null;
  hintMove: HintMove | null;
  isHintPending: boolean;
  aiWarning: string | null;

  savedSession: SavedGameV1 | null;
  corruptSaveNotice: string | null;

  // Actions
  refreshSavedSession: () => void;
  dismissCorruptSaveNotice: () => void;
  startNewGame: (config: StartGameConfig) => void;
  rematch: (nowMs?: number) => void;
  resumeSavedGame: (nowMs?: number) => boolean;
  goToLobby: () => void;

  selectSquare: (square: Square, nowMs?: number) => void;
  attemptMove: (
    from: Square,
    to: Square,
    promotion?: PromotionPiece,
    nowMs?: number,
    options?: { fromDrag?: boolean },
  ) => 'moved' | 'promotion_pending' | 'illegal';
  commitPromotion: (piece: PromotionPiece, nowMs?: number) => boolean;
  cancelPromotion: () => void;

  applyAiMove: (payload: {
    sessionId: number;
    positionToken: number;
    uciMove: string;
    evaluation: PositionEvaluation | null;
    usedFallback: boolean;
    fallbackReason?: string;
  }, nowMs?: number) => boolean;
  setLiveEvaluation: (
    sessionId: number,
    positionToken: number,
    evaluation: PositionEvaluation,
  ) => void;
  setAiWarning: (warning: string | null) => void;

  undoMove: (nowMs?: number) => boolean;
  flipBoard: () => void;
  togglePause: (nowMs?: number) => void;

  claimDraw: (type: DrawClaimType, nowMs?: number) => boolean;
  offerDraw: () => void;
  acceptDraw: (nowMs?: number) => void;
  declineDraw: () => void;
  resign: (color?: PieceColor, nowMs?: number) => void;
  triggerTimeout: (loserColor: PieceColor, nowMs?: number) => boolean;

  reviewGoToPly: (ply: number) => void;
  reviewFirst: () => void;
  reviewPrev: () => void;
  reviewNext: () => void;
  reviewLast: () => void;
  enterReviewAfterGameOver: () => void;
  openGameOverModal: () => void;
  closeGameOverModal: () => void;

  setHintMove: (hint: HintMove | null) => void;
  setHintPending: (pending: boolean) => void;
  clearSavedSession: () => void;
}

const initialBoard = createChessFromPosition(DEFAULT_POSITION, []);
const initialLoadedSave = loadSavedGameSession();

function resolveLivePhase(
  mode: GameMode,
  humanColor: PieceColor,
  snapshot: PositionSnapshot,
  result: GameResult | null,
  pendingPromotion: PendingPromotion | null,
): GamePhase {
  if (result !== null) {
    return 'GAME_OVER';
  }
  if (pendingPromotion !== null) {
    return 'PROMOTION_PENDING';
  }
  if (mode === 'ai' && snapshot.turn !== humanColor) {
    return 'AI_THINKING';
  }
  return 'PLAYER_TURN';
}

function buildSavedSessionPayload(state: {
  mode: GameMode;
  humanColor: PieceColor;
  difficulty: DifficultyId;
  timeControlId: TimeControlId;
  initialFen: string;
  moves: MoveRecord[];
  flipped: boolean;
  clock: ClockState;
  clockSnapshots: ClockSnapshot[];
  result: GameResult | null;
}): SavedGameV1 {
  const live = getLiveClocks(state.clock);
  return {
    version: 1,
    savedAt: new Date().toISOString(),
    mode: state.mode,
    humanColor: state.humanColor,
    difficulty: state.difficulty,
    timeControlId: state.timeControlId,
    initialFen: state.initialFen,
    uciMoves: state.moves.map((m) => m.uci),
    flipped: state.flipped,
    clockSnapshots: state.clockSnapshots,
    currentClocks: {
      wMs: live.wMs,
      bMs: live.bMs,
    },
    isPaused: state.clock.isPaused,
    result: state.result,
  };
}

function persistStateSnapshot(state: {
  mode: GameMode;
  humanColor: PieceColor;
  difficulty: DifficultyId;
  timeControlId: TimeControlId;
  initialFen: string;
  moves: MoveRecord[];
  flipped: boolean;
  clock: ClockState;
  clockSnapshots: ClockSnapshot[];
  result: GameResult | null;
}): SavedGameV1 {
  const payload = buildSavedSessionPayload(state);
  saveGameSession(payload);
  return payload;
}

function playMoveCue(move: MoveRecord, result: GameResult | null): void {
  const soundEnabled = useSettingsStore.getState().soundEnabled;
  if (!soundEnabled) return;

  if (result) {
    soundEngine.play('gameOver', true);
  } else if (move.isCheck) {
    soundEngine.play('check', true);
  } else if (move.promotion) {
    soundEngine.play('promote', true);
  } else if (move.isCastle) {
    soundEngine.play('castle', true);
  } else if (move.isCapture) {
    soundEngine.play('capture', true);
  } else {
    soundEngine.play('move', true);
  }
}

function computeTimeoutResult(fen: string, loserColor: PieceColor): GameResult {
  const winner: PieceColor = loserColor === 'w' ? 'b' : 'w';
  if (!hasMatingMaterialForTimeout(fen, winner)) {
    return {
      winner: 'draw',
      reason: 'timeout-insufficient-material',
      message: 'Draw — timeout vs insufficient material',
    };
  }
  const winnerName = winner === 'w' ? 'White' : 'Black';
  return {
    winner,
    reason: 'timeout',
    message: `${winnerName} wins on time`,
  };
}

export function canUndoInState(state: {
  view: 'lobby' | 'game';
  mode: GameMode;
  humanColor: PieceColor;
  moves: MoveRecord[];
  result: GameResult | null;
}): boolean {
  if (state.view !== 'game' || state.result !== null) {
    return false;
  }
  if (state.mode === 'local') {
    return state.moves.length > 0;
  }
  // In AI mode, the user can undo back to their previous decision
  // provided they have made at least one move.
  return state.moves.some((m) => m.color === state.humanColor);
}

export const useGameStore = create<GameStoreState>((set, get) => ({
  view: 'lobby',
  phase: 'SETUP',
  sessionId: 0,
  positionToken: 0,

  mode: 'ai',
  humanColor: 'w',
  difficulty: 'medium',
  timeControlId: '10+0',

  initialFen: DEFAULT_POSITION,
  moves: [],
  fens: initialBoard.fens,
  liveSnapshot: initialBoard.snapshot,
  viewPly: 0,
  reviewSnapshot: initialBoard.snapshot,

  selectedSquare: null,
  legalTargetsForSelected: [],
  captureTargetsForSelected: [],
  pendingPromotion: null,
  flipped: false,
  lastMoveWasDrag: false,

  clock: createInitialClockState('10+0', null),
  clockSnapshots: [{ wMs: 600_000, bMs: 600_000 }],
  result: null,
  showGameOverModal: false,
  drawOfferFrom: null,

  evaluation: null,
  hintMove: null,
  isHintPending: false,
  aiWarning: null,

  savedSession: initialLoadedSave.session,
  corruptSaveNotice: initialLoadedSave.corruptError,

  refreshSavedSession: () => {
    const loaded = loadSavedGameSession();
    set({
      savedSession: loaded.session,
      corruptSaveNotice: loaded.corruptError,
    });
  },

  dismissCorruptSaveNotice: () => set({ corruptSaveNotice: null }),

  startNewGame: ({
    mode,
    playerColorChoice,
    difficulty,
    timeControlId,
    initialFen = DEFAULT_POSITION,
    nowMs = monotonicNow(),
  }) => {
    const humanColor: PieceColor =
      mode === 'local'
        ? 'w'
        : playerColorChoice === 'random'
          ? Math.random() < 0.5
            ? 'w'
            : 'b'
          : playerColorChoice;

    const replayed = createChessFromPosition(initialFen, []);
    const autoResult = replayed.snapshot.automaticResult;
    const clock = autoResult
      ? stopClock(createInitialClockState(timeControlId, null, nowMs), nowMs)
      : createInitialClockState(timeControlId, replayed.snapshot.turn, nowMs);
    const clockSnapshots: ClockSnapshot[] = [{ wMs: clock.wMs, bMs: clock.bMs }];
    const flipped = mode === 'ai' ? humanColor === 'b' : false;
    const phase = resolveLivePhase(
      mode,
      humanColor,
      replayed.snapshot,
      autoResult,
      null,
    );

    const saved = persistStateSnapshot({
      mode,
      humanColor,
      difficulty,
      timeControlId,
      initialFen,
      moves: [],
      flipped,
      clock,
      clockSnapshots,
      result: autoResult,
    });

    set((state) => ({
      view: 'game',
      phase,
      sessionId: state.sessionId + 1,
      positionToken: state.positionToken + 1,
      mode,
      humanColor,
      difficulty,
      timeControlId,
      initialFen,
      moves: [],
      fens: replayed.fens,
      liveSnapshot: replayed.snapshot,
      viewPly: 0,
      reviewSnapshot: replayed.snapshot,
      selectedSquare: null,
      legalTargetsForSelected: [],
      captureTargetsForSelected: [],
      pendingPromotion: null,
      flipped,
      lastMoveWasDrag: false,
      clock,
      clockSnapshots,
      result: autoResult,
      showGameOverModal: autoResult !== null,
      drawOfferFrom: null,
      evaluation: null,
      hintMove: null,
      isHintPending: false,
      aiWarning: null,
      savedSession: saved,
      corruptSaveNotice: null,
    }));
  },

  rematch: (nowMs = monotonicNow()) => {
    const state = get();
    const nextColorChoice: PlayerColorChoice =
      state.mode === 'ai' ? (state.humanColor === 'w' ? 'b' : 'w') : 'w';
    state.startNewGame({
      mode: state.mode,
      playerColorChoice: nextColorChoice,
      difficulty: state.difficulty,
      timeControlId: state.timeControlId,
      initialFen: DEFAULT_POSITION,
      nowMs,
    });
  },

  resumeSavedGame: (nowMs = monotonicNow()) => {
    const loaded = loadSavedGameSession();
    if (!loaded.session) {
      set({
        savedSession: null,
        corruptSaveNotice: loaded.corruptError,
      });
      return false;
    }

    const s = loaded.session;
    const replayed = createChessFromPosition(s.initialFen, s.uciMoves);
    const result = s.result ?? replayed.snapshot.automaticResult;
    const clock = result
      ? stopClock(
          restoreClockFromSnapshot(
            s.timeControlId,
            s.currentClocks,
            null,
            false,
            nowMs,
          ),
          nowMs,
        )
      : restoreClockFromSnapshot(
          s.timeControlId,
          s.currentClocks,
          replayed.snapshot.turn,
          s.isPaused,
          nowMs,
        );
    const phase = resolveLivePhase(
      s.mode,
      s.humanColor,
      replayed.snapshot,
      result,
      null,
    );

    set((state) => ({
      view: 'game',
      phase,
      sessionId: state.sessionId + 1,
      positionToken: state.positionToken + 1,
      mode: s.mode,
      humanColor: s.humanColor,
      difficulty: s.difficulty,
      timeControlId: s.timeControlId,
      initialFen: s.initialFen,
      moves: replayed.moves,
      fens: replayed.fens,
      liveSnapshot: replayed.snapshot,
      viewPly: replayed.moves.length,
      reviewSnapshot: replayed.snapshot,
      selectedSquare: null,
      legalTargetsForSelected: [],
      captureTargetsForSelected: [],
      pendingPromotion: null,
      flipped: s.flipped,
      lastMoveWasDrag: false,
      clock,
      clockSnapshots: s.clockSnapshots,
      result,
      showGameOverModal: result !== null,
      drawOfferFrom: null,
      evaluation: null,
      hintMove: null,
      isHintPending: false,
      aiWarning: null,
      savedSession: s,
      corruptSaveNotice: null,
    }));
    return true;
  },

  goToLobby: () => {
    const state = get();
    let nextSaved = state.savedSession;
    if (state.view === 'game') {
      const paused =
        state.result === null
          ? pauseClock(state.clock, monotonicNow())
          : state.clock;
      nextSaved = persistStateSnapshot({
        mode: state.mode,
        humanColor: state.humanColor,
        difficulty: state.difficulty,
        timeControlId: state.timeControlId,
        initialFen: state.initialFen,
        moves: state.moves,
        flipped: state.flipped,
        clock: paused,
        clockSnapshots: state.clockSnapshots,
        result: state.result,
      });
    }
    set((prev) => ({
      view: 'lobby',
      phase: 'SETUP',
      positionToken: prev.positionToken + 1,
      selectedSquare: null,
      legalTargetsForSelected: [],
      captureTargetsForSelected: [],
      pendingPromotion: null,
      showGameOverModal: false,
      isHintPending: false,
      savedSession: nextSaved,
    }));
  },

  selectSquare: (square, nowMs = monotonicNow()) => {
    const state = get();
    if (
      state.view !== 'game' ||
      state.phase !== 'PLAYER_TURN' ||
      state.clock.isPaused ||
      state.result !== null
    ) {
      return;
    }

    if (state.selectedSquare === square) {
      set({
        selectedSquare: null,
        legalTargetsForSelected: [],
        captureTargetsForSelected: [],
      });
      return;
    }

    if (state.selectedSquare && state.legalTargetsForSelected.includes(square)) {
      state.attemptMove(state.selectedSquare, square, undefined, nowMs);
      return;
    }

    const piece = state.liveSnapshot.pieces.find((p) => p.square === square);
    if (!piece || piece.color !== state.liveSnapshot.turn) {
      set({
        selectedSquare: null,
        legalTargetsForSelected: [],
        captureTargetsForSelected: [],
      });
      return;
    }

    if (state.mode === 'ai' && piece.color !== state.humanColor) {
      return;
    }

    const movesFromSq = getLegalMovesForSquare(
      state.liveSnapshot.legalMoves,
      square,
    );
    const legalTargets = Array.from(new Set(movesFromSq.map((m) => m.to)));
    const captureTargets = Array.from(
      new Set(movesFromSq.filter((m) => m.isCapture()).map((m) => m.to)),
    );

    set({
      selectedSquare: square,
      legalTargetsForSelected: legalTargets,
      captureTargetsForSelected: captureTargets,
    });
  },

  attemptMove: (from, to, promotion, nowMs = monotonicNow(), options) => {
    const state = get();
    if (state.view !== 'game' || state.result !== null || state.clock.isPaused) {
      return 'illegal';
    }

    const canAcceptHumanMove =
      state.phase === 'PLAYER_TURN' ||
      (state.phase === 'PROMOTION_PENDING' &&
        promotion !== undefined &&
        state.pendingPromotion?.from === from &&
        state.pendingPromotion?.to === to);

    if (!canAcceptHumanMove) {
      return 'illegal';
    }

    if (state.mode === 'ai' && state.liveSnapshot.turn !== state.humanColor) {
      return 'illegal';
    }

    if (
      !promotion &&
      requiresPromotionChoice(state.liveSnapshot.legalMoves, from, to)
    ) {
      set({
        phase: 'PROMOTION_PENDING',
        pendingPromotion: {
          from,
          to,
          color: state.liveSnapshot.turn,
        },
        selectedSquare: null,
        legalTargetsForSelected: [],
        captureTargetsForSelected: [],
      });
      return 'promotion_pending';
    }

    const validMove = isLegalMoveInput(
      state.liveSnapshot.legalMoves,
      from,
      to,
      promotion,
    );
    if (!validMove) {
      return 'illegal';
    }

    const moverColor = state.liveSnapshot.turn;
    const uci = `${validMove.from}${validMove.to}${validMove.promotion ?? ''}`;
    const replayed = createChessFromPosition(state.initialFen, [
      ...state.moves.map((m) => m.uci),
      uci,
    ]);
    const nextAutoResult = replayed.snapshot.automaticResult;
    const nextTurnAfter = nextAutoResult ? null : replayed.snapshot.turn;

    const clockAdvance = advanceClockOnMove(
      state.clock,
      moverColor,
      nextTurnAfter,
      nowMs,
    );
    if (clockAdvance.timedOut) {
      const timeoutResult = computeTimeoutResult(state.liveSnapshot.fen, moverColor);
      const stopped = stopClock(clockAdvance.nextClock, nowMs);
      const saved = persistStateSnapshot({
        mode: state.mode,
        humanColor: state.humanColor,
        difficulty: state.difficulty,
        timeControlId: state.timeControlId,
        initialFen: state.initialFen,
        moves: state.moves,
        flipped: state.flipped,
        clock: stopped,
        clockSnapshots: state.clockSnapshots,
        result: timeoutResult,
      });
      soundEngine.play('gameOver', useSettingsStore.getState().soundEnabled);
      set((prev) => ({
        phase: 'GAME_OVER',
        positionToken: prev.positionToken + 1,
        selectedSquare: null,
        legalTargetsForSelected: [],
        captureTargetsForSelected: [],
        pendingPromotion: null,
        clock: stopped,
        result: timeoutResult,
        showGameOverModal: true,
        savedSession: saved,
      }));
      return 'illegal';
    }

    const nextSnapshots = [...state.clockSnapshots, clockAdvance.snapshot];
    const nextPhase = resolveLivePhase(
      state.mode,
      state.humanColor,
      replayed.snapshot,
      nextAutoResult,
      null,
    );

    const lastMove = replayed.moves[replayed.moves.length - 1]!;
    playMoveCue(lastMove, nextAutoResult);

    const saved = persistStateSnapshot({
      mode: state.mode,
      humanColor: state.humanColor,
      difficulty: state.difficulty,
      timeControlId: state.timeControlId,
      initialFen: state.initialFen,
      moves: replayed.moves,
      flipped: state.flipped,
      clock: clockAdvance.nextClock,
      clockSnapshots: nextSnapshots,
      result: nextAutoResult,
    });

    set((prev) => ({
      phase: nextPhase,
      positionToken: prev.positionToken + 1,
      moves: replayed.moves,
      fens: replayed.fens,
      liveSnapshot: replayed.snapshot,
      viewPly: replayed.moves.length,
      reviewSnapshot: replayed.snapshot,
      selectedSquare: null,
      legalTargetsForSelected: [],
      captureTargetsForSelected: [],
      pendingPromotion: null,
      lastMoveWasDrag: Boolean(options?.fromDrag),
      clock: clockAdvance.nextClock,
      clockSnapshots: nextSnapshots,
      result: nextAutoResult,
      showGameOverModal: nextAutoResult !== null,
      drawOfferFrom: null,
      hintMove: null,
      isHintPending: false,
      aiWarning: null,
      savedSession: saved,
    }));

    return 'moved';
  },

  commitPromotion: (piece, nowMs = monotonicNow()) => {
    const state = get();
    if (state.phase !== 'PROMOTION_PENDING' || !state.pendingPromotion) {
      return false;
    }
    const { from, to } = state.pendingPromotion;
    return state.attemptMove(from, to, piece, nowMs) === 'moved';
  },

  cancelPromotion: () => {
    const state = get();
    if (state.phase !== 'PROMOTION_PENDING') {
      return;
    }
    set({
      phase: 'PLAYER_TURN',
      pendingPromotion: null,
    });
  },

  applyAiMove: (
    { sessionId, positionToken, uciMove, evaluation, usedFallback, fallbackReason },
    nowMs = monotonicNow(),
  ) => {
    const state = get();
    if (
      state.view !== 'game' ||
      state.phase !== 'AI_THINKING' ||
      state.sessionId !== sessionId ||
      state.positionToken !== positionToken ||
      state.result !== null ||
      state.clock.isPaused ||
      state.mode !== 'ai' ||
      state.liveSnapshot.turn === state.humanColor
    ) {
      return false;
    }

    const parsed = parseUciMove(uciMove);
    if (!parsed) {
      return false;
    }
    const valid = isLegalMoveInput(
      state.liveSnapshot.legalMoves,
      parsed.from,
      parsed.to,
      parsed.promotion,
    );
    if (!valid) {
      return false;
    }

    const moverColor = state.liveSnapshot.turn;
    const normalizedUci = `${valid.from}${valid.to}${valid.promotion ?? ''}`;
    const replayed = createChessFromPosition(state.initialFen, [
      ...state.moves.map((m) => m.uci),
      normalizedUci,
    ]);
    const nextAutoResult = replayed.snapshot.automaticResult;
    const nextTurnAfter = nextAutoResult ? null : replayed.snapshot.turn;

    const clockAdvance = advanceClockOnMove(
      state.clock,
      moverColor,
      nextTurnAfter,
      nowMs,
    );
    if (clockAdvance.timedOut) {
      const timeoutResult = computeTimeoutResult(state.liveSnapshot.fen, moverColor);
      const stopped = stopClock(clockAdvance.nextClock, nowMs);
      const saved = persistStateSnapshot({
        mode: state.mode,
        humanColor: state.humanColor,
        difficulty: state.difficulty,
        timeControlId: state.timeControlId,
        initialFen: state.initialFen,
        moves: state.moves,
        flipped: state.flipped,
        clock: stopped,
        clockSnapshots: state.clockSnapshots,
        result: timeoutResult,
      });
      soundEngine.play('gameOver', useSettingsStore.getState().soundEnabled);
      set((prev) => ({
        phase: 'GAME_OVER',
        positionToken: prev.positionToken + 1,
        clock: stopped,
        result: timeoutResult,
        showGameOverModal: true,
        savedSession: saved,
      }));
      return false;
    }

    const nextSnapshots = [...state.clockSnapshots, clockAdvance.snapshot];
    const nextPhase = resolveLivePhase(
      state.mode,
      state.humanColor,
      replayed.snapshot,
      nextAutoResult,
      null,
    );

    const lastMove = replayed.moves[replayed.moves.length - 1]!;
    playMoveCue(lastMove, nextAutoResult);

    const saved = persistStateSnapshot({
      mode: state.mode,
      humanColor: state.humanColor,
      difficulty: state.difficulty,
      timeControlId: state.timeControlId,
      initialFen: state.initialFen,
      moves: replayed.moves,
      flipped: state.flipped,
      clock: clockAdvance.nextClock,
      clockSnapshots: nextSnapshots,
      result: nextAutoResult,
    });

    set((prev) => ({
      phase: nextPhase,
      positionToken: prev.positionToken + 1,
      moves: replayed.moves,
      fens: replayed.fens,
      liveSnapshot: replayed.snapshot,
      viewPly: replayed.moves.length,
      reviewSnapshot: replayed.snapshot,
      selectedSquare: null,
      legalTargetsForSelected: [],
      captureTargetsForSelected: [],
      pendingPromotion: null,
      lastMoveWasDrag: false,
      clock: clockAdvance.nextClock,
      clockSnapshots: nextSnapshots,
      result: nextAutoResult,
      showGameOverModal: nextAutoResult !== null,
      evaluation: evaluation ?? prev.evaluation,
      hintMove: null,
      isHintPending: false,
      aiWarning: usedFallback
        ? `Engine fallback used (${fallbackReason ?? 'search unavailable'})`
        : null,
      savedSession: saved,
    }));

    return true;
  },

  setLiveEvaluation: (sessionId, positionToken, evaluation) => {
    const state = get();
    if (
      state.sessionId === sessionId &&
      state.positionToken === positionToken &&
      state.view === 'game'
    ) {
      set({ evaluation });
    }
  },

  setAiWarning: (aiWarning) => set({ aiWarning }),

  undoMove: (nowMs = monotonicNow()) => {
    const state = get();
    if (!canUndoInState(state)) {
      return false;
    }

    let pliesToPop = 1;
    if (state.mode === 'ai') {
      if (state.phase === 'AI_THINKING' || state.liveSnapshot.turn !== state.humanColor) {
        pliesToPop = 1;
      } else {
        pliesToPop = 2;
      }
    }

    const targetPly = state.moves.length - pliesToPop;
    if (targetPly < 0) {
      return false;
    }

    const nextUcis = state.moves.slice(0, targetPly).map((m) => m.uci);
    const replayed = createChessFromPosition(state.initialFen, nextUcis);
    const restoredSnapshot = state.clockSnapshots[targetPly] ?? {
      wMs: TIME_CONTROLS[state.timeControlId].baseMs,
      bMs: TIME_CONTROLS[state.timeControlId].baseMs,
    };
    const nextClockSnapshots = state.clockSnapshots.slice(0, targetPly + 1);
    const nextClock = restoreClockFromSnapshot(
      state.timeControlId,
      restoredSnapshot,
      replayed.snapshot.turn,
      state.clock.isPaused,
      nowMs,
    );
    const nextPhase = resolveLivePhase(
      state.mode,
      state.humanColor,
      replayed.snapshot,
      null,
      null,
    );

    const saved = persistStateSnapshot({
      mode: state.mode,
      humanColor: state.humanColor,
      difficulty: state.difficulty,
      timeControlId: state.timeControlId,
      initialFen: state.initialFen,
      moves: replayed.moves,
      flipped: state.flipped,
      clock: nextClock,
      clockSnapshots: nextClockSnapshots,
      result: null,
    });

    set((prev) => ({
      phase: nextPhase,
      positionToken: prev.positionToken + 1,
      moves: replayed.moves,
      fens: replayed.fens,
      liveSnapshot: replayed.snapshot,
      viewPly: replayed.moves.length,
      reviewSnapshot: replayed.snapshot,
      selectedSquare: null,
      legalTargetsForSelected: [],
      captureTargetsForSelected: [],
      pendingPromotion: null,
      lastMoveWasDrag: false,
      clock: nextClock,
      clockSnapshots: nextClockSnapshots,
      result: null,
      showGameOverModal: false,
      drawOfferFrom: null,
      evaluation: null,
      hintMove: null,
      isHintPending: false,
      aiWarning: null,
      savedSession: saved,
    }));

    return true;
  },

  flipBoard: () => {
    set((state) => {
      const flipped = !state.flipped;
      if (state.view === 'game') {
        const saved = persistStateSnapshot({
          mode: state.mode,
          humanColor: state.humanColor,
          difficulty: state.difficulty,
          timeControlId: state.timeControlId,
          initialFen: state.initialFen,
          moves: state.moves,
          flipped,
          clock: state.clock,
          clockSnapshots: state.clockSnapshots,
          result: state.result,
        });
        return { flipped, savedSession: saved };
      }
      return { flipped };
    });
  },

  togglePause: (nowMs = monotonicNow()) => {
    const state = get();
    if (state.view !== 'game' || state.result !== null) {
      return;
    }

    const nextClock = state.clock.isPaused
      ? resumeClock(state.clock, nowMs)
      : pauseClock(state.clock, nowMs);

    const saved = persistStateSnapshot({
      mode: state.mode,
      humanColor: state.humanColor,
      difficulty: state.difficulty,
      timeControlId: state.timeControlId,
      initialFen: state.initialFen,
      moves: state.moves,
      flipped: state.flipped,
      clock: nextClock,
      clockSnapshots: state.clockSnapshots,
      result: state.result,
    });

    set({
      clock: nextClock,
      selectedSquare: null,
      legalTargetsForSelected: [],
      captureTargetsForSelected: [],
      savedSession: saved,
    });
  },

  claimDraw: (type, nowMs = monotonicNow()) => {
    const state = get();
    if (
      state.view !== 'game' ||
      state.result !== null ||
      state.clock.isPaused ||
      state.phase !== 'PLAYER_TURN' ||
      !state.liveSnapshot.claimableDraws.includes(type)
    ) {
      return false;
    }

    const drawResult: GameResult =
      type === 'threefold'
        ? {
            winner: 'draw',
            reason: 'threefold-claim',
            message: 'Draw claimed by threefold repetition',
          }
        : {
            winner: 'draw',
            reason: 'fifty-move-claim',
            message: 'Draw claimed by 50-move rule',
          };

    const stopped = stopClock(state.clock, nowMs);
    const saved = persistStateSnapshot({
      mode: state.mode,
      humanColor: state.humanColor,
      difficulty: state.difficulty,
      timeControlId: state.timeControlId,
      initialFen: state.initialFen,
      moves: state.moves,
      flipped: state.flipped,
      clock: stopped,
      clockSnapshots: state.clockSnapshots,
      result: drawResult,
    });

    soundEngine.play('gameOver', useSettingsStore.getState().soundEnabled);

    set((prev) => ({
      phase: 'GAME_OVER',
      positionToken: prev.positionToken + 1,
      selectedSquare: null,
      legalTargetsForSelected: [],
      captureTargetsForSelected: [],
      pendingPromotion: null,
      clock: stopped,
      result: drawResult,
      showGameOverModal: true,
      drawOfferFrom: null,
      savedSession: saved,
    }));

    return true;
  },

  offerDraw: () => {
    const state = get();
    if (
      state.view !== 'game' ||
      state.mode !== 'local' ||
      state.result !== null ||
      state.clock.isPaused ||
      state.phase !== 'PLAYER_TURN'
    ) {
      return;
    }
    set({ drawOfferFrom: state.liveSnapshot.turn });
  },

  acceptDraw: (nowMs = monotonicNow()) => {
    const state = get();
    if (
      state.view !== 'game' ||
      state.mode !== 'local' ||
      state.result !== null ||
      state.drawOfferFrom === null
    ) {
      return;
    }

    const drawResult: GameResult = {
      winner: 'draw',
      reason: 'draw-agreement',
      message: 'Draw by mutual agreement',
    };
    const stopped = stopClock(state.clock, nowMs);
    const saved = persistStateSnapshot({
      mode: state.mode,
      humanColor: state.humanColor,
      difficulty: state.difficulty,
      timeControlId: state.timeControlId,
      initialFen: state.initialFen,
      moves: state.moves,
      flipped: state.flipped,
      clock: stopped,
      clockSnapshots: state.clockSnapshots,
      result: drawResult,
    });

    soundEngine.play('gameOver', useSettingsStore.getState().soundEnabled);

    set((prev) => ({
      phase: 'GAME_OVER',
      positionToken: prev.positionToken + 1,
      selectedSquare: null,
      legalTargetsForSelected: [],
      captureTargetsForSelected: [],
      pendingPromotion: null,
      clock: stopped,
      result: drawResult,
      showGameOverModal: true,
      drawOfferFrom: null,
      savedSession: saved,
    }));
  },

  declineDraw: () => set({ drawOfferFrom: null }),

  resign: (color, nowMs = monotonicNow()) => {
    const state = get();
    if (state.view !== 'game' || state.result !== null) {
      return;
    }
    const resigningSide: PieceColor =
      color ?? (state.mode === 'ai' ? state.humanColor : state.liveSnapshot.turn);
    const winner: PieceColor = resigningSide === 'w' ? 'b' : 'w';
    const loserLabel = resigningSide === 'w' ? 'White' : 'Black';
    const winnerLabel = winner === 'w' ? 'White' : 'Black';

    const resignResult: GameResult = {
      winner,
      reason: 'resignation',
      message: `${loserLabel} resigned · ${winnerLabel} wins`,
    };
    const stopped = stopClock(state.clock, nowMs);
    const saved = persistStateSnapshot({
      mode: state.mode,
      humanColor: state.humanColor,
      difficulty: state.difficulty,
      timeControlId: state.timeControlId,
      initialFen: state.initialFen,
      moves: state.moves,
      flipped: state.flipped,
      clock: stopped,
      clockSnapshots: state.clockSnapshots,
      result: resignResult,
    });

    soundEngine.play('gameOver', useSettingsStore.getState().soundEnabled);

    set((prev) => ({
      phase: 'GAME_OVER',
      positionToken: prev.positionToken + 1,
      selectedSquare: null,
      legalTargetsForSelected: [],
      captureTargetsForSelected: [],
      pendingPromotion: null,
      clock: stopped,
      result: resignResult,
      showGameOverModal: true,
      drawOfferFrom: null,
      savedSession: saved,
    }));
  },

  triggerTimeout: (loserColor, nowMs = monotonicNow()) => {
    const state = get();
    if (
      state.view !== 'game' ||
      state.result !== null ||
      state.clock.isPaused ||
      !TIME_CONTROLS[state.timeControlId].isTimed
    ) {
      return false;
    }

    const live = getLiveClocks(state.clock, nowMs);
    const remaining = loserColor === 'w' ? live.wMs : live.bMs;
    if (remaining > 0) {
      return false;
    }

    const timeoutResult = computeTimeoutResult(state.liveSnapshot.fen, loserColor);
    const stopped: ClockState = {
      timeControlId: state.timeControlId,
      wMs: live.wMs,
      bMs: live.bMs,
      activeColor: null,
      isPaused: false,
      lastUpdatedAtMs: null,
    };

    const saved = persistStateSnapshot({
      mode: state.mode,
      humanColor: state.humanColor,
      difficulty: state.difficulty,
      timeControlId: state.timeControlId,
      initialFen: state.initialFen,
      moves: state.moves,
      flipped: state.flipped,
      clock: stopped,
      clockSnapshots: state.clockSnapshots,
      result: timeoutResult,
    });

    soundEngine.play('gameOver', useSettingsStore.getState().soundEnabled);

    set((prev) => ({
      phase: 'GAME_OVER',
      positionToken: prev.positionToken + 1,
      selectedSquare: null,
      legalTargetsForSelected: [],
      captureTargetsForSelected: [],
      pendingPromotion: null,
      clock: stopped,
      result: timeoutResult,
      showGameOverModal: true,
      drawOfferFrom: null,
      savedSession: saved,
    }));

    return true;
  },

  reviewGoToPly: (ply) => {
    const state = get();
    const clamped = Math.max(0, Math.min(state.moves.length, ply));
    const isAtLiveEnd = clamped === state.moves.length;

    const reviewSnapshot = isAtLiveEnd
      ? state.liveSnapshot
      : createChessFromPosition(
          state.initialFen,
          state.moves.slice(0, clamped).map((m) => m.uci),
        ).snapshot;

    let nextPhase: GamePhase;
    if (state.result !== null) {
      nextPhase = 'REVIEW';
    } else if (!isAtLiveEnd) {
      nextPhase = 'REVIEW';
    } else {
      nextPhase = resolveLivePhase(
        state.mode,
        state.humanColor,
        state.liveSnapshot,
        null,
        state.pendingPromotion,
      );
    }

    set({
      viewPly: clamped,
      reviewSnapshot,
      phase: nextPhase,
      selectedSquare: null,
      legalTargetsForSelected: [],
      captureTargetsForSelected: [],
      showGameOverModal: false,
    });
  },

  reviewFirst: () => get().reviewGoToPly(0),
  reviewPrev: () => get().reviewGoToPly(get().viewPly - 1),
  reviewNext: () => get().reviewGoToPly(get().viewPly + 1),
  reviewLast: () => {
    const state = get();
    if (state.result !== null) {
      set({
        viewPly: state.moves.length,
        reviewSnapshot: state.liveSnapshot,
        phase: 'REVIEW',
        showGameOverModal: false,
      });
      return;
    }
    state.reviewGoToPly(state.moves.length);
  },

  enterReviewAfterGameOver: () => {
    const state = get();
    set({
      phase: 'REVIEW',
      viewPly: state.moves.length,
      reviewSnapshot: state.liveSnapshot,
      showGameOverModal: false,
    });
  },

  openGameOverModal: () => {
    if (get().result !== null) {
      set({ showGameOverModal: true });
    }
  },

  closeGameOverModal: () => set({ showGameOverModal: false }),

  setHintMove: (hintMove) => set({ hintMove }),
  setHintPending: (isHintPending) => set({ isHintPending }),

  clearSavedSession: () => {
    clearSavedGameSession();
    set({ savedSession: null });
  },
}));
