import { useEffect } from 'react';
import { X } from 'lucide-react';
import { ChessPieceSvg } from '../../assets/pieces/ChessPieceSvg';
import { useGameStore } from '../../stores/gameStore';
import { useSettingsStore } from '../../stores/settingsStore';
import type { PromotionPiece } from '../../types/chess';

const PROMOTION_OPTIONS: ReadonlyArray<{
  piece: PromotionPiece;
  label: string;
  shortcut: string;
}> = [
  { piece: 'q', label: 'Queen', shortcut: 'Q' },
  { piece: 'r', label: 'Rook', shortcut: 'R' },
  { piece: 'b', label: 'Bishop', shortcut: 'B' },
  { piece: 'n', label: 'Knight', shortcut: 'N' },
];

export function PromotionModal() {
  const phase = useGameStore((s) => s.phase);
  const pendingPromotion = useGameStore((s) => s.pendingPromotion);
  const commitPromotion = useGameStore((s) => s.commitPromotion);
  const cancelPromotion = useGameStore((s) => s.cancelPromotion);
  const pieceTheme = useSettingsStore((s) => s.pieceTheme);

  const isOpen = phase === 'PROMOTION_PENDING' && pendingPromotion !== null;

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key === 'escape') {
        e.preventDefault();
        cancelPromotion();
      } else if (key === 'q' || key === 'r' || key === 'b' || key === 'n') {
        e.preventDefault();
        commitPromotion(key);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, commitPromotion, cancelPromotion]);

  if (!isOpen || !pendingPromotion) {
    return null;
  }

  return (
    <div
      className="kc-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="promo-modal-title"
      data-testid="promotion-modal"
    >
      <div className="kc-modal" style={{ maxWidth: 420 }}>
        <div className="kc-modal-header">
          <h2 id="promo-modal-title" className="kc-modal-title">
            Choose Promotion Piece
          </h2>
          <button
            type="button"
            className="kc-icon-btn"
            aria-label="Cancel promotion"
            onClick={cancelPromotion}
            data-testid="promo-cancel-btn"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--kc-ivory-muted)' }}>
          Promote pawn on {pendingPromotion.to} (press Q, R, B, N or Escape to cancel):
        </p>

        <div className="kc-promo-grid">
          {PROMOTION_OPTIONS.map((opt) => (
            <button
              key={opt.piece}
              type="button"
              className="kc-promo-btn"
              onClick={() => commitPromotion(opt.piece)}
              data-testid={`promote-${opt.piece}`}
              aria-label={`Promote to ${opt.label}`}
            >
              <div style={{ width: 48, height: 48 }}>
                <ChessPieceSvg
                  type={opt.piece}
                  color={pendingPromotion.color}
                  theme={pieceTheme}
                />
              </div>
              <span style={{ fontWeight: 600, fontSize: '0.86rem' }}>{opt.label}</span>
              <span style={{ fontSize: '0.72rem', color: 'var(--kc-text-muted)' }}>
                [{opt.shortcut}]
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
