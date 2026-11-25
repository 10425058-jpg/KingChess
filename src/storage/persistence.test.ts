import { describe, expect, it } from 'vitest';
import { DEFAULT_POSITION } from '../engine/chessRules';
import type { SavedGameV1 } from '../types/chess';
import {
  DEFAULT_SETTINGS,
  SESSION_STORAGE_KEY,
  SETTINGS_STORAGE_KEY,
  loadSavedGameSession,
  loadSettings,
  saveGameSession,
  saveSettings,
} from './persistence';

describe('persistence', () => {
  it('saves and restores valid settings and recovers safely from corrupt settings', () => {
    saveSettings({
      ...DEFAULT_SETTINGS,
      boardTheme: 'charcoal-slate',
      soundEnabled: false,
      motionPreference: 'reduced',
    });

    const loaded = loadSettings();
    expect(loaded.recoveredFromCorrupt).toBe(false);
    expect(loaded.settings.boardTheme).toBe('charcoal-slate');
    expect(loaded.settings.soundEnabled).toBe(false);
    expect(loaded.settings.motionPreference).toBe('reduced');

    window.localStorage.setItem(SETTINGS_STORAGE_KEY, '{not-valid-json');
    const corrupt = loadSettings();
    expect(corrupt.recoveredFromCorrupt).toBe(true);
    expect(corrupt.settings).toEqual(DEFAULT_SETTINGS);
  });

  it('saves and reconstructs valid game sessions and rejects corrupt saves', () => {
    const validSession: SavedGameV1 = {
      version: 1,
      savedAt: '2026-11-25T03:00:00.000Z',
      mode: 'ai',
      humanColor: 'w',
      difficulty: 'medium',
      timeControlId: '3+2',
      initialFen: DEFAULT_POSITION,
      uciMoves: ['e2e4', 'e7e5', 'g1f3'],
      flipped: false,
      clockSnapshots: [
        { wMs: 180_000, bMs: 180_000 },
        { wMs: 181_000, bMs: 180_000 },
        { wMs: 181_000, bMs: 181_500 },
        { wMs: 182_000, bMs: 181_500 },
      ],
      currentClocks: { wMs: 182_000, bMs: 181_500 },
      isPaused: false,
      result: null,
    };

    saveGameSession(validSession);
    const loaded = loadSavedGameSession();
    expect(loaded.corruptError).toBeNull();
    expect(loaded.session?.uciMoves).toEqual(['e2e4', 'e7e5', 'g1f3']);

    // Corrupt move sequence inside valid JSON
    window.localStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify({
        ...validSession,
        uciMoves: ['e2e5', 'e7e5', 'g1f3'], // illegal e2-e5
      }),
    );
    const corruptMoves = loadSavedGameSession();
    expect(corruptMoves.session).toBeNull();
    expect(corruptMoves.corruptError).toBeTruthy();
    expect(window.localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();

    // Corrupt raw JSON
    window.localStorage.setItem(SESSION_STORAGE_KEY, '<<<broken>>>');
    const corruptJson = loadSavedGameSession();
    expect(corruptJson.session).toBeNull();
    expect(corruptJson.corruptError).toBeTruthy();
  });
});
