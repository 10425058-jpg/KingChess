import type { Square } from 'chess.js';

export type PieceColor = 'w' | 'b';
export type PieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';
export type PromotionPiece = 'q' | 'r' | 'b' | 'n';

export type GameMode = 'ai' | 'local';
export type PlayerColorChoice = 'w' | 'b' | 'random';
export type DifficultyId = 'beginner' | 'easy' | 'medium' | 'hard' | 'expert';
export type TimeControlId = 'untimed' | '3+2' | '5+0' | '10+0' | '15+10';

export type GamePhase =
  | 'SETUP'
  | 'PLAYER_TURN'
  | 'AI_THINKING'
  | 'PROMOTION_PENDING'
  | 'GAME_OVER'
  | 'REVIEW';

export type BoardThemeId = 'walnut-ivory' | 'charcoal-slate' | 'emerald-parchment';
export type PieceThemeId = 'classic-ivory' | 'royal-gold' | 'tournament-ebony';
export type MotionPreference = 'system' | 'full' | 'reduced';

export type DrawClaimType = 'threefold' | 'fifty-move';

export type GameEndReason =
  | 'checkmate'
  | 'stalemate'
  | 'insufficient-material'
  | 'timeout-insufficient-material'
  | 'fivefold-repetition'
  | 'seventy-five-move'
  | 'threefold-claim'
  | 'fifty-move-claim'
  | 'draw-agreement'
  | 'resignation'
  | 'timeout';

export interface GameResult {
  winner: PieceColor | 'draw';
  reason: GameEndReason;
  message: string;
}

export interface MoveRecord {
  ply: number;
  moveNumber: number;
  color: PieceColor;
  from: Square;
  to: Square;
  piece: PieceType;
  captured?: PieceType;
  promotion?: PromotionPiece;
  san: string;
  uci: string;
  fenAfter: string;
  isCheck: boolean;
  isCheckmate: boolean;
  isCapture: boolean;
  isEnPassant: boolean;
  isCastle: 'kingside' | 'queenside' | null;
}

export interface BoardPiece {
  square: Square;
  type: PieceType;
  color: PieceColor;
}

export interface CapturedSummary {
  capturedByWhite: PieceType[];
  capturedByBlack: PieceType[];
  materialAdvantageWhite: number;
}

export interface PendingPromotion {
  from: Square;
  to: Square;
  color: PieceColor;
}

export interface PositionEvaluation {
  type: 'cp' | 'mate';
  /** Normalized to White's perspective (+ favors White, - favors Black). */
  value: number;
  depth: number;
  bestMoveUci?: string;
}

export interface ClockSnapshot {
  wMs: number;
  bMs: number;
}

export interface ClockState {
  timeControlId: TimeControlId;
  wMs: number;
  bMs: number;
  activeColor: PieceColor | null;
  isPaused: boolean;
  lastUpdatedAtMs: number | null;
}

export interface AppSettings {
  version: 1;
  boardTheme: BoardThemeId;
  pieceTheme: PieceThemeId;
  soundEnabled: boolean;
  showCoordinates: boolean;
  motionPreference: MotionPreference;
  showEvalBar: boolean;
  allowHints: boolean;
}

export interface SavedGameV1 {
  version: 1;
  savedAt: string;
  mode: GameMode;
  humanColor: PieceColor;
  difficulty: DifficultyId;
  timeControlId: TimeControlId;
  initialFen: string;
  uciMoves: string[];
  flipped: boolean;
  clockSnapshots: ClockSnapshot[];
  currentClocks: ClockSnapshot;
  isPaused: boolean;
  result: GameResult | null;
}
