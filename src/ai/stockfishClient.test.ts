import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_POSITION } from '../engine/chessRules';
import {
  SearchCancelledError,
  StockfishClient,
  getStockfishWorkerUrl,
  parseBestMoveLine,
  parseInfoEvaluation,
  type WorkerLike,
} from './stockfishClient';

class MockStockfishWorker implements WorkerLike {
  public onmessage: ((event: MessageEvent<string>) => void) | null = null;
  public onerror: ((event: ErrorEvent) => void) | null = null;
  public commands: string[] = [];
  public terminated = false;
  public onCommand: ((cmd: string, worker: MockStockfishWorker) => void) | null = null;

  postMessage(message: unknown): void {
    const cmd = String(message);
    this.commands.push(cmd);
    if (this.onCommand) {
      this.onCommand(cmd, this);
      return;
    }
    if (cmd === 'uci') {
      queueMicrotask(() => this.emit('uciok'));
    } else if (cmd === 'isready') {
      queueMicrotask(() => this.emit('readyok'));
    }
  }

  emit(line: string): void {
    this.onmessage?.({ data: line } as MessageEvent<string>);
  }

  terminate(): void {
    this.terminated = true;
  }
}

describe('stockfishClient', () => {
  it('resolves worker URL under Pages base path and parses UCI output', () => {
    expect(getStockfishWorkerUrl()).toContain('engine/stockfish-19-lite-single.js');
    expect(parseBestMoveLine('bestmove e2e4 ponder e7e5')).toBe('e2e4');
    expect(parseBestMoveLine('bestmove (none)')).toBeNull();

    // Normalized to White perspective: Black seeing +120cp means -120cp for White
    expect(
      parseInfoEvaluation('info depth 10 score cp 120 pv e7e5 g1f3', 'b'),
    ).toEqual({
      type: 'cp',
      value: -120,
      depth: 10,
      bestMoveUci: 'e7e5',
    });
  });

  it('cancels active search via UCI stop and rejects stale bestmove tokens', async () => {
    const workers: MockStockfishWorker[] = [];
    const client = new StockfishClient({
      workerFactory: () => {
        const w = new MockStockfishWorker();
        w.onCommand = (cmd, self) => {
          if (cmd === 'uci') {
            queueMicrotask(() => self.emit('uciok'));
          } else if (cmd === 'isready') {
            queueMicrotask(() => self.emit('readyok'));
          } else if (cmd === 'stop') {
            // Drain stale search response when stopped
            queueMicrotask(() => self.emit('bestmove a2a3'));
          } else if (cmd.startsWith('go ') && self.commands.includes('position fen ' + DEFAULT_POSITION + ' moves e2e4')) {
            setTimeout(() => self.emit('bestmove e7e5'), 10);
          }
        };
        workers.push(w);
        return w;
      },
      stopTimeoutMs: 200,
    });

    const staleSearch = client.searchBestMove({
      sessionId: 1,
      positionToken: 1,
      initialFen: DEFAULT_POSITION,
      uciMoves: [],
      sideToMove: 'w',
      legalUciMoves: ['e2e4', 'd2d4'],
      difficulty: 'medium',
    });

    // Wait a tick so first search enters `go`, then cancel and launch search #2
    await new Promise((r) => setTimeout(r, 10));
    client.cancelActiveSearch(1, 2);

    await expect(staleSearch).rejects.toBeInstanceOf(SearchCancelledError);

    const freshResult = await client.searchBestMove({
      sessionId: 1,
      positionToken: 2,
      initialFen: DEFAULT_POSITION,
      uciMoves: ['e2e4'],
      sideToMove: 'b',
      legalUciMoves: ['e7e5', 'c7c5'],
      difficulty: 'hard',
    });

    expect(freshResult.usedFallback).toBe(false);
    expect(freshResult.uciMove).toBe('e7e5');
    expect(workers[0]?.commands).toContain('stop');
    client.dispose();
  });

  it('retries once on invalid/illegal engine bestmove and falls back cleanly to a legal move', async () => {
    const onEval = vi.fn();
    let workerCount = 0;

    const client = new StockfishClient({
      workerFactory: () => {
        workerCount += 1;
        const w = new MockStockfishWorker();
        w.onCommand = (cmd, self) => {
          if (cmd === 'uci') queueMicrotask(() => self.emit('uciok'));
          else if (cmd === 'isready') queueMicrotask(() => self.emit('readyok'));
          else if (cmd.startsWith('go ')) {
            queueMicrotask(() => {
              self.emit('info depth 4 score cp 35 pv e2e4');
              self.emit('bestmove e1e8'); // illegal move!
            });
          }
        };
        return w;
      },
    });

    const result = await client.searchBestMove({
      sessionId: 1,
      positionToken: 1,
      initialFen: DEFAULT_POSITION,
      uciMoves: [],
      sideToMove: 'w',
      legalUciMoves: ['e2e4', 'd2d4', 'g1f3'],
      difficulty: 'beginner',
      onEvaluation: onEval,
    });

    expect(workerCount).toBe(2); // Initial attempt + 1 retry
    expect(result.usedFallback).toBe(true);
    expect(['e2e4', 'd2d4', 'g1f3']).toContain(result.uciMove);
    expect(onEval).toHaveBeenCalled();
    client.dispose();
  });
});
