# KingChess

A 2D browser-based chess arena built with React, TypeScript (strict mode), Vite, Zustand, `chess.js`, and Stockfish 19 running inside a dedicated Web Worker.

> **Status:** V1 delivers Local Two Players and Play vs Computer (client-side Stockfish 19 Lite WASM). Online multiplayer is intentionally omitted rather than stubbed.

---

## Features

- **Royal Arena Visual Identity:** Charcoal (`#10141B`), Slate (`#1A202B`), Antique Gold (`#D4AF65`), Ivory (`#F1E8D5`), and selectable Walnut / Charcoal / Emerald board themes with three original vector Staunton piece styles.
- **Full Chess Rules (`chess.js` + FIDE extensions):**
  - Standard piece movements, pins, checks, checkmate, stalemate, kingside & queenside castling (including all attack/occupancy/history restrictions), en passant (including 1-ply expiry and horizontal/vertical pins), and Q/R/B/N promotion.
  - **Automatic Draws vs Claimable Draws:** Checkmate always takes precedence over draw counters. Stalemate, insufficient material, fivefold repetition (`5x`), and the 75-move rule (`150` half-moves) end automatically; threefold repetition (`3x`) and the 50-move rule (`100` half-moves) enable an explicit **Claim Draw** action instead of silently ending the game.
  - **Explicit Session State Machine:** `SETUP`, `PLAYER_TURN`, `AI_THINKING`, `PROMOTION_PENDING`, `GAME_OVER`, and `REVIEW`, with live moves locked after `GAME_OVER`.
- **Stockfish 19 Web Worker Opponent:**
  - Single-threaded Lite WASM (`stockfish-19-lite-single.js` + `.wasm`) loaded lazily from `${BASE_URL}engine/`, requiring **no** cross-origin isolation (`COOP`/`COEP`) headers so it runs cleanly on GitHub Pages.
  - Five difficulty presets (`Beginner`, `Easy`, `Medium`, `Hard`, `Expert`) mapped to Stockfish `Skill Level`, `depth`, and `movetime` parameters without fabricated Elo claims.
  - Safe UCI `stop` + `isready`/`readyok` handshake with session and position tokens to cancel active searches cleanly on undo, restart, mode switch, pause, or unmount, plus retry and legal-move fallback on engine error/timeout.
  - Optional legal hints and live Stockfish evaluation bar.
- **Clocks, History, Review & Persistence:**
  - Time controls: `Untimed`, `3+2`, `5+0`, `10+0`, `15+10`, tracked with monotonic `performance.now()` timestamps, per-move increment applied once after legal moves, isolated clock rendering, pause/resume, and timeout vs insufficient material detection.
  - SAN move history with `|<` / `<` / `>` / `>|` board review independent of live state, FEN copy, and PGN export.
  - Versioned `localStorage` persistence (`kingchess.settings.v1` and `kingchess.session.v1`) with strict schema + full move-replay validation and graceful corrupt-save recovery.
- **Input & Accessibility:** Click-to-move, mouse/touch pointer drag-and-drop, keyboard arrow navigation (`Enter`/`Space`/`Escape`), Web Audio sound cues, and `prefers-reduced-motion` / user motion settings.

---

## Installation & Running

Requirements: **Node.js >= 22** (tested with Node 24) and **npm**.

```bash
npm install
npm run dev
```

`npm install` automatically syncs the unmodified Stockfish 19 single-threaded Lite WASM engine and GPL-3.0 notice into `public/engine/`. Because Vite is configured with `base: '/KingChess/'`, the local dev server serves the app at:

```
http://localhost:5173/KingChess/
```

### Production Build & Local Preview

```bash
npm run build
npm run preview
```

Preview serves the built `dist/` bundle at `http://localhost:4173/KingChess/`.

---

## Testing & Verification

```bash
# TypeScript strict check
npm run typecheck

# ESLint
npm run lint

# Vitest unit & integration tests (rules, perft, clocks, persistence, Stockfish client, store, React UI)
npm run test

# Full static + unit + build check
npm run check

# End-to-end Playwright suite (tests production build under /KingChess/ across 375, 768, 1280, 1920 px)
npm run test:e2e
```

---

## GitHub Pages Deployment

`vite.config.ts` sets `base: '/KingChess/'`, and all runtime assets (such as the favicon and `public/engine/stockfish-19-lite-single.{js,wasm}`) resolve relative to `import.meta.env.BASE_URL`.

To deploy to GitHub Pages:
1. Run `npm ci && npm run build`.
2. Publish the generated `dist/` directory to GitHub Pages (ensuring `.wasm` is served with `application/wasm` — GitHub Pages serves `.wasm` properly out of the box, and the single-threaded Stockfish build requires no `COOP`/`COEP` headers).

---

## Clock Behavior (Reload, Pause, Timeout)

- **Monotonic Timing:** Active clocks compute elapsed time using `performance.now()` rather than counting interval ticks, avoiding timer drift.
- **Increments & Undo:** Increments (`+2s` in `3+2`, `+10s` in `15+10`) are added once after a legal move completes. Undoing a move restores both the board position and the exact clock snapshot from before that turn.
- **Pause:** Pausing freezes remaining milliseconds immediately and veils the board so positions cannot be studied or played while stopped.
- **Reload:** Saving and reloading the browser pauses the offline interval so players do not lose time while the tab is closed; resuming via **Continue Game** restarts from the saved remaining milliseconds.
- **Timeout:** When a player's clock reaches `0`, the opponent wins on time unless the opponent lacks mating material (e.g., lone King, or lone `K+B` / `K+N` vs lone `K`), which resolves as a draw (`Timeout vs Insufficient Material`).

---

## Architecture

```
src/
  ai/           # Stockfish difficulty presets & UCI Web Worker client with token cancellation
  assets/       # Original vector Staunton SVG chess pieces
  audio/        # Web Audio API acoustic sound synthesizer
  clock/        # Monotonic clock state helpers and formatting
  components/
    board/      # Memoized 8x8 ChessBoard, BoardSquare, and PromotionModal
    layout/     # AppHeader
    lobby/      # LobbyView (AI setup, Local 2P, Continue Game, Rules/Settings)
    modals/     # GameOverModal, SettingsModal, RulesModal
    panels/     # PlayerCard, isolated ChessClock, EvalBar, MoveHistoryPanel, GameControls
  engine/       # Pure TypeScript coordinates and chess.js rules/draw adapter
  hooks/        # useReducedMotion, useGameClock, useStockfishAI
  storage/      # Versioned localStorage validation and corrupt-save recovery
  stores/       # Zustand settingsStore and gameStore state machine
  styles/       # Royal Charcoal/Gold/Ivory design tokens and responsive CSS
  types/        # Shared domain TypeScript interfaces
```

---

## Known Limitations

- **Dead Positions Beyond Material Counts:** `chess.js` detects standard insufficient-material dead positions (`K vs K`, `K+N vs K`, `K+B vs K`, and same-color bishops `K+B* vs K+B*`), while KingChess also checks mating material on timeout. Arbitrary blocked pawn structures where neither side can legally ever checkmate are not automatically detected as dead positions.
- **Difficulty Calibration:** Difficulty presets map to Stockfish `Skill Level` (1–20), search depth, and move time budgets rather than calibrated human Elo ratings.
- **Single-Threaded Engine:** Uses `stockfish-19-lite-single` (1 thread, 1.8 MB NNUE lite net) so it works on static hosts without `SharedArrayBuffer` / cross-origin isolation headers.
- **Client-Side Only:** V1 supports Local Two Players and vs Computer only; online multiplayer is out of scope for V1.

---

## License & Notices

- **KingChess:** Licensed under **GNU General Public License v3.0 or later (`GPL-3.0-or-later`)** — see [`LICENSE`](./LICENSE).
- **Third-Party Licenses:** See [`THIRD_PARTY_LICENSES.md`](./THIRD_PARTY_LICENSES.md) and [`public/engine/STOCKFISH-NOTICE.txt`](./public/engine/STOCKFISH-NOTICE.txt) for Stockfish 19 (`GPL-3.0`) source links and `chess.js` (`BSD-2-Clause`) attribution.
