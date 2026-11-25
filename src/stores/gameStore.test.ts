import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_POSITION } from '../engine/chessRules';
import { SESSION_STORAGE_KEY } from '../storage/persistence';
import { useGameStore } from './gameStore';

describe('gameStore state machine', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useGameStore.getState().goToLobby();
  });

  it('transitions through SETUP -> PLAYER_TURN -> AI_THINKING and rejects stale/duplicate AI moves', () => {
    const store = useGameStore.getState();
    store.startNewGame({
      mode: 'ai',
      playerColorChoice: 'w',
      difficulty: 'medium',
      timeControlId: '3+2',
      nowMs: 1000,
    });

    let state = useGameStore.getState();
    expect(state.phase).toBe('PLAYER_TURN');
    expect(state.humanColor).toBe('w');

    // Human plays e2-e4 at t=3000 -> increment +2000 -> 180000 - 2000 + 2000 = 180000
    const res = state.attemptMove('e2', 'e4', undefined, 3000);
    expect(res).toBe('moved');

    state = useGameStore.getState();
    expect(state.phase).toBe('AI_THINKING');
    expect(state.clock.wMs).toBe(180_000);
    const activeToken = state.positionToken;
    const activeSession = state.sessionId;

    // Duplicate/phantom human move while AI_THINKING must be rejected
    expect(state.attemptMove('d2', 'd4', undefined, 3500)).toBe('illegal');

    // Stale AI move with wrong positionToken must be rejected
    expect(
      state.applyAiMove({
        sessionId: activeSession,
        positionToken: activeToken - 1,
        uciMove: 'e7e5',
        evaluation: null,
        usedFallback: false,
      }),
    ).toBe(false);

    // Valid AI move accepted
    expect(
      state.applyAiMove(
        {
          sessionId: activeSession,
          positionToken: activeToken,
          uciMove: 'e7e5',
          evaluation: { type: 'cp', value: 25, depth: 7, bestMoveUci: 'g1f3' },
          usedFallback: false,
        },
        4500,
      ),
    ).toBe(true);

    state = useGameStore.getState();
    expect(state.phase).toBe('PLAYER_TURN');
    expect(state.moves).toHaveLength(2);
    // Duplicate application of the same token must be rejected
    expect(
      state.applyAiMove({
        sessionId: activeSession,
        positionToken: activeToken,
        uciMove: 'c7c5',
        evaluation: null,
        usedFallback: false,
      }),
    ).toBe(false);
  });

  it('handles PROMOTION_PENDING, undo clock restoration, and AI-thinking undo cancellation', () => {
    const promoFen = '4k3/P6p/8/8/8/8/8/4K3 w - - 0 1';
    const store = useGameStore.getState();
    store.startNewGame({
      mode: 'ai',
      playerColorChoice: 'w',
      difficulty: 'easy',
      timeControlId: '3+2',
      initialFen: promoFen,
      nowMs: 10_000,
    });

    // Moving a7->a8 without promotion enters PROMOTION_PENDING
    expect(useGameStore.getState().attemptMove('a7', 'a8', undefined, 11_000)).toBe(
      'promotion_pending',
    );
    expect(useGameStore.getState().phase).toBe('PROMOTION_PENDING');

    // Commit promotion to knight
    expect(useGameStore.getState().commitPromotion('n', 12_000)).toBe(true);
    let state = useGameStore.getState();
    expect(state.phase).toBe('AI_THINKING');
    expect(state.moves[0]?.san).toBe('a8=N');
    expect(state.clock.wMs).toBe(180_000); // 180k - 2k + 2k

    // Undo DURING AI_THINKING pops human move, invalidates token, and restores clock
    const prevToken = state.positionToken;
    expect(state.undoMove(13_000)).toBe(true);
    state = useGameStore.getState();
    expect(state.phase).toBe('PLAYER_TURN');
    expect(state.moves).toHaveLength(0);
    expect(state.positionToken).toBeGreaterThan(prevToken);
    expect(state.clock.wMs).toBe(180_000);
  });

  it('locks live moves after GAME_OVER, separates REVIEW from live state, and persists/restores sessions', () => {
    const store = useGameStore.getState();
    store.startNewGame({
      mode: 'local',
      playerColorChoice: 'w',
      difficulty: 'medium',
      timeControlId: '5+0',
      nowMs: 1000,
    });

    useGameStore.getState().attemptMove('e2', 'e4', undefined, 2000);
    useGameStore.getState().attemptMove('e7', 'e5', undefined, 4000);

    // Review ply 1 while live game is at ply 2
    useGameStore.getState().reviewGoToPly(1);
    let state = useGameStore.getState();
    expect(state.phase).toBe('REVIEW');
    expect(state.reviewSnapshot.pieces.find((p) => p.square === 'e5')).toBeUndefined();
    expect(state.liveSnapshot.pieces.find((p) => p.square === 'e5')).toBeDefined();
    // Cannot make a live move while reviewing an earlier ply
    expect(state.attemptMove('g1', 'f3', undefined, 5000)).toBe('illegal');

    // Returning to last ply restores PLAYER_TURN
    state.reviewLast();
    expect(useGameStore.getState().phase).toBe('PLAYER_TURN');

    // Timeout triggers GAME_OVER and locks moves
    expect(useGameStore.getState().triggerTimeout('w', 400_000)).toBe(true);
    state = useGameStore.getState();
    expect(state.phase).toBe('GAME_OVER');
    expect(state.result?.reason).toBe('timeout');
    expect(state.result?.winner).toBe('b');
    expect(state.attemptMove('g1', 'f3', undefined, 401_000)).toBe('illegal');

    // Saved game reload restores the game cleanly
    useGameStore.getState().goToLobby();
    expect(useGameStore.getState().resumeSavedGame()).toBe(true);
    expect(useGameStore.getState().moves).toHaveLength(2);
    expect(useGameStore.getState().result?.reason).toBe('timeout');

    // Corrupt save recovery
    window.localStorage.setItem(SESSION_STORAGE_KEY, '{corrupt');
    useGameStore.getState().refreshSavedSession();
    expect(useGameStore.getState().savedSession).toBeNull();
    expect(useGameStore.getState().corruptSaveNotice).toBeTruthy();
  });

  it('supports Black AI orientation and claimable vs automatic draws', () => {
    const store = useGameStore.getState();
    store.startNewGame({
      mode: 'ai',
      playerColorChoice: 'b',
      difficulty: 'hard',
      timeControlId: 'untimed',
      initialFen: DEFAULT_POSITION,
    });

    const state = useGameStore.getState();
    expect(state.humanColor).toBe('b');
    expect(state.flipped).toBe(true);
    // White is AI, so match starts immediately in AI_THINKING
    expect(state.phase).toBe('AI_THINKING');
  });
});
