import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';
import type { Square } from 'chess.js';
import { Play } from 'lucide-react';
import { ChessPieceSvg } from '../../assets/pieces/ChessPieceSvg';
import {
  getBoardSquaresInDisplayOrder,
  isLightSquare,
  moveSquareByKey,
  squareToVisualGrid,
  visualGridToSquare,
} from '../../engine/coordinates';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { useGameStore } from '../../stores/gameStore';
import { useSettingsStore } from '../../stores/settingsStore';
import type { BoardPiece, PieceColor, PieceType } from '../../types/chess';
import { BoardSquare } from './BoardSquare';

interface DragSession {
  pointerId: number;
  from: Square;
  pieceType: PieceType;
  pieceColor: PieceColor;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  active: boolean;
  overSquare: Square | null;
  pieceSizePx: number;
}

export function ChessBoard() {
  const phase = useGameStore((s) => s.phase);
  const mode = useGameStore((s) => s.mode);
  const humanColor = useGameStore((s) => s.humanColor);
  const flipped = useGameStore((s) => s.flipped);
  const isPaused = useGameStore((s) => s.clock.isPaused);
  const result = useGameStore((s) => s.result);
  const moves = useGameStore((s) => s.moves);
  const viewPly = useGameStore((s) => s.viewPly);
  const lastMoveWasDrag = useGameStore((s) => s.lastMoveWasDrag);
  const reviewSnapshot = useGameStore((s) => s.reviewSnapshot);
  const selectedSquare = useGameStore((s) => s.selectedSquare);
  const legalTargets = useGameStore((s) => s.legalTargetsForSelected);
  const captureTargets = useGameStore((s) => s.captureTargetsForSelected);
  const hintMove = useGameStore((s) => s.hintMove);

  const selectSquare = useGameStore((s) => s.selectSquare);
  const attemptMove = useGameStore((s) => s.attemptMove);
  const cancelPromotion = useGameStore((s) => s.cancelPromotion);
  const togglePause = useGameStore((s) => s.togglePause);

  const pieceTheme = useSettingsStore((s) => s.pieceTheme);
  const showCoordinates = useSettingsStore((s) => s.showCoordinates);
  const reducedMotion = useReducedMotion();

  const gridRef = useRef<HTMLDivElement | null>(null);
  const squareButtonRefs = useRef<Partial<Record<Square, HTMLButtonElement | null>>>({});
  const dragRef = useRef<DragSession | null>(null);
  const suppressNextClickRef = useRef(false);

  const [dragState, setDragState] = useState<DragSession | null>(null);
  const [focusedSquare, setFocusedSquare] = useState<Square>('e2');

  const isInteractive = phase === 'PLAYER_TURN' && !isPaused && result === null;
  const orderedSquares = useMemo(
    () => getBoardSquaresInDisplayOrder(flipped),
    [flipped],
  );

  const pieceBySquare = useMemo(() => {
    const map = new Map<Square, BoardPiece>();
    for (const p of reviewSnapshot.pieces) {
      map.set(p.square, p);
    }
    return map;
  }, [reviewSnapshot.pieces]);

  const lastMove = viewPly > 0 ? (moves[viewPly - 1] ?? null) : null;
  const legalTargetSet = useMemo(() => new Set(legalTargets), [legalTargets]);
  const captureTargetSet = useMemo(() => new Set(captureTargets), [captureTargets]);

  const slideAnim = useMemo(() => {
    if (reducedMotion || lastMoveWasDrag || !lastMove || viewPly !== moves.length) {
      return null;
    }
    const fromGrid = squareToVisualGrid(lastMove.from, flipped);
    const toGrid = squareToVisualGrid(lastMove.to, flipped);
    return {
      square: lastMove.to,
      xPct: (fromGrid.col - toGrid.col) * 100,
      yPct: (fromGrid.row - toGrid.row) * 100,
      key: viewPly,
    };
  }, [reducedMotion, lastMoveWasDrag, lastMove, viewPly, moves.length, flipped]);

  const resolveSquareFromPoint = useCallback(
    (clientX: number, clientY: number): Square | null => {
      const grid = gridRef.current;
      if (!grid) return null;
      const rect = grid.getBoundingClientRect();
      if (
        clientX < rect.left ||
        clientX > rect.right ||
        clientY < rect.top ||
        clientY > rect.bottom ||
        rect.width <= 0 ||
        rect.height <= 0
      ) {
        return null;
      }
      const col = Math.min(7, Math.max(0, Math.floor(((clientX - rect.left) / rect.width) * 8)));
      const row = Math.min(7, Math.max(0, Math.floor(((clientY - rect.top) / rect.height) * 8)));
      return visualGridToSquare(row, col, flipped);
    },
    [flipped],
  );

  // Global pointer listeners while dragging
  useEffect(() => {
    const handlePointerMove = (e: globalThis.PointerEvent) => {
      const current = dragRef.current;
      if (!current || e.pointerId !== current.pointerId) return;

      const dx = e.clientX - current.startX;
      const dy = e.clientY - current.startY;
      const movedEnough = current.active || Math.hypot(dx, dy) >= 6;
      const overSquare = movedEnough ? resolveSquareFromPoint(e.clientX, e.clientY) : null;

      if (movedEnough && !current.active) {
        // Select dragged piece so legal destinations illuminate
        if (useGameStore.getState().selectedSquare !== current.from) {
          selectSquare(current.from);
        }
      }

      const next: DragSession = {
        ...current,
        currentX: e.clientX,
        currentY: e.clientY,
        active: movedEnough,
        overSquare,
      };
      dragRef.current = next;
      if (movedEnough) {
        setDragState(next);
      }
    };

    const finishDrag = (e: globalThis.PointerEvent, cancelled: boolean) => {
      const current = dragRef.current;
      if (!current || e.pointerId !== current.pointerId) return;

      dragRef.current = null;
      setDragState(null);

      if (cancelled || !current.active) {
        return;
      }

      suppressNextClickRef.current = true;
      window.setTimeout(() => {
        suppressNextClickRef.current = false;
      }, 0);

      const dropSquare = resolveSquareFromPoint(e.clientX, e.clientY);
      if (dropSquare && dropSquare !== current.from) {
        const outcome = attemptMove(current.from, dropSquare, undefined, undefined, {
          fromDrag: true,
        });
        if (outcome === 'moved') {
          setFocusedSquare(dropSquare);
        }
      }
    };

    const handlePointerUp = (e: globalThis.PointerEvent) => finishDrag(e, false);
    const handlePointerCancel = (e: globalThis.PointerEvent) => finishDrag(e, true);

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerCancel);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerCancel);
    };
  }, [attemptMove, resolveSquareFromPoint, selectSquare]);

  // Clear drag session if board locks
  useEffect(() => {
    if (!isInteractive && dragRef.current) {
      dragRef.current = null;
      setDragState(null);
    }
  }, [isInteractive]);

  const registerButtonRef = useCallback(
    (square: Square, el: HTMLButtonElement | null) => {
      squareButtonRefs.current[square] = el;
    },
    [],
  );

  const handleSquareClick = useCallback(
    (square: Square) => {
      if (suppressNextClickRef.current) {
        suppressNextClickRef.current = false;
        return;
      }
      setFocusedSquare(square);
      selectSquare(square);
    },
    [selectSquare],
  );

  const handleSquarePointerDown = useCallback(
    (square: Square, e: PointerEvent<HTMLButtonElement>) => {
      if (!isInteractive) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;

      const piece = pieceBySquare.get(square);
      if (!piece) return;
      if (piece.color !== reviewSnapshot.turn) return;
      if (mode === 'ai' && piece.color !== humanColor) return;

      const gridRect = gridRef.current?.getBoundingClientRect();
      const pieceSizePx = gridRect ? (gridRect.width / 8) * 0.88 : 56;

      const session: DragSession = {
        pointerId: e.pointerId,
        from: square,
        pieceType: piece.type,
        pieceColor: piece.color,
        startX: e.clientX,
        startY: e.clientY,
        currentX: e.clientX,
        currentY: e.clientY,
        active: false,
        overSquare: square,
        pieceSizePx,
      };
      dragRef.current = session;
    },
    [isInteractive, pieceBySquare, reviewSnapshot.turn, mode, humanColor],
  );

  const handleSquareKeyDown = useCallback(
    (square: Square, e: KeyboardEvent<HTMLButtonElement>) => {
      if (e.key === 'Escape') {
        if (phase === 'PROMOTION_PENDING') {
          cancelPromotion();
        } else if (selectedSquare) {
          selectSquare(selectedSquare);
        }
        return;
      }

      const nextSquare = moveSquareByKey(square, e.key, flipped);
      if (nextSquare) {
        e.preventDefault();
        setFocusedSquare(nextSquare);
        squareButtonRefs.current[nextSquare]?.focus();
      }
    },
    [flipped, phase, cancelPromotion, selectedSquare, selectSquare],
  );

  return (
    <div className="kc-board-frame" data-testid="chess-board-frame">
      <div
        ref={gridRef}
        className="kc-board-grid"
        role="grid"
        aria-label="Chessboard"
        data-testid="chess-board"
      >
        {orderedSquares.map((square, index) => {
          const row = Math.floor(index / 8);
          const col = index % 8;
          const piece = pieceBySquare.get(square);
          const isSelected = isInteractive && selectedSquare === square;
          const isLegalTarget = isInteractive && legalTargetSet.has(square);
          const isCaptureTarget = isInteractive && captureTargetSet.has(square);
          const isLastMove =
            lastMove !== null && (lastMove.from === square || lastMove.to === square);
          const isInCheck =
            reviewSnapshot.inCheck && reviewSnapshot.checkedKingSquare === square;
          const isHintSquare =
            isInteractive &&
            hintMove !== null &&
            (hintMove.from === square || hintMove.to === square);

          const isDragSource =
            dragState?.active === true && dragState.from === square;
          const isDragOver =
            dragState?.active === true &&
            dragState.overSquare === square &&
            legalTargetSet.has(square);

          const rankLabel = showCoordinates && col === 0 ? square[1] ?? null : null;
          const fileLabel = showCoordinates && row === 7 ? square[0] ?? null : null;

          return (
            <BoardSquare
              key={square}
              square={square}
              isLight={isLightSquare(square)}
              pieceType={piece?.type ?? null}
              pieceColor={piece?.color ?? null}
              pieceTheme={pieceTheme}
              rankLabel={rankLabel}
              fileLabel={fileLabel}
              isSelected={isSelected}
              isLegalTarget={isLegalTarget}
              isCaptureTarget={isCaptureTarget}
              isLastMove={isLastMove}
              isInCheck={isInCheck}
              isHintSquare={isHintSquare}
              isDragSource={isDragSource}
              isDragOver={isDragOver}
              slideDelta={
                slideAnim && slideAnim.square === square
                  ? {
                      xPct: slideAnim.xPct,
                      yPct: slideAnim.yPct,
                      key: slideAnim.key,
                    }
                  : null
              }
              tabIndex={focusedSquare === square ? 0 : -1}
              interactive={isInteractive}
              onSquareClick={handleSquareClick}
              onSquarePointerDown={handleSquarePointerDown}
              onSquareKeyDown={handleSquareKeyDown}
              registerButtonRef={registerButtonRef}
            />
          );
        })}
      </div>

      {dragState?.active && (
        <div
          className="kc-drag-ghost"
          style={{
            left: dragState.currentX,
            top: dragState.currentY,
            width: dragState.pieceSizePx,
            height: dragState.pieceSizePx,
          }}
          aria-hidden="true"
        >
          <ChessPieceSvg
            type={dragState.pieceType}
            color={dragState.pieceColor}
            theme={pieceTheme}
          />
        </div>
      )}

      {isPaused && result === null && (
        <div className="kc-board-pause-veil" data-testid="board-pause-veil">
          <div
            style={{
              fontFamily: 'var(--kc-font-display)',
              fontSize: '1.35rem',
              color: 'var(--kc-gold-bright)',
            }}
          >
            Match Paused
          </div>
          <p style={{ margin: 0, color: 'var(--kc-ivory-muted)', fontSize: '0.9rem' }}>
            Clocks are paused and the position is veiled until you resume.
          </p>
          <button
            type="button"
            className="kc-btn kc-btn-primary"
            onClick={() => togglePause()}
            data-testid="resume-from-veil-btn"
          >
            <Play size={16} aria-hidden="true" />
            <span>Resume Match</span>
          </button>
        </div>
      )}
    </div>
  );
}
