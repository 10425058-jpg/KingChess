import { Crown, Eye, Home, RefreshCw, X } from 'lucide-react';
import { useGameStore } from '../../stores/gameStore';

const REASON_LABELS: Record<string, string> = {
  checkmate: 'Checkmate',
  stalemate: 'Stalemate',
  'insufficient-material': 'Insufficient Mating Material',
  'timeout-insufficient-material': 'Timeout vs Insufficient Material',
  'fivefold-repetition': 'Automatic Fivefold Repetition',
  'seventy-five-move': 'Automatic 75-Move Rule',
  'threefold-claim': 'Claimed Threefold Repetition',
  'fifty-move-claim': 'Claimed 50-Move Rule',
  'draw-agreement': 'Mutual Draw Agreement',
  resignation: 'Resignation',
  timeout: 'Time Expired',
};

export function GameOverModal() {
  const result = useGameStore((s) => s.result);
  const showGameOverModal = useGameStore((s) => s.showGameOverModal);
  const moves = useGameStore((s) => s.moves);
  const rematch = useGameStore((s) => s.rematch);
  const enterReviewAfterGameOver = useGameStore((s) => s.enterReviewAfterGameOver);
  const goToLobby = useGameStore((s) => s.goToLobby);
  const closeGameOverModal = useGameStore((s) => s.closeGameOverModal);

  if (!result || !showGameOverModal) {
    return null;
  }

  const headline =
    result.winner === 'draw'
      ? 'Match Drawn'
      : result.winner === 'w'
        ? 'White Wins'
        : 'Black Wins';

  return (
    <div
      className="kc-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="gameover-title"
      data-testid="game-over-modal"
    >
      <div className="kc-modal" style={{ maxWidth: 440 }}>
        <div className="kc-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Crown size={22} color="#D4AF65" aria-hidden="true" />
            <h2 id="gameover-title" className="kc-modal-title">
              {headline}
            </h2>
          </div>
          <button
            type="button"
            className="kc-icon-btn"
            aria-label="Close game over summary"
            onClick={closeGameOverModal}
            data-testid="gameover-close-btn"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <div
          style={{
            padding: '14px 16px',
            borderRadius: '10px',
            background: 'var(--kc-bg-charcoal)',
            border: '1px solid var(--kc-border-subtle)',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          <span style={{ fontWeight: 700, color: 'var(--kc-ivory)' }}>
            {REASON_LABELS[result.reason] ?? result.reason}
          </span>
          <span style={{ fontSize: '0.9rem', color: 'var(--kc-ivory-muted)' }}>
            {result.message} · {moves.length} half-moves played
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button
            type="button"
            className="kc-btn kc-btn-primary"
            onClick={() => rematch()}
            data-testid="gameover-rematch-btn"
          >
            <RefreshCw size={16} aria-hidden="true" />
            <span>Rematch</span>
          </button>
          <button
            type="button"
            className="kc-btn kc-btn-gold-outline"
            onClick={enterReviewAfterGameOver}
            data-testid="gameover-review-btn"
          >
            <Eye size={16} aria-hidden="true" />
            <span>Review Board</span>
          </button>
          <button
            type="button"
            className="kc-btn"
            onClick={goToLobby}
            data-testid="gameover-lobby-btn"
          >
            <Home size={16} aria-hidden="true" />
            <span>Back to Lobby</span>
          </button>
        </div>
      </div>
    </div>
  );
}
