# Third-Party Licenses & Attribution

KingChess is distributed under the **GNU General Public License v3.0 or later (`GPL-3.0-or-later`)** — see [`LICENSE`](./LICENSE).

## 1. Stockfish Chess Engine (`stockfish@19.0.1`)
- **License:** GNU General Public License v3.0 (`GPL-3.0`)
- **Package:** `stockfish` (`19.0.1`, unmodified `stockfish-19-lite-single.js` and `stockfish-19-lite-single.wasm`)
- **Upstream Authors:** Nathan Rugg (`stockfish.js` / WASM port), T. Romstad, M. Costalba, J. Kiiski, G. Linscott, and the Stockfish developers; NNUE lite network (`nn-61e7af4bb97d.nnue`) by Chris Bao (`sscg13`)
- **Source Code:**
  - WASM wrapper & build scripts: https://github.com/nmrugg/stockfish.js
  - Stockfish C++ engine: https://github.com/official-stockfish/Stockfish
- **Bundled Distribution Notice:** Unmodified engine worker files and the full GPL-3.0 text are shipped alongside the production web assets in `public/engine/COPYING.txt` and `public/engine/STOCKFISH-NOTICE.txt` (published under `/KingChess/engine/`).

## 2. chess.js (`chess.js@1.4.0`)
- **License:** BSD-2-Clause License
- **Author:** Jeff Hlywa (`jhlywa@gmail.com`)
- **Source:** https://github.com/jhlywa/chess.js

## 3. UI, State, Icons & Build Tooling
- **React & ReactDOM (`react`, `react-dom`):** MIT License — Meta Platforms, Inc. and affiliates
- **Zustand (`zustand`):** MIT License — Paul Henschel and contributors
- **Lucide Icons (`lucide-react`):** ISC License — Lucide Contributors
- **Vite, Vitest, TypeScript, ESLint, Playwright:** MIT / Apache-2.0 Licenses (dev/build/test tooling)

## 4. Original KingChess Assets
- Classic Staunton vector SVG piece sets (`src/assets/pieces/`) and Web Audio synthesized sound cues (`src/audio/soundEngine.ts`) are original works created specifically for KingChess and licensed under `GPL-3.0-or-later`.
