import { Chess, DEFAULT_POSITION, validateFen } from 'chess.js';
import type { Move, Square } from 'chess.js';
import type {
  BoardPiece,
  CapturedSummary,
  DrawClaimType,
  GameResult,
  MoveRecord,
  PieceColor,
  PieceType,
  PromotionPiece,
} from '../types/chess';

export { DEFAULT_POSITION };

const PIECE_VALUES: Record<PieceType, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0,
};

export interface PositionSnapshot {
  fen: string;
  turn: PieceColor;
  inCheck: boolean;
  checkedKingSquare: Square | null;
  pieces: BoardPiece[];
  legalMoves: Move[];
  halfmoveClock: number;
  fullmoveNumber: number;
  repetitionKey: string;
  repetitionCount: number;
  repetitionCounts: Map<string, number>;
  automaticResult: GameResult | null;
  claimableDraws: DrawClaimType[];
  pgn: string;
}

export interface ReplayedHistory {
  initialFen: string;
  moves: MoveRecord[];
  fens: string[];
  snapshot: PositionSnapshot;
}

export function isValidFen(fen: string): { ok: boolean; error?: string } {
  return validateFen(fen);
}

/**
 * Canonical position key used for threefold/fivefold repetition detection:
 * piece placement, side to move, castling rights, and legal en passant target square.
 * (chess.js `fen()` omits the EP square when no legal EP capture exists.)
 */
export function getCanonicalRepetitionKey(chess: Chess): string {
  return chess.fen().split(' ').slice(0, 4).join(' ');
}

export function extractHalfmoveClock(fen: string): number {
  const parts = fen.split(' ');
  const parsed = Number.parseInt(parts[4] ?? '0', 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

export function extractBoardPieces(chess: Chess): BoardPiece[] {
  const result: BoardPiece[] = [];
  const board = chess.board();
  for (const row of board) {
    for (const cell of row) {
      if (cell) {
        result.push({
          square: cell.square,
          type: cell.type,
          color: cell.color,
        });
      }
    }
  }
  return result;
}

export function findKingSquare(chess: Chess, color: PieceColor): Square | null {
  const squares = chess.findPiece({ type: 'k', color });
  return squares[0] ?? null;
}

/**
 * Evaluates automatic FIDE termination rules with strict checkmate precedence.
 * Claimable draws (threefold repetition, 50-move rule) do NOT auto-end the game.
 */
export function evaluateAutomaticResult(
  chess: Chess,
  repetitionCount: number,
  halfmoveClock: number,
): GameResult | null {
  const turn = chess.turn();

  if (chess.isCheckmate()) {
    const winner: PieceColor = turn === 'w' ? 'b' : 'w';
    const winnerLabel = winner === 'w' ? 'White' : 'Black';
    return {
      winner,
      reason: 'checkmate',
      message: `${winnerLabel} wins by checkmate`,
    };
  }

  if (chess.isStalemate()) {
    return {
      winner: 'draw',
      reason: 'stalemate',
      message: 'Draw by stalemate',
    };
  }

  if (chess.isInsufficientMaterial()) {
    return {
      winner: 'draw',
      reason: 'insufficient-material',
      message: 'Draw by insufficient material',
    };
  }

  if (repetitionCount >= 5) {
    return {
      winner: 'draw',
      reason: 'fivefold-repetition',
      message: 'Draw by fivefold repetition',
    };
  }

  if (halfmoveClock >= 150) {
    return {
      winner: 'draw',
      reason: 'seventy-five-move',
      message: 'Draw by 75-move rule',
    };
  }

  return null;
}

export function getClaimableDraws(
  automaticResult: GameResult | null,
  repetitionCount: number,
  halfmoveClock: number,
): DrawClaimType[] {
  if (automaticResult !== null) {
    return [];
  }
  const claims: DrawClaimType[] = [];
  if (repetitionCount >= 3) {
    claims.push('threefold');
  }
  if (halfmoveClock >= 100) {
    claims.push('fifty-move');
  }
  return claims;
}

function toMoveRecord(
  ply: number,
  moveNumberBefore: number,
  move: Move,
  chessAfter: Chess,
): MoveRecord {
  const isCastle = move.isKingsideCastle()
    ? 'kingside'
    : move.isQueensideCastle()
      ? 'queenside'
      : null;

  return {
    ply,
    moveNumber: moveNumberBefore,
    color: move.color,
    from: move.from,
    to: move.to,
    piece: move.piece,
    captured: move.captured,
    promotion: move.promotion as PromotionPiece | undefined,
    san: move.san,
    uci: `${move.from}${move.to}${move.promotion ?? ''}`,
    fenAfter: move.after,
    isCheck: chessAfter.inCheck(),
    isCheckmate: chessAfter.isCheckmate(),
    isCapture: move.isCapture(),
    isEnPassant: move.isEnPassant(),
    isCastle,
  };
}

export function parseUciMove(
  uci: string,
): { from: Square; to: Square; promotion?: PromotionPiece } | null {
  const trimmed = uci.trim().toLowerCase();
  const match = /^([a-h][1-8])([a-h][1-8])([qrbn])?$/.exec(trimmed);
  if (!match) {
    return null;
  }
  return {
    from: match[1] as Square,
    to: match[2] as Square,
    promotion: match[3] as PromotionPiece | undefined,
  };
}

export function createChessFromPosition(
  initialFen: string,
  uciMoves: readonly string[],
): ReplayedHistory {
  const validation = validateFen(initialFen);
  if (!validation.ok) {
    throw new Error(`Invalid initial FEN: ${validation.error ?? 'unknown error'}`);
  }

  const chess = new Chess(initialFen);
  const repetitionCounts = new Map<string, number>();
  const initialKey = getCanonicalRepetitionKey(chess);
  repetitionCounts.set(initialKey, 1);

  const fens: string[] = [chess.fen()];
  const moves: MoveRecord[] = [];

  for (let idx = 0; idx < uciMoves.length; idx++) {
    const rawMove = uciMoves[idx];
    if (!rawMove) {
      throw new Error(`Empty move entry at index ${idx}`);
    }
    const moveNumberBefore = chess.moveNumber();
    const parsedUci = parseUciMove(rawMove);
    const applied = parsedUci
      ? chess.move({
          from: parsedUci.from,
          to: parsedUci.to,
          promotion: parsedUci.promotion,
        })
      : chess.move(rawMove);

    const key = getCanonicalRepetitionKey(chess);
    repetitionCounts.set(key, (repetitionCounts.get(key) ?? 0) + 1);
    fens.push(chess.fen());
    moves.push(toMoveRecord(idx + 1, moveNumberBefore, applied, chess));
  }

  const currentFen = chess.fen();
  const currentKey = getCanonicalRepetitionKey(chess);
  const currentRepetitionCount = repetitionCounts.get(currentKey) ?? 1;
  const halfmoveClock = extractHalfmoveClock(currentFen);
  const automaticResult = evaluateAutomaticResult(
    chess,
    currentRepetitionCount,
    halfmoveClock,
  );
  const claimableDraws = getClaimableDraws(
    automaticResult,
    currentRepetitionCount,
    halfmoveClock,
  );
  const inCheck = chess.inCheck();

  return {
    initialFen,
    moves,
    fens,
    snapshot: {
      fen: currentFen,
      turn: chess.turn(),
      inCheck,
      checkedKingSquare: inCheck ? findKingSquare(chess, chess.turn()) : null,
      pieces: extractBoardPieces(chess),
      legalMoves: chess.moves({ verbose: true }),
      halfmoveClock,
      fullmoveNumber: chess.moveNumber(),
      repetitionKey: currentKey,
      repetitionCount: currentRepetitionCount,
      repetitionCounts,
      automaticResult,
      claimableDraws,
      pgn: chess.pgn(),
    },
  };
}

export function getLegalMovesForSquare(
  legalMoves: readonly Move[],
  square: Square,
): Move[] {
  return legalMoves.filter((m) => m.from === square);
}

export function requiresPromotionChoice(
  legalMoves: readonly Move[],
  from: Square,
  to: Square,
): boolean {
  return legalMoves.some((m) => m.from === from && m.to === to && Boolean(m.promotion));
}

export function isLegalMoveInput(
  legalMoves: readonly Move[],
  from: Square,
  to: Square,
  promotion?: PromotionPiece,
): Move | null {
  const candidates = legalMoves.filter((m) => m.from === from && m.to === to);
  if (candidates.length === 0) {
    return null;
  }
  if (candidates.some((m) => Boolean(m.promotion))) {
    if (!promotion) {
      return null;
    }
    return candidates.find((m) => m.promotion === promotion) ?? null;
  }
  if (promotion) {
    return null;
  }
  return candidates[0] ?? null;
}

export function computeCapturedSummary(
  pieces: readonly BoardPiece[],
  moves: readonly MoveRecord[],
): CapturedSummary {
  const capturedByWhite: PieceType[] = [];
  const capturedByBlack: PieceType[] = [];

  for (const move of moves) {
    if (move.captured) {
      if (move.color === 'w') {
        capturedByWhite.push(move.captured);
      } else {
        capturedByBlack.push(move.captured);
      }
    }
  }

  const order: Record<PieceType, number> = { q: 0, r: 1, b: 2, n: 3, p: 4, k: 5 };
  capturedByWhite.sort((a, b) => order[a] - order[b]);
  capturedByBlack.sort((a, b) => order[a] - order[b]);

  let whiteMaterial = 0;
  let blackMaterial = 0;
  for (const piece of pieces) {
    const val = PIECE_VALUES[piece.type];
    if (piece.color === 'w') {
      whiteMaterial += val;
    } else {
      blackMaterial += val;
    }
  }

  return {
    capturedByWhite,
    capturedByBlack,
    materialAdvantageWhite: whiteMaterial - blackMaterial,
  };
}

/**
 * Checks whether a player has sufficient mating material to win on opponent timeout.
 * A lone King cannot deliver checkmate under any legal sequence of moves.
 */
export function hasMatingMaterialForTimeout(fen: string, winner: PieceColor): boolean {
  const chess = new Chess(fen);
  const opponent: PieceColor = winner === 'w' ? 'b' : 'w';
  const myPieces = extractBoardPieces(chess).filter(
    (p) => p.color === winner && p.type !== 'k',
  );
  if (myPieces.length === 0) {
    return false;
  }
  const oppPieces = extractBoardPieces(chess).filter(
    (p) => p.color === opponent && p.type !== 'k',
  );
  // If opponent also only has a lone King, K+N vs K and K+B vs K cannot mate.
  if (
    oppPieces.length === 0 &&
    myPieces.length === 1 &&
    (myPieces[0]?.type === 'n' || myPieces[0]?.type === 'b')
  ) {
    return false;
  }
  return true;
}

export function formatPgnExport(
  initialFen: string,
  moves: readonly MoveRecord[],
  headers: Record<string, string>,
  result: GameResult | null,
): string {
  const chess = new Chess(initialFen);
  for (const move of moves) {
    chess.move({
      from: move.from,
      to: move.to,
      promotion: move.promotion,
    });
  }

  const resultTag = result
    ? result.winner === 'w'
      ? '1-0'
      : result.winner === 'b'
        ? '0-1'
        : '1/2-1/2'
    : '*';

  chess.setHeader('Event', headers['Event'] ?? 'KingChess Arena');
  chess.setHeader('Site', headers['Site'] ?? 'KingChess');
  chess.setHeader('Date', headers['Date'] ?? new Date().toISOString().slice(0, 10));
  chess.setHeader('White', headers['White'] ?? 'White');
  chess.setHeader('Black', headers['Black'] ?? 'Black');
  chess.setHeader('Result', resultTag);
  if (headers['TimeControl']) {
    chess.setHeader('TimeControl', headers['TimeControl']);
  }

  return chess.pgn();
}

export function runPerft(depth: number, fen: string = DEFAULT_POSITION): number {
  const chess = new Chess(fen);
  return chess.perft(depth);
}
