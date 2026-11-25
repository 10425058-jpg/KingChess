import { useEffect } from 'react';
import { X } from 'lucide-react';

interface RulesModalProps {
  open: boolean;
  onClose: () => void;
}

export function RulesModal({ open, onClose }: RulesModalProps) {
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
      aria-labelledby="rules-modal-title"
      data-testid="rules-modal"
    >
      <div className="kc-modal" style={{ maxWidth: 580 }}>
        <div className="kc-modal-header">
          <h2 id="rules-modal-title" className="kc-modal-title">
            KingChess Rules &amp; Controls
          </h2>
          <button
            type="button"
            className="kc-icon-btn"
            aria-label="Close rules"
            onClick={onClose}
            data-testid="rules-close-btn"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <div className="kc-rules-section">
          <h3>Controls</h3>
          <ul>
            <li>
              <strong>Click / Tap:</strong> Select a piece to highlight legal destinations
              (dots) and captures (rings), then select a highlighted square.
            </li>
            <li>
              <strong>Drag &amp; Drop (Mouse or Touch):</strong> Drag any active piece to
              a legal target square.
            </li>
            <li>
              <strong>Keyboard:</strong> Tab onto the board, navigate squares with Arrow
              keys, press Enter or Space to select/move, and Escape to cancel.
            </li>
          </ul>

          <h3>Special Chess Rules</h3>
          <ul>
            <li>
              <strong>Castling:</strong> Supported on both kingside (O-O) and queenside
              (O-O-O) when neither king nor rook has moved, intervening squares are empty,
              and the king does not start in, pass through, or land in check.
            </li>
            <li>
              <strong>En Passant:</strong> Available immediately after a two-square pawn
              advance, expires after one half-move, and respects king-safety pins.
            </li>
            <li>
              <strong>Promotion:</strong> Pawns reaching the final rank require choosing
              Queen, Rook, Bishop, or Knight.
            </li>
          </ul>

          <h3>Draws, Clocks &amp; Checkmates</h3>
          <ul>
            <li>
              <strong>Checkmate Precedence:</strong> Checkmate always wins immediately, even
              on the 50th/75th move or repeated position.
            </li>
            <li>
              <strong>Claimable Draws:</strong> Threefold repetition (3x) and the 50-move
              rule (100 half-moves) enable the <em>Claim Draw</em> button without ending
              play automatically.
            </li>
            <li>
              <strong>Automatic Draws:</strong> Stalemate, standard insufficient material
              (K vs K, K+B/N vs K, same-color bishops), fivefold repetition (5x), and the
              75-move rule (150 half-moves) conclude automatically.
            </li>
            <li>
              <strong>Clocks &amp; Reload:</strong> Timed modes track monotonic time and
              add increments once per legal move. Reloading or returning to the lobby
              pauses your clock cleanly without offline penalty.
            </li>
          </ul>

          <h3>Engine &amp; Licenses</h3>
          <ul>
            <li>
              <strong>AI Opponent:</strong> Powered by Stockfish 19 Lite Single-Thread WASM
              in a dedicated Web Worker (no cross-origin isolation required), licensed under
              GPL-3.0.
            </li>
            <li>
              <strong>Rules Core:</strong> Backed by <code>chess.js</code> (BSD-2-Clause)
              with KingChess FIDE draw/repetition extensions.
            </li>
          </ul>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            className="kc-btn kc-btn-primary kc-btn-sm"
            onClick={onClose}
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  );
}
