import { useMemo } from 'react';
import { Cpu, Crown, User } from 'lucide-react';
import { DIFFICULTY_PRESETS } from '../../ai/difficulty';
import { ChessPieceSvg } from '../../assets/pieces/ChessPieceSvg';
import { computeCapturedSummary } from '../../engine/chessRules';
import { useGameStore } from '../../stores/gameStore';
import { useSettingsStore } from '../../stores/settingsStore';
import type { PieceColor } from '../../types/chess';
import { ChessClock } from './ChessClock';

interface PlayerCardProps {
  color: PieceColor;
  position: 'top' | 'bottom';
}

export function PlayerCard({ color, position }: PlayerCardProps) {
  const mode = useGameStore((s) => s.mode);
  const humanColor = useGameStore((s) => s.humanColor);
  const difficulty = useGameStore((s) => s.difficulty);
  const phase = useGameStore((s) => s.phase);
  const result = useGameStore((s) => s.result);
  const reviewSnapshot = useGameStore((s) => s.reviewSnapshot);
  const moves = useGameStore((s) => s.moves);
  const viewPly = useGameStore((s) => s.viewPly);
  const pieceTheme = useSettingsStore((s) => s.pieceTheme);

  const visibleMoves = useMemo(() => moves.slice(0, viewPly), [moves, viewPly]);
  const capturedSummary = useMemo(
    () => computeCapturedSummary(reviewSnapshot.pieces, visibleMoves),
    [reviewSnapshot.pieces, visibleMoves],
  );

  const isAiSide = mode === 'ai' && color !== humanColor;
  const displayName = isAiSide
    ? `Stockfish (${DIFFICULTY_PRESETS[difficulty].label})`
    : mode === 'ai'
      ? `You (${color === 'w' ? 'White' : 'Black'})`
      : color === 'w'
        ? 'White Player'
        : 'Black Player';

  const isActiveTurn = result === null && reviewSnapshot.turn === color;
  const capturedList =
    color === 'w' ? capturedSummary.capturedByWhite : capturedSummary.capturedByBlack;
  const capturedColor: PieceColor = color === 'w' ? 'b' : 'w';
  const adv =
    color === 'w'
      ? capturedSummary.materialAdvantageWhite
      : -capturedSummary.materialAdvantageWhite;

  return (
    <div
      className={`kc-player-card ${isActiveTurn ? 'is-active' : ''}`}
      data-testid={`player-card-${position}`}
      data-color={color}
    >
      <div className="kc-player-identity">
        <div
          className={`kc-player-badge ${color === 'w' ? 'is-white' : 'is-black'}`}
          aria-hidden="true"
        >
          {isAiSide ? <Cpu size={15} /> : color === 'w' ? <Crown size={15} /> : <User size={15} />}
        </div>

        <div className="kc-player-meta">
          <div className="kc-player-name-row">
            <span className="kc-player-name">{displayName}</span>
            {isActiveTurn && (
              <span className="kc-turn-tag">
                {isAiSide && phase === 'AI_THINKING' ? 'Thinking…' : 'Turn'}
              </span>
            )}
          </div>

          <div
            className="kc-captured-strip"
            aria-label={`Captured pieces for ${displayName}`}
          >
            {capturedList.map((pieceType, idx) => (
              <span key={`${pieceType}-${idx}`} className="kc-captured-piece">
                <ChessPieceSvg
                  type={pieceType}
                  color={capturedColor}
                  theme={pieceTheme}
                />
              </span>
            ))}
            {adv > 0 && <span className="kc-material-diff">+{adv}</span>}
          </div>
        </div>
      </div>

      <ChessClock color={color} />
    </div>
  );
}
