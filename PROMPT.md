# KingChess — Master Prompt for Codex

Act as a senior game developer, chess-engine engineer, UI/UX designer, software architect and QA engineer. Build KingChess, a polished browser-based chess game, in the repository https://github.com/10425058-jpg/KingChess.git. Inspect existing files first and preserve unrelated work. Deliver a functional game, not a mockup.

## 1. Product vision
Create a premium royal chess arena with an elegant charcoal, antique gold, ivory and walnut visual identity. Prioritize accurate chess rules, responsive interactions, beautiful readable visuals, and maintainable code. The initial version is 2D, with local two-player and player-versus-AI modes. Online multiplayer is a future extension, not a fake feature.

## 2. Technical stack
Use React, TypeScript strict mode, Vite, Zustand where useful, chess.js as the authoritative rules engine, and Stockfish via a dedicated Web Worker. Use lightweight CSS/Motion animations, Vitest and Playwright. Choose compatible dependencies, commit a lockfile, and comply with all asset and engine licenses (including Stockfish GPL distribution requirements). Configure GitHub Pages base /KingChess/ and test production asset paths. No paid APIs or backend required for V1.

## 3. UI/UX
- Lobby: KingChess branding, Play vs Computer, Local Two Players, Continue Game, Rules, Settings.
- Game: dominant 8x8 board, coordinate labels, clear classic chess pieces, player cards, clocks, captured pieces, SAN move history and controls. Desktop side panel; mobile stacked layout.
- Colors: charcoal #10141B, slate #1A202B, antique gold #D4AF65, ivory #F1E8D5. Keep strong contrast and restrained effects; avoid excessive glow.
- Show selected pieces, legal moves/captures, previous move, checked king, promotion and game-over states. Use multiple visual cues rather than color alone.
- Click-to-move, drag-and-drop, touch and keyboard input. Smooth piece movement/capture animations (120–220 ms), optional sound, reduced-motion support.
- Settings: board/piece themes, sound, coordinates, motion preferences. Game-over modal: result, reason, rematch, review, lobby. All visible controls must work.
- Test at 375, 768, 1280 and 1920 px. No horizontal overflow or illegible pieces.

## 4. Rules and game state
Implement all standard piece movements, captures, turn order, pins, checks, checkmate, stalemate, castling (both sides and all restrictions), en passant (including expiry and king safety), promotion to Q/R/B/N, and legal move validation. Never permit capturing a king or leaving one's own king in check.
Handle insufficient material/dead positions, repetition, move-count draws, draw agreement, resignation and timeouts. Distinguish claimable threefold/50-move draws from automatic fivefold/75-move draws, with checkmate precedence. Extend chess.js where necessary and document any limitations rather than falsely claiming full FIDE compliance.
Use explicit states SETUP, PLAYER_TURN, AI_THINKING, PROMOTION_PENDING, GAME_OVER, REVIEW. Validate every move against the current position. Prevent duplicate moves and stale actions. Keep move history, FEN, PGN, clocks and repetition history coherent; do not reconstruct repetition history from FEN alone.
Support casual undo, rematch, board flip, and player color selection. Time controls: untimed, 3+2, 5+0, 10+0, 15+10. Measure elapsed time with a monotonic clock; apply increments once after legal moves. Define reload, pause and timeout behavior. Restore history and clocks on undo. Lock live moves after game over.

## 5. AI opponent
Integrate a compatible Stockfish Web Worker using UCI commands. Offer Beginner, Easy, Medium, Hard and Expert difficulty with meaningful supported search settings; do not invent Elo ratings. Allow White, Black or Random player color. Display thinking status without freezing UI. Cancel search on restart, undo, mode switch or unmount. Use session/position tokens and a safe UCI stop handshake to reject stale responses. Validate bestmove; handle engine errors or timeouts with retry or a documented legal fallback. Test worker loading under the Pages base path without requiring unsupported cross-origin isolation. Use a single-thread build if needed.
Optional after core completion: legal hints and an actual engine evaluation bar.

## 6. History and persistence
Provide SAN move history, first/previous/next/last navigation, board review independent of live state, PGN export and FEN copy. Use versioned localStorage for settings and resumable games. Validate saved data and reconstruct the move sequence safely; handle corrupt saves. Do not store secrets. Add puzzles, openings and statistics only after the core is reliable.

## 7. Architecture
Separate app shell, board components, lobby, game controls, chess rules adapter, AI engine, session/settings stores, hooks, styles, tests and licensed assets. Keep chess logic independent from React rendering. Avoid monolithic App.tsx, duplicated board state, hardcoded fake data, unnecessary dependencies and unsafe HTML. Centralize square/orientation conversion. Optimize rendering so clock updates do not redraw every square; lazy-load AI and clean up workers, timers and event listeners. Provide accessible labels, visible focus and usable dialogs.

## 8. Development milestones
1. Scaffold and configure TypeScript, Vite, tests and Pages paths.
2. Implement and test chess core and session state; verify starting position has 20 legal moves and perft depth 2 is 400.
3. Build the responsive lobby and playable local chess board with all special moves.
4. Integrate AI, difficulty, cancellation and both player colors.
5. Implement clocks, history, review, persistence, settings, game-over and polish.
6. Run QA, fix failures and produce a production build.

## 9. Acceptance criteria
- Fresh install, dev server, typecheck, lint, tests and production build succeed.
- Test illegal moves, pins, checks, Fool's Mate, stalemate, both castling sides, forbidden castling, legal/expired/pinned en passant, all promotions, draw rules and clock expiration.
- Test both AI colors, difficulty presets, undo/restart during search and rejection of phantom or duplicate moves.
- Test clock increments, undo restoration, game-over lock, review/live separation, saved game reload and corrupt save recovery.
- Verify click, drag, touch, keyboard, responsive layout, production asset paths and no serious browser console errors.
- No placeholder controls, fake AI moves or fabricated test reports.

## 10. Delivery
Create a real working codebase, lockfile, README (installation, running, testing, deployment, architecture and known limitations), and required license notices. Work incrementally on a feature branch. Confirm the remote is exactly KingChess. Run actual checks, commit logical changes and open a pull request to main. Do not force-push or bypass protections. Merge only when authorized and checks pass. Report completed features, exact test results, remaining limitations and PR link. Do not claim deployment is live unless verified.

Implement the game when this prompt is explicitly submitted to a coding agent. Prioritize a complete, correct and polished V1 over optional features.
