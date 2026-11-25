import { DIFFICULTY_PRESETS } from './difficulty';
import type { DifficultyId, PieceColor, PositionEvaluation } from '../types/chess';

export interface SearchRequest {
  sessionId: number;
  positionToken: number;
  initialFen: string;
  uciMoves: readonly string[];
  sideToMove: PieceColor;
  legalUciMoves: readonly string[];
  difficulty: DifficultyId;
  onEvaluation?: (evaluation: PositionEvaluation) => void;
}

export interface SearchResult {
  uciMove: string;
  evaluation: PositionEvaluation | null;
  usedFallback: boolean;
  fallbackReason?: string;
}

export interface WorkerLike {
  postMessage(message: unknown): void;
  terminate(): void;
  onmessage: ((event: MessageEvent<string>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
}

export interface StockfishClientOptions {
  workerFactory?: () => WorkerLike;
  initTimeoutMs?: number;
  stopTimeoutMs?: number;
  searchBufferMs?: number;
}

const DEFAULT_INIT_TIMEOUT_MS = 15_000;
const DEFAULT_STOP_TIMEOUT_MS = 500;
const DEFAULT_SEARCH_BUFFER_MS = 3_500;

export class SearchCancelledError extends Error {
  constructor(message = 'Stockfish search cancelled') {
    super(message);
    this.name = 'SearchCancelledError';
  }
}

export function getStockfishWorkerUrl(): string {
  const base = import.meta.env.BASE_URL ?? '/';
  const normalizedBase = base.endsWith('/') ? base : `${base}/`;
  return `${normalizedBase}engine/stockfish-19-lite-single.js`;
}

export function parseInfoEvaluation(
  line: string,
  sideToMove: PieceColor,
): PositionEvaluation | null {
  if (!line.startsWith('info ') || !line.includes(' score ')) {
    return null;
  }
  const depthMatch = /\bdepth\s+(\d+)/.exec(line);
  const cpMatch = /\bscore\s+cp\s+(-?\d+)/.exec(line);
  const mateMatch = /\bscore\s+mate\s+(-?\d+)/.exec(line);
  if (!cpMatch && !mateMatch) {
    return null;
  }
  const perspectiveSign = sideToMove === 'w' ? 1 : -1;
  const depth = depthMatch ? Number.parseInt(depthMatch[1] ?? '0', 10) : 0;
  const pvMatch = /\bpv\s+([a-h][1-8][a-h][1-8][qrbn]?)/.exec(line);

  if (mateMatch) {
    const rawMate = Number.parseInt(mateMatch[1] ?? '0', 10);
    return {
      type: 'mate',
      value: rawMate * perspectiveSign,
      depth,
      bestMoveUci: pvMatch?.[1],
    };
  }

  const rawCp = Number.parseInt(cpMatch?.[1] ?? '0', 10);
  return {
    type: 'cp',
    value: rawCp * perspectiveSign,
    depth,
    bestMoveUci: pvMatch?.[1],
  };
}

export function parseBestMoveLine(line: string): string | null {
  if (!line.startsWith('bestmove ')) {
    return null;
  }
  const parts = line.trim().split(/\s+/);
  const move = parts[1];
  if (!move || move === '(none)') {
    return null;
  }
  return move.toLowerCase();
}

export function selectDocumentedLegalFallback(legalUciMoves: readonly string[]): string {
  if (legalUciMoves.length === 0) {
    throw new Error('Cannot select fallback move when no legal moves exist');
  }
  // Prefer deterministic queen promotions or central development when possible
  const queenPromotion = legalUciMoves.find((m) => m.endsWith('q'));
  if (queenPromotion) {
    return queenPromotion;
  }
  const sorted = [...legalUciMoves].sort();
  return sorted[0]!;
}

interface PendingSearch {
  sessionId: number;
  positionToken: number;
  sideToMove: PieceColor;
  cancelled: boolean;
  latestEval: PositionEvaluation | null;
  onEvaluation?: (evaluation: PositionEvaluation) => void;
  resolve: (value: { bestMove: string | null; evaluation: PositionEvaluation | null }) => void;
  reject: (err: Error) => void;
  timeoutTimer: ReturnType<typeof setTimeout> | null;
  stopTimer: ReturnType<typeof setTimeout> | null;
}

export class StockfishClient {
  private readonly workerFactory: () => WorkerLike;
  private readonly initTimeoutMs: number;
  private readonly stopTimeoutMs: number;
  private readonly searchBufferMs: number;

  private worker: WorkerLike | null = null;
  private readyPromise: Promise<void> | null = null;
  private isReady = false;
  private isDisposed = false;

  private currentSearch: PendingSearch | null = null;
  private drainPromise: Promise<void> | null = null;
  private drainResolve: (() => void) | null = null;
  private initWaiters: Array<{
    expected: 'uciok' | 'readyok';
    resolve: () => void;
    reject: (err: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  }> = [];

  private latestSessionId = 0;
  private latestPositionToken = 0;
  private queue: Promise<void> = Promise.resolve();

  constructor(options: StockfishClientOptions = {}) {
    this.workerFactory =
      options.workerFactory ??
      (() => new Worker(getStockfishWorkerUrl(), { name: 'kingchess-stockfish' }));
    this.initTimeoutMs = options.initTimeoutMs ?? DEFAULT_INIT_TIMEOUT_MS;
    this.stopTimeoutMs = options.stopTimeoutMs ?? DEFAULT_STOP_TIMEOUT_MS;
    this.searchBufferMs = options.searchBufferMs ?? DEFAULT_SEARCH_BUFFER_MS;
  }

  private resetWorker(): void {
    if (this.worker) {
      this.worker.onmessage = null;
      this.worker.onerror = null;
      try {
        this.worker.terminate();
      } catch {
        // ignore termination error
      }
      this.worker = null;
    }
    this.isReady = false;
    this.readyPromise = null;
    for (const waiter of this.initWaiters) {
      clearTimeout(waiter.timer);
      waiter.reject(new Error('Stockfish worker reset'));
    }
    this.initWaiters = [];
  }

  private spawnWorker(): WorkerLike {
    const worker = this.workerFactory();
    worker.onmessage = (event: MessageEvent<string>) => {
      const text = typeof event.data === 'string' ? event.data : String(event.data ?? '');
      for (const rawLine of text.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (line) {
          this.handleEngineLine(line);
        }
      }
    };
    worker.onerror = () => {
      const error = new Error('Stockfish Web Worker encountered a runtime error');
      const active = this.currentSearch;
      this.currentSearch = null;
      if (active) {
        if (active.timeoutTimer) clearTimeout(active.timeoutTimer);
        if (active.stopTimer) clearTimeout(active.stopTimer);
        active.reject(active.cancelled ? new SearchCancelledError() : error);
      }
      if (this.drainResolve) {
        const resolve = this.drainResolve;
        this.drainResolve = null;
        this.drainPromise = null;
        resolve();
      }
      this.resetWorker();
    };
    this.worker = worker;
    return worker;
  }

  private handleEngineLine(line: string): void {
    // Resolve uciok / readyok waiters
    for (let i = 0; i < this.initWaiters.length; i++) {
      const waiter = this.initWaiters[i];
      if (waiter && line === waiter.expected) {
        this.initWaiters.splice(i, 1);
        clearTimeout(waiter.timer);
        waiter.resolve();
        return;
      }
    }

    const active = this.currentSearch;
    if (!active) {
      return;
    }

    if (line.startsWith('info ') && !active.cancelled) {
      const evalInfo = parseInfoEvaluation(line, active.sideToMove);
      if (evalInfo) {
        active.latestEval = evalInfo;
        active.onEvaluation?.(evalInfo);
      }
      return;
    }

    if (line.startsWith('bestmove ')) {
      if (active.timeoutTimer) clearTimeout(active.timeoutTimer);
      if (active.stopTimer) clearTimeout(active.stopTimer);
      this.currentSearch = null;

      if (this.drainResolve) {
        const resolveDrain = this.drainResolve;
        this.drainResolve = null;
        this.drainPromise = null;
        resolveDrain();
      }

      if (active.cancelled) {
        active.reject(new SearchCancelledError());
        return;
      }

      const bestMove = parseBestMoveLine(line);
      active.resolve({ bestMove, evaluation: active.latestEval });
    }
  }

  private waitForToken(expected: 'uciok' | 'readyok'): Promise<void> {
    if (!this.worker) {
      return Promise.reject(new Error('Stockfish worker not initialized'));
    }
    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.initWaiters = this.initWaiters.filter((w) => w.timer !== timer);
        reject(new Error(`Stockfish timed out waiting for ${expected}`));
      }, this.initTimeoutMs);
      this.initWaiters.push({ expected, resolve, reject, timer });
    });
  }

  async ensureReady(): Promise<void> {
    if (this.isDisposed) {
      throw new Error('StockfishClient has been disposed');
    }
    if (this.isReady && this.worker) {
      return;
    }
    if (this.readyPromise) {
      return this.readyPromise;
    }

    this.readyPromise = (async () => {
      const worker = this.worker ?? this.spawnWorker();
      const uciPromise = this.waitForToken('uciok');
      worker.postMessage('uci');
      await uciPromise;

      const readyPromise = this.waitForToken('readyok');
      worker.postMessage('isready');
      await readyPromise;

      this.isReady = true;
    })().catch((err: unknown) => {
      this.resetWorker();
      throw err instanceof Error ? err : new Error('Failed to initialize Stockfish');
    });

    return this.readyPromise;
  }

  /**
   * Cancels any in-flight search using UCI `stop` and rejects stale tokens cleanly.
   */
  cancelActiveSearch(nextSessionId?: number, nextPositionToken?: number): void {
    if (typeof nextSessionId === 'number') {
      this.latestSessionId = nextSessionId;
    }
    if (typeof nextPositionToken === 'number') {
      this.latestPositionToken = nextPositionToken;
    }

    const active = this.currentSearch;
    if (!active) {
      return;
    }
    if (!active.cancelled) {
      active.cancelled = true;
      if (active.timeoutTimer) {
        clearTimeout(active.timeoutTimer);
        active.timeoutTimer = null;
      }

      if (!this.drainPromise) {
        this.drainPromise = new Promise<void>((resolve) => {
          this.drainResolve = resolve;
        });
      }

      try {
        this.worker?.postMessage('stop');
      } catch {
        // ignore postMessage failures on terminated workers
      }

      active.stopTimer = setTimeout(() => {
        // Engine failed to respond to `stop` promptly -> reset worker to guarantee clean stream
        if (this.currentSearch === active) {
          this.currentSearch = null;
          active.reject(new SearchCancelledError('Stockfish stop handshake timed out'));
        }
        if (this.drainResolve) {
          const resolve = this.drainResolve;
          this.drainResolve = null;
          this.drainPromise = null;
          resolve();
        }
        this.resetWorker();
      }, this.stopTimeoutMs);
    }
  }

  private isTokenStale(sessionId: number, positionToken: number): boolean {
    return (
      this.isDisposed ||
      sessionId !== this.latestSessionId ||
      positionToken !== this.latestPositionToken
    );
  }

  private async runSingleSearchAttempt(
    request: SearchRequest,
  ): Promise<{ bestMove: string | null; evaluation: PositionEvaluation | null }> {
    if (this.drainPromise) {
      await this.drainPromise;
    }
    if (this.isTokenStale(request.sessionId, request.positionToken)) {
      throw new SearchCancelledError();
    }

    await this.ensureReady();
    if (this.isTokenStale(request.sessionId, request.positionToken) || !this.worker) {
      throw new SearchCancelledError();
    }

    // Barrier before sending new position/go to ensure prior UCI state is completely clear
    const readyBarrier = this.waitForToken('readyok');
    this.worker.postMessage('isready');
    await readyBarrier;
    if (this.isTokenStale(request.sessionId, request.positionToken) || !this.worker) {
      throw new SearchCancelledError();
    }

    const preset = DIFFICULTY_PRESETS[request.difficulty];

    return new Promise((resolve, reject) => {
      if (!this.worker) {
        reject(new Error('Stockfish worker unavailable'));
        return;
      }

      const pending: PendingSearch = {
        sessionId: request.sessionId,
        positionToken: request.positionToken,
        sideToMove: request.sideToMove,
        cancelled: false,
        latestEval: null,
        onEvaluation: request.onEvaluation,
        resolve,
        reject,
        timeoutTimer: null,
        stopTimer: null,
      };

      pending.timeoutTimer = setTimeout(() => {
        if (this.currentSearch === pending) {
          pending.cancelled = true;
          this.currentSearch = null;
          this.resetWorker();
          reject(new Error('Stockfish search timed out'));
        }
      }, preset.movetimeMs + this.searchBufferMs);

      this.currentSearch = pending;

      this.worker.postMessage(`setoption name Skill Level value ${preset.skillLevel}`);
      this.worker.postMessage('setoption name UCI_LimitStrength value false');

      const positionCmd =
        request.uciMoves.length > 0
          ? `position fen ${request.initialFen} moves ${request.uciMoves.join(' ')}`
          : `position fen ${request.initialFen}`;
      this.worker.postMessage(positionCmd);
      this.worker.postMessage(
        `go depth ${preset.depth} movetime ${preset.movetimeMs}`,
      );
    });
  }

  async searchBestMove(request: SearchRequest): Promise<SearchResult> {
    this.latestSessionId = request.sessionId;
    this.latestPositionToken = request.positionToken;
    this.cancelActiveSearch(request.sessionId, request.positionToken);

    const runTask = async (): Promise<SearchResult> => {
      if (this.isTokenStale(request.sessionId, request.positionToken)) {
        throw new SearchCancelledError();
      }

      let lastError: Error | null = null;
      for (let attempt = 0; attempt < 2; attempt++) {
        if (this.isTokenStale(request.sessionId, request.positionToken)) {
          throw new SearchCancelledError();
        }
        try {
          const result = await this.runSingleSearchAttempt(request);
          if (this.isTokenStale(request.sessionId, request.positionToken)) {
            throw new SearchCancelledError();
          }

          if (result.bestMove && request.legalUciMoves.includes(result.bestMove)) {
            return {
              uciMove: result.bestMove,
              evaluation: result.evaluation,
              usedFallback: false,
            };
          }
          lastError = new Error(
            `Stockfish returned illegal or empty move "${result.bestMove ?? ''}"`,
          );
          this.resetWorker();
        } catch (err) {
          if (err instanceof SearchCancelledError) {
            throw err;
          }
          lastError = err instanceof Error ? err : new Error('Unknown Stockfish error');
          this.resetWorker();
        }
      }

      if (this.isTokenStale(request.sessionId, request.positionToken)) {
        throw new SearchCancelledError();
      }

      // Documented legal fallback when engine fails or times out after retry
      return {
        uciMove: selectDocumentedLegalFallback(request.legalUciMoves),
        evaluation: null,
        usedFallback: true,
        fallbackReason: lastError?.message ?? 'Stockfish unavailable',
      };
    };

    const chained = this.queue.then(runTask, runTask);
    this.queue = chained.then(
      () => undefined,
      () => undefined,
    );
    return chained;
  }

  dispose(): void {
    this.isDisposed = true;
    this.cancelActiveSearch(this.latestSessionId + 1, this.latestPositionToken + 1);
    if (this.drainResolve) {
      const resolve = this.drainResolve;
      this.drainResolve = null;
      this.drainPromise = null;
      resolve();
    }
    this.resetWorker();
  }
}
