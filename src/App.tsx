import { useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { ChessBoard } from './components/board/ChessBoard';
import { PromotionModal } from './components/board/PromotionModal';
import { AppHeader } from './components/layout/AppHeader';
import { LobbyView } from './components/lobby/LobbyView';
import { GameOverModal } from './components/modals/GameOverModal';
import { RulesModal } from './components/modals/RulesModal';
import { SettingsModal } from './components/modals/SettingsModal';
import { EvalBar } from './components/panels/EvalBar';
import { GameControls } from './components/panels/GameControls';
import { MoveHistoryPanel } from './components/panels/MoveHistoryPanel';
import { PlayerCard } from './components/panels/PlayerCard';
import { useGameClock } from './hooks/useGameClock';
import { useReducedMotion } from './hooks/useReducedMotion';
import { useStockfishAI } from './hooks/useStockfishAI';
import { useGameStore } from './stores/gameStore';
import { useSettingsStore } from './stores/settingsStore';

function ArenaStatusBanner() {
  const phase = useGameStore((s) => s.phase);
  const mode = useGameStore((s) => s.mode);
  const liveSnapshot = useGameStore((s) => s.liveSnapshot);
  const reviewSnapshot = useGameStore((s) => s.reviewSnapshot);
  const moves = useGameStore((s) => s.moves);
  const viewPly = useGameStore((s) => s.viewPly);
  const result = useGameStore((s) => s.result);
  const isPaused = useGameStore((s) => s.clock.isPaused);
  const aiWarning = useGameStore((s) => s.aiWarning);
  const reviewLast = useGameStore((s) => s.reviewLast);
  const openGameOverModal = useGameStore((s) => s.openGameOverModal);

  if (result !== null) {
    return (
      <div className="kc-status-banner is-gameover" data-testid="status-banner">
        <span>{result.message}</span>
        <button
          type="button"
          className="kc-btn kc-btn-sm"
          onClick={openGameOverModal}
          data-testid="view-result-btn"
        >
          Summary
        </button>
      </div>
    );
  }

  if (phase === 'REVIEW') {
    return (
      <div className="kc-status-banner is-review" data-testid="status-banner">
        <span>
          Reviewing ply {viewPly} of {moves.length}
        </span>
        <button
          type="button"
          className="kc-btn kc-btn-primary kc-btn-sm"
          onClick={reviewLast}
          data-testid="return-to-live-btn"
        >
          Return to Live
        </button>
      </div>
    );
  }

  if (isPaused) {
    return (
      <div className="kc-status-banner" data-testid="status-banner">
        <span>Match paused · Clocks stopped</span>
      </div>
    );
  }

  if (phase === 'AI_THINKING' && mode === 'ai') {
    return (
      <div className="kc-status-banner is-thinking" data-testid="status-banner">
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <span className="kc-thinking-dot" aria-hidden="true" />
          <span>Stockfish is thinking…</span>
        </span>
      </div>
    );
  }

  const turnText = liveSnapshot.turn === 'w' ? 'White to move' : 'Black to move';
  const checkNote = reviewSnapshot.inCheck ? ' · Check!' : '';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div className="kc-status-banner" data-testid="status-banner">
        <span>
          {turnText}
          {checkNote}
        </span>
      </div>
      {aiWarning && (
        <div
          className="kc-banner kc-banner-warn"
          style={{ padding: '7px 10px', fontSize: '0.8rem' }}
          role="status"
          data-testid="ai-warning-banner"
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <AlertCircle size={14} aria-hidden="true" />
            <span>{aiWarning}</span>
          </span>
        </div>
      )}
    </div>
  );
}

export function App() {
  const view = useGameStore((s) => s.view);
  const flipped = useGameStore((s) => s.flipped);
  const boardTheme = useSettingsStore((s) => s.boardTheme);
  const reducedMotion = useReducedMotion();

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);

  useGameClock();
  const { requestHint } = useStockfishAI();

  const topColor = flipped ? 'w' : 'b';
  const bottomColor = flipped ? 'b' : 'w';

  return (
    <div
      className="kc-app"
      data-board-theme={boardTheme}
      data-reduced-motion={String(reducedMotion)}
    >
      {view === 'lobby' ? (
        <LobbyView
          onOpenRules={() => setRulesOpen(true)}
          onOpenSettings={() => setSettingsOpen(true)}
        />
      ) : (
        <>
          <AppHeader
            onOpenRules={() => setRulesOpen(true)}
            onOpenSettings={() => setSettingsOpen(true)}
          />

          <main className="kc-arena" data-testid="game-arena">
            <div className="kc-board-column">
              <div className="kc-board-stack">
                <PlayerCard color={topColor} position="top" />

                <div className="kc-board-stage">
                  <EvalBar />
                  <ChessBoard />
                </div>

                <PlayerCard color={bottomColor} position="bottom" />
              </div>
            </div>

            <aside className="kc-side-panel" aria-label="Game controls and move history">
              <ArenaStatusBanner />
              <GameControls onRequestHint={requestHint} />
              <MoveHistoryPanel />
            </aside>
          </main>

          <PromotionModal />
          <GameOverModal />
        </>
      )}

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <RulesModal open={rulesOpen} onClose={() => setRulesOpen(false)} />
    </div>
  );
}

export default App;
