import { describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import {
  DEFAULT_POSITION,
  computeCapturedSummary,
  createChessFromPosition,
  formatPgnExport,
  hasMatingMaterialForTimeout,
  isLegalMoveInput,
  parseUciMove,
  requiresPromotionChoice,
  runPerft,
} from './chessRules';
import {
  getBoardSquaresInDisplayOrder,
  isLightSquare,
  moveSquareByKey,
  squareToVisualGrid,
  visualGridToSquare,
} from './coordinates';

describe('coordinates', () => {
  it('maps board squares consistently for white and black orientations', () => {
    expect(squareToVisualGrid('a8', false)).toEqual({ row: 0, col: 0 });
    expect(squareToVisualGrid('h1', false)).toEqual({ row: 7, col: 7 });
    expect(squareToVisualGrid('a8', true)).toEqual({ row: 7, col: 7 });
    expect(squareToVisualGrid('h1', true)).toEqual({ row: 0, col: 0 });

    const whiteOrder = getBoardSquaresInDisplayOrder(false);
    expect(whiteOrder[0]).toBe('a8');
    expect(whiteOrder[63]).toBe('h1');

    const blackOrder = getBoardSquaresInDisplayOrder(true);
    expect(blackOrder[0]).toBe('h1');
    expect(blackOrder[63]).toBe('a8');

    for (const flipped of [false, true]) {
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const sq = visualGridToSquare(r, c, flipped);
          expect(squareToVisualGrid(sq, flipped)).toEqual({ row: r, col: c });
        }
      }
    }
  });

  it('computes square colors and arrow navigation correctly', () => {
    expect(isLightSquare('a1')).toBe(false);
    expect(isLightSquare('h1')).toBe(true);
    expect(isLightSquare('a8')).toBe(true);
    expect(isLightSquare('h8')).toBe(false);

    expect(moveSquareByKey('e2', 'ArrowUp', false)).toBe('e3');
    expect(moveSquareByKey('e2', 'ArrowUp', true)).toBe('e1');
    expect(moveSquareByKey('a1', 'ArrowLeft', false)).toBeNull();
  });
});

describe('chessRules perft & legal move validation', () => {
  it('verifies starting position has 20 legal moves and perft depth 2 is 400', () => {
    const start = createChessFromPosition(DEFAULT_POSITION, []);
    expect(start.snapshot.legalMoves).toHaveLength(20);
    expect(runPerft(1)).toBe(20);
    expect(runPerft(2)).toBe(400);
  });

  it('rejects illegal moves, king captures, and moves leaving own king in check (pins)', () => {
    // Pin test: White rook on e2 is pinned along e-file by Black rook on e6 to White king on e1
    const pinnedFen = '4k3/8/4r3/8/8/8/4R3/4K3 w - - 0 1';
    const state = createChessFromPosition(pinnedFen, []);
    expect(isLegalMoveInput(state.snapshot.legalMoves, 'e2', 'd2')).toBeNull();
    expect(isLegalMoveInput(state.snapshot.legalMoves, 'e2', 'e6')).not.toBeNull();

    // Never permit capturing a king directly
    const kingNearFen = '4k3/8/8/8/8/8/4Q3/4K3 b - - 0 1';
    const kingCheck = createChessFromPosition(kingNearFen, []);
    expect(
      kingCheck.snapshot.legalMoves.some((m) => m.captured === 'k'),
    ).toBe(false);
  });

  it('detects checks and Fool’s Mate checkmate', () => {
    const foolsMate = createChessFromPosition(DEFAULT_POSITION, [
      'f2f3',
      'e7e5',
      'g2g4',
      'd8h4',
    ]);
    expect(foolsMate.snapshot.inCheck).toBe(true);
    expect(foolsMate.snapshot.checkedKingSquare).toBe('e1');
    expect(foolsMate.snapshot.automaticResult).toEqual({
      winner: 'b',
      reason: 'checkmate',
      message: 'Black wins by checkmate',
    });
    expect(foolsMate.moves[3]?.san).toBe('Qh4#');
  });

  it('detects stalemate correctly', () => {
    // Black king on h8, White queen on f7, White king on g6 -> Black to move has no legal moves and is not in check
    const stalemateFen = '7k/5Q2/6K1/8/8/8/8/8 b - - 0 1';
    const res = createChessFromPosition(stalemateFen, []);
    expect(res.snapshot.inCheck).toBe(false);
    expect(res.snapshot.legalMoves).toHaveLength(0);
    expect(res.snapshot.automaticResult).toEqual({
      winner: 'draw',
      reason: 'stalemate',
      message: 'Draw by stalemate',
    });
  });

  it('handles both kingside and queenside castling and forbids illegal castling', () => {
    const castlingFen = 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1';
    const state = createChessFromPosition(castlingFen, []);
    expect(isLegalMoveInput(state.snapshot.legalMoves, 'e1', 'g1')).not.toBeNull();
    expect(isLegalMoveInput(state.snapshot.legalMoves, 'e1', 'c1')).not.toBeNull();

    const kingside = createChessFromPosition(castlingFen, ['e1g1']);
    expect(kingside.moves[0]?.isCastle).toBe('kingside');
    expect(kingside.moves[0]?.san).toBe('O-O');

    const queenside = createChessFromPosition(castlingFen, ['e1c1']);
    expect(queenside.moves[0]?.isCastle).toBe('queenside');
    expect(queenside.moves[0]?.san).toBe('O-O-O');

    // Forbidden castling: through check on f1 (Black bishop on c4 attacks f1)
    const throughCheckFen = '4k3/8/8/8/2b5/8/8/R3K2R w KQ - 0 1';
    const throughCheck = createChessFromPosition(throughCheckFen, []);
    expect(isLegalMoveInput(throughCheck.snapshot.legalMoves, 'e1', 'g1')).toBeNull();
    // Queenside still allowed because d1/c1 are not attacked
    expect(isLegalMoveInput(throughCheck.snapshot.legalMoves, 'e1', 'c1')).not.toBeNull();

    // Forbidden castling when in check
    const inCheckFen = '4k3/8/8/8/4r3/8/8/R3K2R w KQ - 0 1';
    const inCheck = createChessFromPosition(inCheckFen, []);
    expect(isLegalMoveInput(inCheck.snapshot.legalMoves, 'e1', 'g1')).toBeNull();
    expect(isLegalMoveInput(inCheck.snapshot.legalMoves, 'e1', 'c1')).toBeNull();
  });

  it('handles legal en passant, expiry after one turn, and horizontal rank-5 pinned en passant', () => {
    // Legal en passant
    const epGame = createChessFromPosition(DEFAULT_POSITION, ['e2e4', 'a7a6', 'e4e5', 'd7d5']);
    const epMove = isLegalMoveInput(epGame.snapshot.legalMoves, 'e5', 'd6');
    expect(epMove).not.toBeNull();
    expect(epMove?.isEnPassant()).toBe(true);

    // En passant expires if another move is played instead
    const epExpired = createChessFromPosition(DEFAULT_POSITION, [
      'e2e4',
      'a7a6',
      'e4e5',
      'd7d5',
      'a2a3',
      'a6a5',
    ]);
    expect(isLegalMoveInput(epExpired.snapshot.legalMoves, 'e5', 'd6')).toBeNull();

    // Horizontal pinned EP: White king on a5, White pawn on e5, Black pawn d7->d5, Black rook on h5
    // Taking exd6 e.p. exposes Ka5 to Rh5!
    const pinnedEpStart = '8/3p4/8/K3P2r/8/8/8/4k3 b - - 0 1';
    const afterD5 = createChessFromPosition(pinnedEpStart, ['d7d5']);
    expect(isLegalMoveInput(afterD5.snapshot.legalMoves, 'e5', 'd6')).toBeNull();
  });

  it('requires explicit promotion choice and supports all 4 promotions (Q, R, B, N)', () => {
    const promoFen = '4k3/P7/8/8/8/8/8/4K3 w - - 0 1';
    const state = createChessFromPosition(promoFen, []);
    expect(requiresPromotionChoice(state.snapshot.legalMoves, 'a7', 'a8')).toBe(true);
    expect(isLegalMoveInput(state.snapshot.legalMoves, 'a7', 'a8')).toBeNull();

    for (const promo of ['q', 'r', 'b', 'n'] as const) {
      const move = isLegalMoveInput(state.snapshot.legalMoves, 'a7', 'a8', promo);
      expect(move).not.toBeNull();
      const applied = createChessFromPosition(promoFen, [`a7a8${promo}`]);
      expect(applied.moves[0]?.promotion).toBe(promo);
    }
  });
});

describe('draw rules, repetition tracking, and checkmate precedence', () => {
  it('distinguishes claimable threefold repetition from automatic fivefold repetition', () => {
    const cycle = ['g1f3', 'g8f6', 'f3g1', 'f6g8']; // 1 full cycle returns to startpos
    // 1st occurrence = initial pos.
    // After 2 cycles -> 3rd occurrence -> claimable threefold, NOT automatic game over!
    const threefold = createChessFromPosition(DEFAULT_POSITION, [...cycle, ...cycle]);
    expect(threefold.snapshot.repetitionCount).toBe(3);
    expect(threefold.snapshot.claimableDraws).toContain('threefold');
    expect(threefold.snapshot.automaticResult).toBeNull();

    // After 4 cycles -> 5th occurrence -> automatic fivefold draw!
    const fivefold = createChessFromPosition(DEFAULT_POSITION, [
      ...cycle,
      ...cycle,
      ...cycle,
      ...cycle,
    ]);
    expect(fivefold.snapshot.repetitionCount).toBe(5);
    expect(fivefold.snapshot.automaticResult).toEqual({
      winner: 'draw',
      reason: 'fivefold-repetition',
      message: 'Draw by fivefold repetition',
    });
    expect(fivefold.snapshot.claimableDraws).toEqual([]);
  });

  it('distinguishes claimable 50-move draw from automatic 75-move draw and gives checkmate precedence', () => {
    // 99 halfmoves already elapsed; 1 more quiet move reaches 100 halfmoves (50 moves)
    const fen99 = '4k3/8/8/8/8/8/R7/4K2R w - - 99 60';
    const at100 = createChessFromPosition(fen99, ['h1g1']);
    expect(at100.snapshot.halfmoveClock).toBe(100);
    expect(at100.snapshot.claimableDraws).toContain('fifty-move');
    expect(at100.snapshot.automaticResult).toBeNull();

    // 149 halfmoves already elapsed; 1 non-mating quiet move reaches 150 (75-move automatic draw)
    const fen149 = '4k3/8/8/8/8/8/R7/4K2R w - - 149 90';
    const at150 = createChessFromPosition(fen149, ['h1g1']);
    expect(at150.snapshot.halfmoveClock).toBe(150);
    expect(at150.snapshot.automaticResult).toEqual({
      winner: 'draw',
      reason: 'seventy-five-move',
      message: 'Draw by 75-move rule',
    });

    // Checkmate precedence on the 150th halfmove: White plays Ra8# from a2 with Ke8, Ke6
    const mateOn150Fen = '4k3/8/4K3/8/8/8/R7/8 w - - 149 90';
    const mateOn150 = createChessFromPosition(mateOn150Fen, ['a2a8']);
    expect(mateOn150.snapshot.halfmoveClock).toBe(150);
    expect(mateOn150.snapshot.automaticResult).toEqual({
      winner: 'w',
      reason: 'checkmate',
      message: 'White wins by checkmate',
    });
  });

  it('detects insufficient material and timeout mating material accurately', () => {
    expect(
      createChessFromPosition('4k3/8/8/8/8/8/8/4K3 w - - 0 1', []).snapshot.automaticResult?.reason,
    ).toBe('insufficient-material');
    expect(
      createChessFromPosition('4k3/8/8/8/8/8/4B3/4K3 w - - 0 1', []).snapshot.automaticResult
        ?.reason,
    ).toBe('insufficient-material');
    expect(
      createChessFromPosition('4k3/8/8/8/8/8/4N3/4K3 w - - 0 1', []).snapshot.automaticResult
        ?.reason,
    ).toBe('insufficient-material');

    // Lone K cannot win on timeout
    expect(hasMatingMaterialForTimeout('4k3/8/8/8/8/8/4Q3/4K3 w - - 0 1', 'b')).toBe(false);
    expect(hasMatingMaterialForTimeout('4k3/8/8/8/8/8/4Q3/4K3 w - - 0 1', 'w')).toBe(true);
  });

  it('keeps PGN export, UCI parsing, and captured material coherent', () => {
    const history = createChessFromPosition(DEFAULT_POSITION, ['e2e4', 'd7d5', 'e4d5']);
    const captured = computeCapturedSummary(history.snapshot.pieces, history.moves);
    expect(captured.capturedByWhite).toEqual(['p']);
    expect(captured.capturedByBlack).toEqual([]);
    expect(captured.materialAdvantageWhite).toBe(1);

    const pgn = formatPgnExport(
      DEFAULT_POSITION,
      history.moves,
      { White: 'Player 1', Black: 'Stockfish' },
      null,
    );
    const verify = new Chess();
    verify.loadPgn(pgn);
    expect(verify.history()).toEqual(['e4', 'd5', 'exd5']);
    expect(parseUciMove('e7e8Q')).toEqual({ from: 'e7', to: 'e8', promotion: 'q' });
    expect(parseUciMove('invalid')).toBeNull();
  });
});
