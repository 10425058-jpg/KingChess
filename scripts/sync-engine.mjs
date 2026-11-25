import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '..');

const stockfishDir = resolve(rootDir, 'node_modules', 'stockfish');
const binDir = resolve(stockfishDir, 'bin');
const targetDir = resolve(rootDir, 'public', 'engine');

const assetsToCopy = [
  {
    src: resolve(binDir, 'stockfish-19-lite-single.js'),
    dest: resolve(targetDir, 'stockfish-19-lite-single.js'),
  },
  {
    src: resolve(binDir, 'stockfish-19-lite-single.wasm'),
    dest: resolve(targetDir, 'stockfish-19-lite-single.wasm'),
  },
  {
    src: resolve(stockfishDir, 'Copying.txt'),
    dest: resolve(targetDir, 'COPYING.txt'),
  },
];

mkdirSync(targetDir, { recursive: true });

for (const asset of assetsToCopy) {
  if (!existsSync(asset.src)) {
    throw new Error(`Missing Stockfish distribution asset: ${asset.src}`);
  }
  copyFileSync(asset.src, asset.dest);
}

const pkg = JSON.parse(readFileSync(resolve(stockfishDir, 'package.json'), 'utf8'));

const noticeText = `KingChess Stockfish Engine Distribution Notice
==============================================

Bundled Engine: Stockfish ${pkg.version} (stockfish-19-lite-single.js + stockfish-19-lite-single.wasm)
Variant: Single-threaded Lite WASM build (no Cross-Origin-Isolation / SharedArrayBuffer required)
License: GNU General Public License v3.0 (GPL-3.0) — see COPYING.txt in this directory

Upstream Source Code:
- Stockfish.js WASM wrapper & build scripts: https://github.com/nmrugg/stockfish.js (npm package: stockfish@${pkg.version})
- Stockfish Chess Engine C++ source: https://github.com/official-stockfish/Stockfish

These engine files are distributed unmodified from the official npm package \`stockfish@${pkg.version}\`.
`;

writeFileSync(resolve(targetDir, 'STOCKFISH-NOTICE.txt'), noticeText, 'utf8');
console.log(`Synced Stockfish ${pkg.version} lite-single assets to public/engine/`);
