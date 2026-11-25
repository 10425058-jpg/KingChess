import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Copy,
  Download,
} from 'lucide-react';
import { TIME_CONTROLS } from '../../clock/clockController';
import { formatPgnExport } from '../../engine/chessRules';
import { useGameStore } from '../../stores/gameStore';
import type { MoveRecord } from '../../types/chess';

interface MoveRow {
  moveNumber: number;
  white?: MoveRecord;
  black?: MoveRecord;
}

export function MoveHistoryPanel() {
  const initialFen = useGameStore((s) => s.initialFen);
  const moves = useGameStore((s) => s.moves);
  const viewPly = useGameStore((s) => s.viewPly);
  const reviewSnapshot = useGameStore((s) => s.reviewSnapshot);
  const result = useGameStore((s) => s.result);
  const mode = useGameStore((s) => s.mode);
  const humanColor = useGameStore((s) => s.humanColor);
  const difficulty = useGameStore((s) => s.difficulty);
  const timeControlId = useGameStore((s) => s.timeControlId);

  const reviewGoToPly = useGameStore((s) => s.reviewGoToPly);
  const reviewFirst = useGameStore((s) => s.reviewFirst);
  const reviewPrev = useGameStore((s) => s.reviewPrev);
  const reviewNext = useGameStore((s) => s.reviewNext);
  const reviewLast = useGameStore((s) => s.reviewLast);

  const [copiedType, setCopiedType] = useState<'fen' | 'pgn' | null>(null);
  const activeMoveBtnRef = useRef<HTMLButtonElement | null>(null);

  const rows = useMemo<MoveRow[]>(() => {
    const grouped: MoveRow[] = [];
    for (const move of moves) {
      if (move.color === 'w') {
        grouped.push({ moveNumber: move.moveNumber, white: move });
      } else {
        const last = grouped[grouped.length - 1];
        if (last && last.moveNumber === move.moveNumber && !last.black) {
          last.black = move;
        } else {
          grouped.push({ moveNumber: move.moveNumber, black: move });
        }
      }
    }
    return grouped;
  }, [moves]);

  useEffect(() => {
    const el = activeMoveBtnRef.current;
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ block: 'nearest' });
    }
  }, [viewPly]);

  const showFeedback = (kind: 'fen' | 'pgn') => {
    setCopiedType(kind);
    window.setTimeout(() => {
      setCopiedType((current) => (current === kind ? null : current));
    }, 1800);
  };

  const handleCopyFen = async () => {
    try {
      await navigator.clipboard?.writeText(reviewSnapshot.fen);
      showFeedback('fen');
    } catch {
      // ignore clipboard errors gracefully
    }
  };

  const handleExportPgn = async () => {
    const whiteName =
      mode === 'ai'
        ? humanColor === 'w'
          ? 'Player'
          : `Stockfish (${difficulty})`
        : 'White Player';
    const blackName =
      mode === 'ai'
        ? humanColor === 'b'
          ? 'Player'
          : `Stockfish (${difficulty})`
        : 'Black Player';

    const pgn = formatPgnExport(
      initialFen,
      moves,
      {
        Event: 'KingChess Match',
        White: whiteName,
        Black: blackName,
        TimeControl: TIME_CONTROLS[timeControlId].shortLabel,
      },
      result,
    );

    try {
      await navigator.clipboard?.writeText(pgn);
    } catch {
      // clipboard optional
    }

    try {
      const blob = new Blob([pgn], { type: 'application/x-chess-pgn;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `kingchess-${new Date().toISOString().slice(0, 10)}.pgn`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    } catch {
      // download best-effort in restricted environments
    }

    showFeedback('pgn');
  };

  return (
    <section className="kc-history-panel" aria-label="Move history and review">
      <div className="kc-history-header">
        <span className="kc-history-title">Move History</span>
        <span style={{ fontSize: '0.78rem', color: 'var(--kc-text-muted)' }}>
          {viewPly} / {moves.length} ply
        </span>
      </div>

      <div className="kc-history-list" data-testid="move-history-list">
        {rows.length === 0 ? (
          <div className="kc-history-empty">No moves played yet</div>
        ) : (
          rows.map((row) => (
            <div key={row.moveNumber} className="kc-move-row">
              <span className="kc-move-num">{row.moveNumber}.</span>
              {row.white ? (
                <button
                  ref={viewPly === row.white.ply ? activeMoveBtnRef : undefined}
                  type="button"
                  className={`kc-move-btn ${viewPly === row.white.ply ? 'is-active' : ''}`}
                  onClick={() => reviewGoToPly(row.white!.ply)}
                  data-testid={`ply-${row.white.ply}`}
                >
                  {row.white.san}
                </button>
              ) : (
                <span className="kc-move-btn" style={{ opacity: 0.45 }}>
                  …
                </span>
              )}

              {row.black ? (
                <button
                  ref={viewPly === row.black.ply ? activeMoveBtnRef : undefined}
                  type="button"
                  className={`kc-move-btn ${viewPly === row.black.ply ? 'is-active' : ''}`}
                  onClick={() => reviewGoToPly(row.black!.ply)}
                  data-testid={`ply-${row.black.ply}`}
                >
                  {row.black.san}
                </button>
              ) : (
                <span />
              )}
            </div>
          ))
        )}
      </div>

      <div className="kc-review-nav" role="group" aria-label="Move navigation">
        <button
          type="button"
          className="kc-btn kc-btn-sm"
          onClick={reviewFirst}
          disabled={viewPly === 0}
          aria-label="First move"
          data-testid="review-first-btn"
        >
          <ChevronsLeft size={16} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="kc-btn kc-btn-sm"
          onClick={reviewPrev}
          disabled={viewPly === 0}
          aria-label="Previous move"
          data-testid="review-prev-btn"
        >
          <ChevronLeft size={16} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="kc-btn kc-btn-sm"
          onClick={reviewNext}
          disabled={viewPly >= moves.length}
          aria-label="Next move"
          data-testid="review-next-btn"
        >
          <ChevronRight size={16} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="kc-btn kc-btn-sm"
          onClick={reviewLast}
          disabled={viewPly >= moves.length}
          aria-label="Latest move"
          data-testid="review-last-btn"
        >
          <ChevronsRight size={16} aria-hidden="true" />
        </button>
      </div>

      <div className="kc-export-row">
        <button
          type="button"
          className="kc-btn kc-btn-sm"
          onClick={() => void handleCopyFen()}
          data-testid="copy-fen-btn"
        >
          {copiedType === 'fen' ? <Check size={14} /> : <Copy size={14} />}
          <span>{copiedType === 'fen' ? 'Copied FEN' : 'Copy FEN'}</span>
        </button>
        <button
          type="button"
          className="kc-btn kc-btn-sm"
          onClick={() => void handleExportPgn()}
          data-testid="export-pgn-btn"
        >
          {copiedType === 'pgn' ? <Check size={14} /> : <Download size={14} />}
          <span>{copiedType === 'pgn' ? 'Exported PGN' : 'Export PGN'}</span>
        </button>
      </div>
    </section>
  );
}
