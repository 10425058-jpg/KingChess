import { useEffect } from 'react';
import { RotateCcw, X } from 'lucide-react';
import { useSettingsStore } from '../../stores/settingsStore';
import type { BoardThemeId, MotionPreference, PieceThemeId } from '../../types/chess';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

const BOARD_THEMES: ReadonlyArray<{ id: BoardThemeId; label: string }> = [
  { id: 'walnut-ivory', label: 'Walnut & Ivory' },
  { id: 'charcoal-slate', label: 'Charcoal & Slate' },
  { id: 'emerald-parchment', label: 'Emerald & Parchment' },
];

const PIECE_THEMES: ReadonlyArray<{ id: PieceThemeId; label: string }> = [
  { id: 'classic-ivory', label: 'Classic Ivory' },
  { id: 'royal-gold', label: 'Royal Gold' },
  { id: 'tournament-ebony', label: 'Tournament' },
];

const MOTION_OPTIONS: ReadonlyArray<{ id: MotionPreference; label: string }> = [
  { id: 'system', label: 'System' },
  { id: 'full', label: 'Smooth' },
  { id: 'reduced', label: 'Reduced' },
];

export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const boardTheme = useSettingsStore((s) => s.boardTheme);
  const pieceTheme = useSettingsStore((s) => s.pieceTheme);
  const soundEnabled = useSettingsStore((s) => s.soundEnabled);
  const showCoordinates = useSettingsStore((s) => s.showCoordinates);
  const motionPreference = useSettingsStore((s) => s.motionPreference);
  const showEvalBar = useSettingsStore((s) => s.showEvalBar);
  const allowHints = useSettingsStore((s) => s.allowHints);

  const setBoardTheme = useSettingsStore((s) => s.setBoardTheme);
  const setPieceTheme = useSettingsStore((s) => s.setPieceTheme);
  const setSoundEnabled = useSettingsStore((s) => s.setSoundEnabled);
  const setShowCoordinates = useSettingsStore((s) => s.setShowCoordinates);
  const setMotionPreference = useSettingsStore((s) => s.setMotionPreference);
  const setShowEvalBar = useSettingsStore((s) => s.setShowEvalBar);
  const setAllowHints = useSettingsStore((s) => s.setAllowHints);
  const resetSettings = useSettingsStore((s) => s.resetSettings);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="kc-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-modal-title"
      data-testid="settings-modal"
    >
      <div className="kc-modal">
        <div className="kc-modal-header">
          <h2 id="settings-modal-title" className="kc-modal-title">
            Arena Settings
          </h2>
          <button
            type="button"
            className="kc-icon-btn"
            aria-label="Close settings"
            onClick={onClose}
            data-testid="settings-close-btn"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <div className="kc-field">
          <span className="kc-field-label">Board Theme</span>
          <div className="kc-segmented" role="group" aria-label="Board theme">
            {BOARD_THEMES.map((t) => (
              <button
                key={t.id}
                type="button"
                className="kc-seg-btn"
                aria-pressed={boardTheme === t.id}
                onClick={() => setBoardTheme(t.id)}
                data-testid={`board-theme-${t.id}`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="kc-field">
          <span className="kc-field-label">Piece Style</span>
          <div className="kc-segmented" role="group" aria-label="Piece style">
            {PIECE_THEMES.map((t) => (
              <button
                key={t.id}
                type="button"
                className="kc-seg-btn"
                aria-pressed={pieceTheme === t.id}
                onClick={() => setPieceTheme(t.id)}
                data-testid={`piece-theme-${t.id}`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="kc-field">
          <span className="kc-field-label">Motion &amp; Animations</span>
          <div className="kc-segmented" role="group" aria-label="Motion preference">
            {MOTION_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                className="kc-seg-btn"
                aria-pressed={motionPreference === opt.id}
                onClick={() => setMotionPreference(opt.id)}
                data-testid={`motion-pref-${opt.id}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="kc-setting-row">
            <div className="kc-setting-label">
              <span className="kc-setting-title">Board Coordinates</span>
              <span className="kc-setting-sub">Show file letters and rank numbers</span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={showCoordinates}
              aria-label="Toggle board coordinates"
              className="kc-toggle"
              onClick={() => setShowCoordinates(!showCoordinates)}
              data-testid="toggle-coordinates"
            >
              <span className="kc-toggle-thumb" />
            </button>
          </div>

          <div className="kc-setting-row">
            <div className="kc-setting-label">
              <span className="kc-setting-title">Sound Effects</span>
              <span className="kc-setting-sub">Subtle acoustic move, capture, and check cues</span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={soundEnabled}
              aria-label="Toggle sound effects"
              className="kc-toggle"
              onClick={() => setSoundEnabled(!soundEnabled)}
              data-testid="toggle-sound"
            >
              <span className="kc-toggle-thumb" />
            </button>
          </div>

          <div className="kc-setting-row">
            <div className="kc-setting-label">
              <span className="kc-setting-title">Engine Evaluation Bar</span>
              <span className="kc-setting-sub">Display live Stockfish score during AI games</span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={showEvalBar}
              aria-label="Toggle engine evaluation bar"
              className="kc-toggle"
              onClick={() => setShowEvalBar(!showEvalBar)}
              data-testid="toggle-eval-bar"
            >
              <span className="kc-toggle-thumb" />
            </button>
          </div>

          <div className="kc-setting-row">
            <div className="kc-setting-label">
              <span className="kc-setting-title">Legal Move Hints</span>
              <span className="kc-setting-sub">Enable Stockfish move hints during your turn</span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={allowHints}
              aria-label="Toggle legal hints"
              className="kc-toggle"
              onClick={() => setAllowHints(!allowHints)}
              data-testid="toggle-hints"
            >
              <span className="kc-toggle-thumb" />
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
          <button
            type="button"
            className="kc-btn kc-btn-sm"
            onClick={resetSettings}
            data-testid="reset-settings-btn"
          >
            <RotateCcw size={14} aria-hidden="true" />
            <span>Reset Defaults</span>
          </button>
          <button
            type="button"
            className="kc-btn kc-btn-primary kc-btn-sm"
            onClick={onClose}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
