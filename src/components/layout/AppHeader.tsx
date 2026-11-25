import { ArrowLeft, BookOpen, Crown, Settings } from 'lucide-react';
import { DIFFICULTY_PRESETS } from '../../ai/difficulty';
import { TIME_CONTROLS } from '../../clock/clockController';
import { useGameStore } from '../../stores/gameStore';

interface AppHeaderProps {
  onOpenRules: () => void;
  onOpenSettings: () => void;
}

export function AppHeader({ onOpenRules, onOpenSettings }: AppHeaderProps) {
  const mode = useGameStore((s) => s.mode);
  const difficulty = useGameStore((s) => s.difficulty);
  const timeControlId = useGameStore((s) => s.timeControlId);
  const goToLobby = useGameStore((s) => s.goToLobby);

  const modeSummary =
    mode === 'ai'
      ? `vs Stockfish · ${DIFFICULTY_PRESETS[difficulty].label} · ${TIME_CONTROLS[timeControlId].shortLabel}`
      : `Local Two Players · ${TIME_CONTROLS[timeControlId].shortLabel}`;

  return (
    <header className="kc-header">
      <div className="kc-header-left">
        <button
          type="button"
          className="kc-btn kc-btn-sm"
          onClick={goToLobby}
          data-testid="nav-lobby-btn"
          aria-label="Return to Lobby"
        >
          <ArrowLeft size={15} aria-hidden="true" />
          <span>Lobby</span>
        </button>

        <div className="kc-brand-mini">
          <Crown size={18} aria-hidden="true" />
          <span>KingChess</span>
        </div>

        <span className="kc-mode-pill" data-testid="header-mode-pill">
          {modeSummary}
        </span>
      </div>

      <div className="kc-header-right">
        <button
          type="button"
          className="kc-btn kc-btn-sm"
          onClick={onOpenRules}
          data-testid="header-rules-btn"
        >
          <BookOpen size={15} aria-hidden="true" />
          <span>Rules</span>
        </button>
        <button
          type="button"
          className="kc-btn kc-btn-sm"
          onClick={onOpenSettings}
          data-testid="header-settings-btn"
        >
          <Settings size={15} aria-hidden="true" />
          <span>Settings</span>
        </button>
      </div>
    </header>
  );
}
