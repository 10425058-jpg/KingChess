import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from './App';
import { DEFAULT_POSITION } from './engine/chessRules';
import { SESSION_STORAGE_KEY } from './storage/persistence';
import { useGameStore } from './stores/gameStore';
import { useSettingsStore } from './stores/settingsStore';

describe('KingChess UI integration', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useSettingsStore.getState().resetSettings();
    useGameStore.getState().goToLobby();
    useGameStore.getState().clearSavedSession();
  });

  it('renders lobby controls, corrupt save recovery, and settings customization', () => {
    window.localStorage.setItem(SESSION_STORAGE_KEY, '{invalid-json');
    useGameStore.getState().refreshSavedSession();

    render(<App />);

    expect(screen.getByTestId('lobby-view')).toBeInTheDocument();
    expect(screen.getByTestId('corrupt-save-banner')).toBeInTheDocument();
    expect(screen.getByTestId('start-ai-btn')).toBeInTheDocument();
    expect(screen.getByTestId('start-local-btn')).toBeInTheDocument();

    // Open Settings and change board theme + coordinates
    fireEvent.click(screen.getByTestId('lobby-settings-btn'));
    expect(screen.getByTestId('settings-modal')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('board-theme-charcoal-slate'));
    fireEvent.click(screen.getByTestId('toggle-coordinates'));
    fireEvent.click(screen.getByTestId('settings-close-btn'));

    expect(useSettingsStore.getState().boardTheme).toBe('charcoal-slate');
    expect(useSettingsStore.getState().showCoordinates).toBe(false);

    // Open Rules modal
    fireEvent.click(screen.getByTestId('lobby-rules-btn'));
    expect(screen.getByTestId('rules-modal')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('rules-close-btn'));
    expect(screen.queryByTestId('rules-modal')).not.toBeInTheDocument();
  });

  it('plays Fool’s Mate via click-to-move in Local Two Players and opens Game Over modal', () => {
    render(<App />);
    fireEvent.click(screen.getByTestId('start-local-btn'));
    expect(screen.getByTestId('game-arena')).toBeInTheDocument();

    // 1. f3 e5 2. g4 Qh4#
    fireEvent.click(screen.getByTestId('square-f2'));
    fireEvent.click(screen.getByTestId('square-f3'));

    fireEvent.click(screen.getByTestId('square-e7'));
    fireEvent.click(screen.getByTestId('square-e5'));

    fireEvent.click(screen.getByTestId('square-g2'));
    fireEvent.click(screen.getByTestId('square-g4'));

    fireEvent.click(screen.getByTestId('square-d8'));
    fireEvent.click(screen.getByTestId('square-h4'));

    const modal = screen.getByTestId('game-over-modal');
    expect(modal).toBeInTheDocument();
    expect(within(modal).getByRole('heading', { name: /Black Wins/i })).toBeInTheDocument();
    expect(within(modal).getByText('Checkmate')).toBeInTheDocument();

    // Enter Review Board from Game Over modal and verify navigation
    fireEvent.click(screen.getByTestId('gameover-review-btn'));
    expect(screen.queryByTestId('game-over-modal')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('review-first-btn'));
    expect(screen.getByTestId('square-f2')).toHaveAttribute(
      'aria-label',
      expect.stringContaining('White Pawn'),
    );
  });

  it('supports keyboard board navigation and move execution', () => {
    render(<App />);
    fireEvent.click(screen.getByTestId('start-local-btn'));

    const e2 = screen.getByTestId('square-e2');
    e2.focus();
    fireEvent.click(e2);
    expect(e2).toHaveAttribute('aria-label', expect.stringContaining('selected'));

    fireEvent.keyDown(e2, { key: 'ArrowUp' });
    const e3 = screen.getByTestId('square-e3');
    expect(document.activeElement).toBe(e3);

    fireEvent.keyDown(e3, { key: 'ArrowUp' });
    const e4 = screen.getByTestId('square-e4');
    expect(document.activeElement).toBe(e4);
    fireEvent.click(e4);

    expect(screen.getByTestId('ply-1')).toHaveTextContent('e4');
  });

  it('prompts promotion modal on pawn reaching 8th rank and supports all 4 choices', () => {
    useGameStore.getState().startNewGame({
      mode: 'local',
      playerColorChoice: 'w',
      difficulty: 'medium',
      timeControlId: 'untimed',
      initialFen: '4k3/P7/8/8/8/8/8/4K3 w - - 0 1',
    });

    render(<App />);
    fireEvent.click(screen.getByTestId('square-a7'));
    fireEvent.click(screen.getByTestId('square-a8'));

    expect(screen.getByTestId('promotion-modal')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('promote-r'));
    expect(screen.queryByTestId('promotion-modal')).not.toBeInTheDocument();
    expect(screen.getByTestId('ply-1')).toHaveTextContent('a8=R+');
  });

  it('surfaces Claim Draw button on threefold repetition without auto-ending', () => {
    useGameStore.getState().startNewGame({
      mode: 'local',
      playerColorChoice: 'w',
      difficulty: 'medium',
      timeControlId: 'untimed',
      initialFen: DEFAULT_POSITION,
    });

    render(<App />);
    const sequence: Array<[string, string]> = [
      ['g1', 'f3'],
      ['g8', 'f6'],
      ['f3', 'g1'],
      ['f6', 'g8'],
      ['g1', 'f3'],
      ['g8', 'f6'],
      ['f3', 'g1'],
      ['f6', 'g8'],
    ];

    for (const [from, to] of sequence) {
      fireEvent.click(screen.getByTestId(`square-${from}`));
      fireEvent.click(screen.getByTestId(`square-${to}`));
    }

    // Still playable until explicitly claimed
    expect(screen.queryByTestId('game-over-modal')).not.toBeInTheDocument();
    expect(screen.getByTestId('claimable-draw-banner')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('claim-draw-btn'));
    const modal = screen.getByTestId('game-over-modal');
    expect(modal).toBeInTheDocument();
    expect(within(modal).getByText(/Claimed Threefold Repetition/i)).toBeInTheDocument();
  });
});
