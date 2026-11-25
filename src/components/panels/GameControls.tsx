import { useState } from 'react';
import {
  Flag,
  Handshake,
  Lightbulb,
  Pause,
  Play,
  RefreshCw,
  Repeat,
  RotateCcw,
} from 'lucide-react';
import { canUndoInState, useGameStore } from '../../stores/gameStore';
import { useSettingsStore } from '../../stores/settingsStore';

interface GameControlsProps {
  onRequestHint: () => void;
}

export function GameControls({ onRequestHint }: GameControlsProps) {
  const view = useGameStore((s) => s.view);
  const phase = useGameStore((s) => s.phase);
  const mode = useGameStore((s) => s.mode);
  const humanColor = useGameStore((s) => s.humanColor);
  const moves = useGameStore((s) => s.moves);
  const liveSnapshot = useGameStore((s) => s.liveSnapshot);
  const isPaused = useGameStore((s) => s.clock.isPaused);
  const result = useGameStore((s) => s.result);
  const drawOfferFrom = useGameStore((s) => s.drawOfferFrom);
  const isHintPending = useGameStore((s) => s.isHintPending);

  const undoMove = useGameStore((s) => s.undoMove);
  const flipBoard = useGameStore((s) => s.flipBoard);
  const togglePause = useGameStore((s) => s.togglePause);
  const claimDraw = useGameStore((s) => s.claimDraw);
  const offerDraw = useGameStore((s) => s.offerDraw);
  const acceptDraw = useGameStore((s) => s.acceptDraw);
  const declineDraw = useGameStore((s) => s.declineDraw);
  const resign = useGameStore((s) => s.resign);
  const rematch = useGameStore((s) => s.rematch);

  const allowHints = useSettingsStore((s) => s.allowHints);
  const [confirmingResign, setConfirmingResign] = useState(false);

  const canUndo = canUndoInState({ view, mode, humanColor, moves, result });
  const isLiveGame = result === null;
  const claimableThreefold =
    isLiveGame &&
    !isPaused &&
    phase === 'PLAYER_TURN' &&
    liveSnapshot.claimableDraws.includes('threefold');
  const claimableFifty =
    isLiveGame &&
    !isPaused &&
    phase === 'PLAYER_TURN' &&
    liveSnapshot.claimableDraws.includes('fifty-move');

  const canHint =
    allowHints && isLiveGame && !isPaused && phase === 'PLAYER_TURN' && !isHintPending;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {(claimableThreefold || claimableFifty) && (
        <div
          className="kc-status-banner is-claimable"
          role="status"
          data-testid="claimable-draw-banner"
        >
          <span>
            {claimableThreefold
              ? 'Threefold repetition reached'
              : '50-move threshold reached'}
          </span>
          <button
            type="button"
            className="kc-btn kc-btn-primary kc-btn-sm"
            onClick={() => claimDraw(claimableThreefold ? 'threefold' : 'fifty-move')}
            data-testid="claim-draw-btn"
          >
            Claim Draw
          </button>
        </div>
      )}

      {drawOfferFrom && isLiveGame && (
        <div className="kc-draw-offer-box" role="alert" data-testid="draw-offer-banner">
          <span>
            {drawOfferFrom === 'w' ? 'White' : 'Black'} offers a draw. Does{' '}
            {drawOfferFrom === 'w' ? 'Black' : 'White'} agree?
          </span>
          <div className="kc-draw-offer-actions">
            <button
              type="button"
              className="kc-btn kc-btn-primary kc-btn-sm"
              onClick={() => acceptDraw()}
              data-testid="accept-draw-btn"
            >
              Accept Draw
            </button>
            <button
              type="button"
              className="kc-btn kc-btn-sm"
              onClick={declineDraw}
              data-testid="decline-draw-btn"
            >
              Decline
            </button>
          </div>
        </div>
      )}

      <div className="kc-controls-grid">
        <button
          type="button"
          className="kc-btn kc-btn-sm"
          onClick={() => undoMove()}
          disabled={!canUndo}
          data-testid="undo-btn"
        >
          <RotateCcw size={15} aria-hidden="true" />
          <span>Undo</span>
        </button>

        <button
          type="button"
          className="kc-btn kc-btn-sm"
          onClick={flipBoard}
          data-testid="flip-btn"
        >
          <Repeat size={15} aria-hidden="true" />
          <span>Flip Board</span>
        </button>

        <button
          type="button"
          className="kc-btn kc-btn-sm"
          onClick={() => togglePause()}
          disabled={!isLiveGame}
          data-testid="pause-btn"
        >
          {isPaused ? <Play size={15} aria-hidden="true" /> : <Pause size={15} aria-hidden="true" />}
          <span>{isPaused ? 'Resume' : 'Pause'}</span>
        </button>

        {allowHints ? (
          <button
            type="button"
            className="kc-btn kc-btn-sm"
            onClick={onRequestHint}
            disabled={!canHint}
            data-testid="hint-btn"
          >
            <Lightbulb size={15} aria-hidden="true" />
            <span>{isHintPending ? 'Thinking…' : 'Hint'}</span>
          </button>
        ) : (
          <button
            type="button"
            className="kc-btn kc-btn-sm"
            onClick={() => rematch()}
            data-testid="rematch-btn"
          >
            <RefreshCw size={15} aria-hidden="true" />
            <span>{isLiveGame ? 'Restart' : 'Rematch'}</span>
          </button>
        )}

        {mode === 'local' && (
          <button
            type="button"
            className="kc-btn kc-btn-sm"
            onClick={offerDraw}
            disabled={!isLiveGame || isPaused || phase !== 'PLAYER_TURN' || drawOfferFrom !== null}
            data-testid="offer-draw-btn"
          >
            <Handshake size={15} aria-hidden="true" />
            <span>Offer Draw</span>
          </button>
        )}

        {!confirmingResign ? (
          <button
            type="button"
            className="kc-btn kc-btn-danger kc-btn-sm"
            onClick={() => setConfirmingResign(true)}
            disabled={!isLiveGame}
            data-testid="resign-btn"
          >
            <Flag size={15} aria-hidden="true" />
            <span>Resign</span>
          </button>
        ) : (
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              type="button"
              className="kc-btn kc-btn-danger kc-btn-sm"
              style={{ flex: 1 }}
              onClick={() => {
                setConfirmingResign(false);
                resign();
              }}
              data-testid="confirm-resign-btn"
            >
              Confirm
            </button>
            <button
              type="button"
              className="kc-btn kc-btn-sm"
              onClick={() => setConfirmingResign(false)}
              data-testid="cancel-resign-btn"
            >
              No
            </button>
          </div>
        )}

        {allowHints && (
          <button
            type="button"
            className="kc-btn kc-btn-gold-outline kc-btn-sm"
            style={{ gridColumn: mode === 'local' ? 'span 2' : 'span 1' }}
            onClick={() => rematch()}
            data-testid="rematch-btn"
          >
            <RefreshCw size={15} aria-hidden="true" />
            <span>{isLiveGame ? 'Restart' : 'Rematch'}</span>
          </button>
        )}
      </div>
    </div>
  );
}
