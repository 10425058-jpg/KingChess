import { useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  Cpu,
  Crown,
  Play,
  Settings,
  Trash2,
  Users,
} from 'lucide-react';
import { DIFFICULTY_ORDER, DIFFICULTY_PRESETS } from '../../ai/difficulty';
import { TIME_CONTROL_ORDER, TIME_CONTROLS } from '../../clock/clockController';
import { useGameStore } from '../../stores/gameStore';
import type { DifficultyId, PlayerColorChoice, TimeControlId } from '../../types/chess';

interface LobbyViewProps {
  onOpenRules: () => void;
  onOpenSettings: () => void;
}

export function LobbyView({ onOpenRules, onOpenSettings }: LobbyViewProps) {
  const savedSession = useGameStore((s) => s.savedSession);
  const corruptSaveNotice = useGameStore((s) => s.corruptSaveNotice);
  const dismissCorruptSaveNotice = useGameStore((s) => s.dismissCorruptSaveNotice);
  const startNewGame = useGameStore((s) => s.startNewGame);
  const resumeSavedGame = useGameStore((s) => s.resumeSavedGame);
  const clearSavedSession = useGameStore((s) => s.clearSavedSession);

  const [aiDifficulty, setAiDifficulty] = useState<DifficultyId>('medium');
  const [aiColor, setAiColor] = useState<PlayerColorChoice>('w');
  const [aiTimeControl, setAiTimeControl] = useState<TimeControlId>('10+0');
  const [localTimeControl, setLocalTimeControl] = useState<TimeControlId>('10+0');

  const savedModeLabel = savedSession
    ? savedSession.mode === 'ai'
      ? `vs Stockfish (${DIFFICULTY_PRESETS[savedSession.difficulty].label})`
      : 'Local Two Players'
    : '';

  const savedResultLabel = savedSession?.result
    ? savedSession.result.message
    : savedSession
      ? `${savedSession.uciMoves.length} half-moves played`
      : '';

  return (
    <main className="kc-lobby" data-testid="lobby-view">
      <div className="kc-lobby-topbar">
        <div className="kc-lobby-hero">
          <div className="kc-crest-box" aria-hidden="true">
            <Crown size={28} />
          </div>
          <div>
            <h1 className="kc-lobby-title">KingChess</h1>
            <p className="kc-lobby-subtitle">
              Royal 2D Chess Arena · Precision Rules &amp; Stockfish 19
            </p>
          </div>
        </div>

        <div className="kc-lobby-actions">
          <button
            type="button"
            className="kc-btn"
            onClick={onOpenRules}
            data-testid="lobby-rules-btn"
          >
            <BookOpen size={16} aria-hidden="true" />
            <span>Rules</span>
          </button>
          <button
            type="button"
            className="kc-btn"
            onClick={onOpenSettings}
            data-testid="lobby-settings-btn"
          >
            <Settings size={16} aria-hidden="true" />
            <span>Settings</span>
          </button>
        </div>
      </div>

      {corruptSaveNotice && (
        <div className="kc-banner kc-banner-warn" role="alert" data-testid="corrupt-save-banner">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <AlertTriangle size={18} aria-hidden="true" />
            <span>{corruptSaveNotice}</span>
          </div>
          <button
            type="button"
            className="kc-btn kc-btn-sm"
            onClick={dismissCorruptSaveNotice}
          >
            Dismiss
          </button>
        </div>
      )}

      {savedSession && (
        <section className="kc-continue-card" aria-label="Resume saved game">
          <div className="kc-continue-meta">
            <span className="kc-continue-title">Saved Match Ready</span>
            <span className="kc-continue-sub">
              {savedModeLabel} · {TIME_CONTROLS[savedSession.timeControlId].label} ·{' '}
              {savedResultLabel}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="kc-btn kc-btn-primary"
              onClick={() => resumeSavedGame()}
              data-testid="continue-game-btn"
            >
              <Play size={16} aria-hidden="true" />
              <span>Continue Game</span>
            </button>
            <button
              type="button"
              className="kc-btn"
              onClick={clearSavedSession}
              aria-label="Discard saved game"
              data-testid="discard-save-btn"
            >
              <Trash2 size={15} aria-hidden="true" />
            </button>
          </div>
        </section>
      )}

      <div className="kc-lobby-grid">
        {/* Play vs Computer */}
        <section className="kc-card" aria-labelledby="ai-card-heading">
          <div className="kc-card-header">
            <div className="kc-card-icon" aria-hidden="true">
              <Cpu size={20} />
            </div>
            <div>
              <h2 id="ai-card-heading" className="kc-card-title">
                Play vs Computer
              </h2>
              <p className="kc-card-desc">
                Challenge the dedicated Stockfish 19 Web Worker engine locally in your
                browser.
              </p>
            </div>
          </div>

          <div className="kc-field">
            <span className="kc-field-label">Your Side</span>
            <div className="kc-segmented" role="group" aria-label="Select your color">
              {(
                [
                  { id: 'w', label: 'White' },
                  { id: 'random', label: 'Random' },
                  { id: 'b', label: 'Black' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className="kc-seg-btn"
                  aria-pressed={aiColor === opt.id}
                  onClick={() => setAiColor(opt.id)}
                  data-testid={`ai-color-${opt.id}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="kc-field">
            <span className="kc-field-label">Difficulty Preset</span>
            <div className="kc-segmented" role="group" aria-label="Select AI difficulty">
              {DIFFICULTY_ORDER.map((id) => (
                <button
                  key={id}
                  type="button"
                  className="kc-seg-btn"
                  aria-pressed={aiDifficulty === id}
                  onClick={() => setAiDifficulty(id)}
                  data-testid={`ai-difficulty-${id}`}
                >
                  {DIFFICULTY_PRESETS[id].label}
                </button>
              ))}
            </div>
            <p className="kc-helper-note">{DIFFICULTY_PRESETS[aiDifficulty].description}</p>
          </div>

          <div className="kc-field">
            <span className="kc-field-label">Time Control</span>
            <div className="kc-segmented" role="group" aria-label="Select AI time control">
              {TIME_CONTROL_ORDER.map((id) => (
                <button
                  key={id}
                  type="button"
                  className="kc-seg-btn"
                  aria-pressed={aiTimeControl === id}
                  onClick={() => setAiTimeControl(id)}
                  data-testid={`ai-time-${id}`}
                >
                  {TIME_CONTROLS[id].shortLabel}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            className="kc-btn kc-btn-primary"
            onClick={() =>
              startNewGame({
                mode: 'ai',
                playerColorChoice: aiColor,
                difficulty: aiDifficulty,
                timeControlId: aiTimeControl,
              })
            }
            data-testid="start-ai-btn"
          >
            <Play size={16} aria-hidden="true" />
            <span>Start vs Computer</span>
          </button>
        </section>

        {/* Local Two Players */}
        <section className="kc-card" aria-labelledby="local-card-heading">
          <div className="kc-card-header">
            <div className="kc-card-icon" aria-hidden="true">
              <Users size={20} />
            </div>
            <div>
              <h2 id="local-card-heading" className="kc-card-title">
                Local Two Players
              </h2>
              <p className="kc-card-desc">
                Over-the-board pass-and-play on the same device with optional tournament
                clocks and board flip.
              </p>
            </div>
          </div>

          <div className="kc-field">
            <span className="kc-field-label">Time Control</span>
            <div
              className="kc-segmented"
              role="group"
              aria-label="Select local match time control"
            >
              {TIME_CONTROL_ORDER.map((id) => (
                <button
                  key={id}
                  type="button"
                  className="kc-seg-btn"
                  aria-pressed={localTimeControl === id}
                  onClick={() => setLocalTimeControl(id)}
                  data-testid={`local-time-${id}`}
                >
                  {TIME_CONTROLS[id].shortLabel}
                </button>
              ))}
            </div>
            <p className="kc-helper-note">
              Selected: {TIME_CONTROLS[localTimeControl].label}
            </p>
          </div>

          <div
            style={{
              padding: '12px 14px',
              borderRadius: '10px',
              background: 'var(--kc-bg-charcoal)',
              border: '1px solid var(--kc-border-subtle)',
              fontSize: '0.85rem',
              color: 'var(--kc-ivory-muted)',
              marginTop: 'auto',
            }}
          >
            Includes full FIDE move validation, mutual draw offers, threefold &amp;
            50-move draw claims, automatic fivefold &amp; 75-move draws, and instant
            SAN/PGN review.
          </div>

          <button
            type="button"
            className="kc-btn kc-btn-gold-outline"
            onClick={() =>
              startNewGame({
                mode: 'local',
                playerColorChoice: 'w',
                difficulty: 'medium',
                timeControlId: localTimeControl,
              })
            }
            data-testid="start-local-btn"
          >
            <Play size={16} aria-hidden="true" />
            <span>Start Local Two Players</span>
          </button>
        </section>
      </div>

      <footer className="kc-lobby-footer">
        <span>KingChess V1 · Runs 100% client-side with Stockfish 19 Lite WASM (GPL-3.0)</span>
        <span>Supports Click, Drag &amp; Drop, Touch, and Keyboard Navigation</span>
      </footer>
    </main>
  );
}
