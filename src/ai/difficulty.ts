import type { DifficultyId } from '../types/chess';

export interface DifficultyPreset {
  id: DifficultyId;
  label: string;
  description: string;
  skillLevel: number;
  depth: number;
  movetimeMs: number;
}

/**
 * Supported Stockfish UCI search presets.
 * Deliberately avoids invented Elo claims; strength scales via Stockfish Skill Level (0-20),
 * search depth ceiling, and per-move time budget.
 */
export const DIFFICULTY_PRESETS: Record<DifficultyId, DifficultyPreset> = {
  beginner: {
    id: 'beginner',
    label: 'Beginner',
    description: 'Skill Level 1 · Depth 2 · Gentle opening play',
    skillLevel: 1,
    depth: 2,
    movetimeMs: 180,
  },
  easy: {
    id: 'easy',
    label: 'Easy',
    description: 'Skill Level 4 · Depth 4 · Casual tactics',
    skillLevel: 4,
    depth: 4,
    movetimeMs: 320,
  },
  medium: {
    id: 'medium',
    label: 'Medium',
    description: 'Skill Level 9 · Depth 7 · Balanced club test',
    skillLevel: 9,
    depth: 7,
    movetimeMs: 550,
  },
  hard: {
    id: 'hard',
    label: 'Hard',
    description: 'Skill Level 15 · Depth 11 · Sharp calculation',
    skillLevel: 15,
    depth: 11,
    movetimeMs: 950,
  },
  expert: {
    id: 'expert',
    label: 'Expert',
    description: 'Skill Level 20 · Depth 15 · Full engine precision',
    skillLevel: 20,
    depth: 15,
    movetimeMs: 1600,
  },
};

export const DIFFICULTY_ORDER: readonly DifficultyId[] = [
  'beginner',
  'easy',
  'medium',
  'hard',
  'expert',
];
