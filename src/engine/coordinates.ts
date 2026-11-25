import type { Square } from 'chess.js';

export const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;
export const RANKS = ['1', '2', '3', '4', '5', '6', '7', '8'] as const;

export function squareToCoords(square: Square): { fileIndex: number; rankIndex: number } {
  const fileChar = square[0] as (typeof FILES)[number];
  const rankChar = square[1] as (typeof RANKS)[number];
  return {
    fileIndex: FILES.indexOf(fileChar),
    rankIndex: RANKS.indexOf(rankChar),
  };
}

export function coordsToSquare(fileIndex: number, rankIndex: number): Square | null {
  if (fileIndex < 0 || fileIndex > 7 || rankIndex < 0 || rankIndex > 7) {
    return null;
  }
  const file = FILES[fileIndex];
  const rank = RANKS[rankIndex];
  if (!file || !rank) {
    return null;
  }
  return `${file}${rank}` as Square;
}

/**
 * Converts a board square to 0-indexed CSS Grid visual coordinates (row 0 = top, col 0 = left).
 */
export function squareToVisualGrid(
  square: Square,
  flipped: boolean,
): { row: number; col: number } {
  const { fileIndex, rankIndex } = squareToCoords(square);
  if (flipped) {
    return {
      row: rankIndex,
      col: 7 - fileIndex,
    };
  }
  return {
    row: 7 - rankIndex,
    col: fileIndex,
  };
}

/**
 * Converts 0-indexed CSS Grid visual coordinates (row 0 = top, col 0 = left) back to algebraic square.
 */
export function visualGridToSquare(row: number, col: number, flipped: boolean): Square {
  const fileIndex = flipped ? 7 - col : col;
  const rankIndex = flipped ? row : 7 - row;
  const square = coordsToSquare(fileIndex, rankIndex);
  if (!square) {
    throw new RangeError(`Invalid visual board coordinates: row=${row}, col=${col}`);
  }
  return square;
}

/**
 * Returns all 64 squares ordered top-left to bottom-right for rendering the 8x8 CSS Grid.
 */
export function getBoardSquaresInDisplayOrder(flipped: boolean): Square[] {
  const squares: Square[] = [];
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      squares.push(visualGridToSquare(row, col, flipped));
    }
  }
  return squares;
}

export function getFileLabels(flipped: boolean): readonly string[] {
  return flipped ? [...FILES].reverse() : FILES;
}

export function getRankLabels(flipped: boolean): readonly string[] {
  return flipped ? RANKS : [...RANKS].reverse();
}

export function isLightSquare(square: Square): boolean {
  const { fileIndex, rankIndex } = squareToCoords(square);
  return (fileIndex + rankIndex) % 2 === 1;
}

/**
 * Moves focus on the board using visual arrow directions regardless of board orientation.
 */
export function moveSquareByKey(
  square: Square,
  key: string,
  flipped: boolean,
): Square | null {
  const { row, col } = squareToVisualGrid(square, flipped);
  let nextRow = row;
  let nextCol = col;

  switch (key) {
    case 'ArrowUp':
      nextRow -= 1;
      break;
    case 'ArrowDown':
      nextRow += 1;
      break;
    case 'ArrowLeft':
      nextCol -= 1;
      break;
    case 'ArrowRight':
      nextCol += 1;
      break;
    default:
      return null;
  }

  if (nextRow < 0 || nextRow > 7 || nextCol < 0 || nextCol > 7) {
    return null;
  }
  return visualGridToSquare(nextRow, nextCol, flipped);
}
