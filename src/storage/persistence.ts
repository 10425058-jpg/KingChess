import { createChessFromPosition, isValidFen } from '../engine/chessRules';
import type {
  AppSettings,
  BoardThemeId,
  DifficultyId,
  GameMode,
  GameResult,
  MotionPreference,
  PieceColor,
  PieceThemeId,
  SavedGameV1,
  TimeControlId,
} from '../types/chess';

export const SETTINGS_STORAGE_KEY = 'kingchess.settings.v1';
export const SESSION_STORAGE_KEY = 'kingchess.session.v1';

export const DEFAULT_SETTINGS: AppSettings = {
  version: 1,
  boardTheme: 'walnut-ivory',
  pieceTheme: 'classic-ivory',
  soundEnabled: true,
  showCoordinates: true,
  motionPreference: 'system',
  showEvalBar: false,
  allowHints: true,
};

const VALID_BOARD_THEMES = new Set<BoardThemeId>([
  'walnut-ivory',
  'charcoal-slate',
  'emerald-parchment',
]);
const VALID_PIECE_THEMES = new Set<PieceThemeId>([
  'classic-ivory',
  'royal-gold',
  'tournament-ebony',
]);
const VALID_MOTION_PREFS = new Set<MotionPreference>(['system', 'full', 'reduced']);
const VALID_MODES = new Set<GameMode>(['ai', 'local']);
const VALID_COLORS = new Set<PieceColor>(['w', 'b']);
const VALID_DIFFICULTIES = new Set<DifficultyId>([
  'beginner',
  'easy',
  'medium',
  'hard',
  'expert',
]);
const VALID_TIME_CONTROLS = new Set<TimeControlId>([
  'untimed',
  '3+2',
  '5+0',
  '10+0',
  '15+10',
]);
const VALID_END_REASONS = new Set([
  'checkmate',
  'stalemate',
  'insufficient-material',
  'timeout-insufficient-material',
  'fivefold-repetition',
  'seventy-five-move',
  'threefold-claim',
  'fifty-move-claim',
  'draw-agreement',
  'resignation',
  'timeout',
]);

function getSafeStorage(): Storage | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return null;
    }
    return window.localStorage;
  } catch {
    return null;
  }
}

export function loadSettings(): { settings: AppSettings; recoveredFromCorrupt: boolean } {
  const storage = getSafeStorage();
  if (!storage) {
    return { settings: { ...DEFAULT_SETTINGS }, recoveredFromCorrupt: false };
  }

  let raw: string | null;
  try {
    raw = storage.getItem(SETTINGS_STORAGE_KEY);
  } catch {
    return { settings: { ...DEFAULT_SETTINGS }, recoveredFromCorrupt: false };
  }

  if (!raw) {
    return { settings: { ...DEFAULT_SETTINGS }, recoveredFromCorrupt: false };
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('Invalid settings object');
    }
    const obj = parsed as Record<string, unknown>;
    if (obj['version'] !== 1) {
      throw new Error('Unsupported settings version');
    }

    const boardTheme = VALID_BOARD_THEMES.has(obj['boardTheme'] as BoardThemeId)
      ? (obj['boardTheme'] as BoardThemeId)
      : DEFAULT_SETTINGS.boardTheme;
    const pieceTheme = VALID_PIECE_THEMES.has(obj['pieceTheme'] as PieceThemeId)
      ? (obj['pieceTheme'] as PieceThemeId)
      : DEFAULT_SETTINGS.pieceTheme;
    const motionPreference = VALID_MOTION_PREFS.has(
      obj['motionPreference'] as MotionPreference,
    )
      ? (obj['motionPreference'] as MotionPreference)
      : DEFAULT_SETTINGS.motionPreference;

    return {
      settings: {
        version: 1,
        boardTheme,
        pieceTheme,
        soundEnabled:
          typeof obj['soundEnabled'] === 'boolean'
            ? obj['soundEnabled']
            : DEFAULT_SETTINGS.soundEnabled,
        showCoordinates:
          typeof obj['showCoordinates'] === 'boolean'
            ? obj['showCoordinates']
            : DEFAULT_SETTINGS.showCoordinates,
        motionPreference,
        showEvalBar:
          typeof obj['showEvalBar'] === 'boolean'
            ? obj['showEvalBar']
            : DEFAULT_SETTINGS.showEvalBar,
        allowHints:
          typeof obj['allowHints'] === 'boolean'
            ? obj['allowHints']
            : DEFAULT_SETTINGS.allowHints,
      },
      recoveredFromCorrupt: false,
    };
  } catch {
    try {
      storage.removeItem(SETTINGS_STORAGE_KEY);
    } catch {
      // ignore storage cleanup failure
    }
    return { settings: { ...DEFAULT_SETTINGS }, recoveredFromCorrupt: true };
  }
}

export function saveSettings(settings: AppSettings): void {
  const storage = getSafeStorage();
  if (!storage) {
    return;
  }
  try {
    storage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // ignore quota errors gracefully
  }
}

function isValidClockSnapshot(value: unknown): value is { wMs: number; bMs: number } {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const obj = value as Record<string, unknown>;
  return (
    typeof obj['wMs'] === 'number' &&
    Number.isFinite(obj['wMs']) &&
    obj['wMs'] >= 0 &&
    typeof obj['bMs'] === 'number' &&
    Number.isFinite(obj['bMs']) &&
    obj['bMs'] >= 0
  );
}

function isValidResult(value: unknown): value is GameResult | null {
  if (value === null) {
    return true;
  }
  if (!value || typeof value !== 'object') {
    return false;
  }
  const obj = value as Record<string, unknown>;
  const winnerValid =
    obj['winner'] === 'w' || obj['winner'] === 'b' || obj['winner'] === 'draw';
  const reasonValid =
    typeof obj['reason'] === 'string' && VALID_END_REASONS.has(obj['reason']);
  const messageValid = typeof obj['message'] === 'string';
  return winnerValid && reasonValid && messageValid;
}

export function saveGameSession(session: SavedGameV1): void {
  const storage = getSafeStorage();
  if (!storage) {
    return;
  }
  try {
    storage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch {
    // ignore quota errors gracefully
  }
}

export function clearSavedGameSession(): void {
  const storage = getSafeStorage();
  if (!storage) {
    return;
  }
  try {
    storage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function loadSavedGameSession(): {
  session: SavedGameV1 | null;
  corruptError: string | null;
} {
  const storage = getSafeStorage();
  if (!storage) {
    return { session: null, corruptError: null };
  }

  let raw: string | null;
  try {
    raw = storage.getItem(SESSION_STORAGE_KEY);
  } catch {
    return { session: null, corruptError: null };
  }

  if (!raw) {
    return { session: null, corruptError: null };
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('Saved game payload is not an object');
    }
    const obj = parsed as Record<string, unknown>;

    if (obj['version'] !== 1) {
      throw new Error('Unsupported saved game schema version');
    }
    if (!VALID_MODES.has(obj['mode'] as GameMode)) {
      throw new Error('Invalid saved game mode');
    }
    if (!VALID_COLORS.has(obj['humanColor'] as PieceColor)) {
      throw new Error('Invalid saved player color');
    }
    if (!VALID_DIFFICULTIES.has(obj['difficulty'] as DifficultyId)) {
      throw new Error('Invalid saved difficulty');
    }
    if (!VALID_TIME_CONTROLS.has(obj['timeControlId'] as TimeControlId)) {
      throw new Error('Invalid saved time control');
    }
    if (typeof obj['initialFen'] !== 'string' || !isValidFen(obj['initialFen']).ok) {
      throw new Error('Invalid saved initial FEN');
    }
    if (
      !Array.isArray(obj['uciMoves']) ||
      !obj['uciMoves'].every((m): m is string => typeof m === 'string')
    ) {
      throw new Error('Invalid saved move list');
    }
    const uciMoves = obj['uciMoves'];

    if (
      !Array.isArray(obj['clockSnapshots']) ||
      obj['clockSnapshots'].length !== uciMoves.length + 1 ||
      !obj['clockSnapshots'].every(isValidClockSnapshot)
    ) {
      throw new Error('Invalid saved clock snapshots');
    }
    if (!isValidClockSnapshot(obj['currentClocks'])) {
      throw new Error('Invalid saved current clocks');
    }
    if (!isValidResult(obj['result'])) {
      throw new Error('Invalid saved game result');
    }

    // Reconstruct the entire move sequence cleanly to verify legality and repetition history
    createChessFromPosition(obj['initialFen'], uciMoves);

    return {
      session: {
        version: 1,
        savedAt:
          typeof obj['savedAt'] === 'string'
            ? obj['savedAt']
            : new Date().toISOString(),
        mode: obj['mode'] as GameMode,
        humanColor: obj['humanColor'] as PieceColor,
        difficulty: obj['difficulty'] as DifficultyId,
        timeControlId: obj['timeControlId'] as TimeControlId,
        initialFen: obj['initialFen'],
        uciMoves,
        flipped: Boolean(obj['flipped']),
        clockSnapshots: obj['clockSnapshots'],
        currentClocks: obj['currentClocks'],
        isPaused: Boolean(obj['isPaused']),
        result: obj['result'],
      },
      corruptError: null,
    };
  } catch {
    clearSavedGameSession();
    return {
      session: null,
      corruptError:
        'A previously saved game was damaged or invalid and has been cleared safely.',
    };
  }
}
