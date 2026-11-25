import { useCallback, useEffect, useRef } from 'react';
import { SearchCancelledError, StockfishClient } from '../ai/stockfishClient';
import { parseUciMove } from '../engine/chessRules';
import { useGameStore } from '../stores/gameStore';

/**
 * Coordinates Stockfish Web Worker searches with the session state machine.
 * Lazy-loads Stockfish only when entering AI play or requesting a legal hint,
 * and guarantees UCI stop + token cancellation on undo, restart, mode switch, pause, or unmount.
 */
export function useStockfishAI(): { requestHint: () => void } {
  const clientRef = useRef<StockfishClient | null>(null);

  const view = useGameStore((s) => s.view);
  const mode = useGameStore((s) => s.mode);
  const phase = useGameStore((s) => s.phase);
  const sessionId = useGameStore((s) => s.sessionId);
  const positionToken = useGameStore((s) => s.positionToken);
  const difficulty = useGameStore((s) => s.difficulty);
  const initialFen = useGameStore((s) => s.initialFen);
  const moves = useGameStore((s) => s.moves);
  const liveSnapshot = useGameStore((s) => s.liveSnapshot);
  const isPaused = useGameStore((s) => s.clock.isPaused);
  const result = useGameStore((s) => s.result);

  const getOrCreateClient = useCallback((): StockfishClient => {
    if (!clientRef.current) {
      clientRef.current = new StockfishClient();
    }
    return clientRef.current;
  }, []);

  // Cleanup worker completely on app unmount
  useEffect(() => {
    return () => {
      clientRef.current?.dispose();
      clientRef.current = null;
    };
  }, []);

  // Cancel any active search immediately when paused, leaving game, or switching out of AI_THINKING
  useEffect(() => {
    const shouldSearch =
      view === 'game' &&
      mode === 'ai' &&
      phase === 'AI_THINKING' &&
      !isPaused &&
      result === null;

    if (!shouldSearch) {
      clientRef.current?.cancelActiveSearch(sessionId, positionToken);
      return;
    }

    const legalUciMoves = liveSnapshot.legalMoves.map(
      (m) => `${m.from}${m.to}${m.promotion ?? ''}`,
    );
    if (legalUciMoves.length === 0) {
      return;
    }

    const client = getOrCreateClient();
    const uciMoves = moves.map((m) => m.uci);
    const sideToMove = liveSnapshot.turn;
    const reqSessionId = sessionId;
    const reqPositionToken = positionToken;

    let cancelled = false;

    void client
      .searchBestMove({
        sessionId: reqSessionId,
        positionToken: reqPositionToken,
        initialFen,
        uciMoves,
        sideToMove,
        legalUciMoves,
        difficulty,
        onEvaluation: (evaluation) => {
          if (!cancelled) {
            useGameStore
              .getState()
              .setLiveEvaluation(reqSessionId, reqPositionToken, evaluation);
          }
        },
      })
      .then((searchResult) => {
        if (cancelled) return;
        useGameStore.getState().applyAiMove({
          sessionId: reqSessionId,
          positionToken: reqPositionToken,
          uciMove: searchResult.uciMove,
          evaluation: searchResult.evaluation,
          usedFallback: searchResult.usedFallback,
          fallbackReason: searchResult.fallbackReason,
        });
      })
      .catch((err: unknown) => {
        if (cancelled || err instanceof SearchCancelledError) {
          return;
        }
        useGameStore
          .getState()
          .setAiWarning(
            err instanceof Error ? err.message : 'Stockfish worker unavailable',
          );
      });

    return () => {
      cancelled = true;
      client.cancelActiveSearch(reqSessionId, reqPositionToken + 1);
    };
  }, [
    view,
    mode,
    phase,
    sessionId,
    positionToken,
    difficulty,
    initialFen,
    moves,
    liveSnapshot,
    isPaused,
    result,
    getOrCreateClient,
  ]);

  const requestHint = useCallback(() => {
    const state = useGameStore.getState();
    if (
      state.view !== 'game' ||
      state.phase !== 'PLAYER_TURN' ||
      state.clock.isPaused ||
      state.result !== null
    ) {
      return;
    }

    const legalUciMoves = state.liveSnapshot.legalMoves.map(
      (m) => `${m.from}${m.to}${m.promotion ?? ''}`,
    );
    if (legalUciMoves.length === 0) {
      return;
    }

    const reqSession = state.sessionId;
    const reqToken = state.positionToken;
    state.setHintPending(true);
    const client = getOrCreateClient();

    void client
      .searchBestMove({
        sessionId: reqSession,
        positionToken: reqToken,
        initialFen: state.initialFen,
        uciMoves: state.moves.map((m) => m.uci),
        sideToMove: state.liveSnapshot.turn,
        legalUciMoves,
        difficulty: 'medium',
        onEvaluation: (evaluation) => {
          useGameStore.getState().setLiveEvaluation(reqSession, reqToken, evaluation);
        },
      })
      .then((res) => {
        const latest = useGameStore.getState();
        latest.setHintPending(false);
        if (
          latest.sessionId !== reqSession ||
          latest.positionToken !== reqToken ||
          latest.phase !== 'PLAYER_TURN'
        ) {
          return;
        }
        const parsed = parseUciMove(res.uciMove);
        if (parsed) {
          latest.setHintMove({
            from: parsed.from,
            to: parsed.to,
            uci: res.uciMove,
          });
        }
      })
      .catch(() => {
        useGameStore.getState().setHintPending(false);
      });
  }, [getOrCreateClient]);

  return { requestHint };
}
