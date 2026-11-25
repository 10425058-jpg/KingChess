import { memo, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react';
import type { Square } from 'chess.js';
import { ChessPieceSvg } from '../../assets/pieces/ChessPieceSvg';
import type { PieceColor, PieceThemeId, PieceType } from '../../types/chess';

export interface BoardSquareProps {
  square: Square;
  isLight: boolean;
  pieceType: PieceType | null;
  pieceColor: PieceColor | null;
  pieceTheme: PieceThemeId;
  rankLabel: string | null;
  fileLabel: string | null;
  isSelected: boolean;
  isLegalTarget: boolean;
  isCaptureTarget: boolean;
  isLastMove: boolean;
  isInCheck: boolean;
  isHintSquare: boolean;
  isDragSource: boolean;
  isDragOver: boolean;
  slideDelta: { xPct: number; yPct: number; key: number } | null;
  tabIndex: number;
  interactive: boolean;
  onSquareClick: (square: Square) => void;
  onSquarePointerDown: (square: Square, e: PointerEvent<HTMLButtonElement>) => void;
  onSquareKeyDown: (square: Square, e: KeyboardEvent<HTMLButtonElement>) => void;
  registerButtonRef: (square: Square, el: HTMLButtonElement | null) => void;
}

const PIECE_WORDS: Record<PieceType, string> = {
  k: 'King',
  q: 'Queen',
  r: 'Rook',
  b: 'Bishop',
  n: 'Knight',
  p: 'Pawn',
};

function buildAriaLabel(
  square: Square,
  pieceColor: PieceColor | null,
  pieceType: PieceType | null,
  isLegalTarget: boolean,
  isCaptureTarget: boolean,
  isInCheck: boolean,
  isSelected: boolean,
): string {
  const parts: string[] = [square];
  if (pieceColor && pieceType) {
    parts.push(`${pieceColor === 'w' ? 'White' : 'Black'} ${PIECE_WORDS[pieceType]}`);
  } else {
    parts.push('empty');
  }
  if (isSelected) parts.push('selected');
  if (isInCheck) parts.push('in check');
  if (isCaptureTarget) parts.push('legal capture target');
  else if (isLegalTarget) parts.push('legal move target');
  return parts.join(', ');
}

export const BoardSquare = memo(function BoardSquare({
  square,
  isLight,
  pieceType,
  pieceColor,
  pieceTheme,
  rankLabel,
  fileLabel,
  isSelected,
  isLegalTarget,
  isCaptureTarget,
  isLastMove,
  isInCheck,
  isHintSquare,
  isDragSource,
  isDragOver,
  slideDelta,
  tabIndex,
  onSquareClick,
  onSquarePointerDown,
  onSquareKeyDown,
  registerButtonRef,
}: BoardSquareProps) {
  const classNames = [
    'kc-square',
    isLight ? 'is-light' : '',
    isLastMove ? 'is-last-move' : '',
    isSelected ? 'is-selected' : '',
    isInCheck ? 'is-in-check' : '',
    isHintSquare ? 'is-hint' : '',
    isDragOver ? 'is-drag-over' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const pieceWrapClasses = [
    'kc-piece-wrap',
    isSelected ? 'is-selected' : '',
    slideDelta ? 'is-sliding' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const slideStyle: CSSProperties | undefined = slideDelta
    ? ({
        '--kc-slide-x': `${slideDelta.xPct}%`,
        '--kc-slide-y': `${slideDelta.yPct}%`,
      } as CSSProperties)
    : undefined;

  return (
    <button
      ref={(el) => registerButtonRef(square, el)}
      type="button"
      className={classNames}
      tabIndex={tabIndex}
      data-square={square}
      data-testid={`square-${square}`}
      aria-label={buildAriaLabel(
        square,
        pieceColor,
        pieceType,
        isLegalTarget,
        isCaptureTarget,
        isInCheck,
        isSelected,
      )}
      onClick={() => onSquareClick(square)}
      onPointerDown={(e) => onSquarePointerDown(square, e)}
      onKeyDown={(e) => onSquareKeyDown(square, e)}
    >
      {rankLabel && (
        <span className="kc-coord-rank" aria-hidden="true">
          {rankLabel}
        </span>
      )}
      {fileLabel && (
        <span className="kc-coord-file" aria-hidden="true">
          {fileLabel}
        </span>
      )}

      {isInCheck && (
        <span className="kc-check-badge" aria-hidden="true">
          !
        </span>
      )}

      {isLegalTarget && !isCaptureTarget && (
        <span className="kc-legal-dot" aria-hidden="true" />
      )}
      {isCaptureTarget && <span className="kc-capture-ring" aria-hidden="true" />}

      {pieceType && pieceColor && !isDragSource && (
        <span
          key={slideDelta ? `slide-${slideDelta.key}` : 'static'}
          className={pieceWrapClasses}
          style={slideStyle}
        >
          <ChessPieceSvg type={pieceType} color={pieceColor} theme={pieceTheme} />
        </span>
      )}
    </button>
  );
});
