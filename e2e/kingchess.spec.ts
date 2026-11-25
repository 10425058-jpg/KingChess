import { expect, test, type Page } from '@playwright/test';

function attachConsoleGuards(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (err) => {
    errors.push(`pageerror: ${err.message}`);
  });
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push(`console.error: ${msg.text()}`);
    }
  });
  return errors;
}

async function clickSquare(page: Page, square: string) {
  await page.getByTestId(`square-${square}`).click();
}

test.describe('KingChess Production E2E Suite', () => {
  test('loads production bundle under /KingChess/ base path and plays vs Stockfish as White and Black', async ({
    page,
  }) => {
    const errors = attachConsoleGuards(page);

    const engineRequests: Array<{ url: string; status: number }> = [];
    page.on('response', (res) => {
      if (res.url().includes('/KingChess/engine/')) {
        engineRequests.push({ url: res.url(), status: res.status() });
      }
    });

    await page.goto('./');
    await expect(page.getByTestId('lobby-view')).toBeVisible();

    // Start vs Computer as White (Beginner for fast deterministic test response)
    await page.getByTestId('ai-color-w').click();
    await page.getByTestId('ai-difficulty-beginner').click();
    await page.getByTestId('ai-time-3+2').click();
    await page.getByTestId('start-ai-btn').click();

    await expect(page.getByTestId('game-arena')).toBeVisible();

    // Play 1. e4 and verify Stockfish worker loads and replies with Black's 1st move (ply 2)
    await clickSquare(page, 'e2');
    await clickSquare(page, 'e4');
    await expect(page.getByTestId('ply-1')).toHaveText('e4');

    await expect(page.getByTestId('ply-2')).toBeVisible({ timeout: 20_000 });
    expect(
      engineRequests.some(
        (r) => r.url.includes('stockfish-19-lite-single.js') && r.status === 200,
      ),
    ).toBe(true);
    expect(
      engineRequests.some(
        (r) => r.url.includes('stockfish-19-lite-single.wasm') && r.status === 200,
      ),
    ).toBe(true);

    // Undo should revert both AI's reply and human's move cleanly
    await page.getByTestId('undo-btn').click();
    await expect(page.getByTestId('ply-1')).not.toBeVisible();

    // Test playing as Black: AI plays White move 1 automatically
    await page.getByTestId('nav-lobby-btn').click();
    await page.getByTestId('ai-color-b').click();
    await page.getByTestId('ai-difficulty-easy').click();
    await page.getByTestId('start-ai-btn').click();
    await expect(page.getByTestId('ply-1')).toBeVisible({ timeout: 20_000 });

    // Flip/Undo/Restart during or after search must not produce phantom moves
    await page.getByTestId('rematch-btn').click();
    await expect(page.getByTestId('game-arena')).toBeVisible();

    // Cancel active Expert AI search via Undo mid-search and verify no phantom reply lands
    await page.getByTestId('nav-lobby-btn').click();
    await page.getByTestId('ai-color-w').click();
    await page.getByTestId('ai-difficulty-expert').click();
    await page.getByTestId('start-ai-btn').click();

    await clickSquare(page, 'e2');
    await clickSquare(page, 'e4');
    await expect(page.getByTestId('ply-1')).toHaveText('e4');
    await expect(page.getByTestId('status-banner')).toContainText(/Stockfish is thinking/i);
    await page.getByTestId('undo-btn').click();
    await expect(page.getByTestId('ply-1')).not.toBeVisible();
    await page.waitForTimeout(1800);
    await expect(page.getByTestId('ply-1')).not.toBeVisible();

    // Verify optional EvalBar and Legal Hint work with real Stockfish
    await page.getByTestId('header-settings-btn').click();
    await page.getByTestId('toggle-eval-bar').click();
    await page.getByTestId('settings-close-btn').click();
    await expect(page.getByTestId('eval-bar')).toBeVisible();

    await page.getByTestId('hint-btn').click();
    await expect(page.locator('.kc-square.is-hint')).toHaveCount(2, { timeout: 15_000 });

    expect(errors).toEqual([]);
  });

  test('supports touch input on mobile viewport without errors', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 375, height: 812 },
      hasTouch: true,
    });
    const page = await context.newPage();
    const errors = attachConsoleGuards(page);

    await page.goto('./');
    await page.getByTestId('start-local-btn').tap();
    await page.getByTestId('square-e2').tap();
    await page.getByTestId('square-e4').tap();
    await expect(page.getByTestId('ply-1')).toHaveText('e4');

    expect(errors).toEqual([]);
    await context.close();
  });

  test('supports drag-and-drop, special moves, game over, review mode, clocks, reload, and corrupt save recovery', async ({
    page,
  }) => {
    const errors = attachConsoleGuards(page);

    await page.goto('./');
    await page.getByTestId('local-time-3+2').click();
    await page.getByTestId('start-local-btn').click();

    // Drag-and-drop e2 -> e4 using pointer events
    const e2Box = await page.getByTestId('square-e2').boundingBox();
    const e4Box = await page.getByTestId('square-e4').boundingBox();
    expect(e2Box).not.toBeNull();
    expect(e4Box).not.toBeNull();

    await page.mouse.move(e2Box!.x + e2Box!.width / 2, e2Box!.y + e2Box!.height / 2);
    await page.mouse.down();
    await page.mouse.move(e4Box!.x + e4Box!.width / 2, e4Box!.y + e4Box!.height / 2, {
      steps: 8,
    });
    await page.mouse.up();
    await expect(page.getByTestId('ply-1')).toHaveText('e4');

    // Play e5, then verify increment / clock works and reload persistence restores game
    await clickSquare(page, 'e7');
    await clickSquare(page, 'e5');
    await expect(page.getByTestId('ply-2')).toHaveText('e5');

    // Pause and resume
    await page.getByTestId('pause-btn').click();
    await expect(page.getByTestId('board-pause-veil')).toBeVisible();
    await page.getByTestId('resume-from-veil-btn').click();
    await expect(page.getByTestId('board-pause-veil')).not.toBeVisible();

    // Reload page and verify Continue Game restores exact 2-ply state
    await page.reload();
    await expect(page.getByTestId('continue-game-btn')).toBeVisible();
    await page.getByTestId('continue-game-btn').click();
    await expect(page.getByTestId('ply-1')).toHaveText('e4');
    await expect(page.getByTestId('ply-2')).toHaveText('e5');

    // Navigate review independently of live state
    await page.getByTestId('review-first-btn').click();
    await expect(page.getByTestId('return-to-live-btn')).toBeVisible();
    await page.getByTestId('return-to-live-btn').click();
    await expect(page.getByTestId('return-to-live-btn')).not.toBeVisible();

    // Corrupt localStorage recovery on reload
    await page.evaluate(() => {
      window.localStorage.setItem('kingchess.session.v1', '{broken-save-payload');
    });
    await page.reload();
    await expect(page.getByTestId('corrupt-save-banner')).toBeVisible();

    expect(errors).toEqual([]);
  });

  for (const width of [375, 768, 1280, 1920]) {
    test(`maintains responsive layout with zero horizontal overflow at ${width}px`, async ({
      page,
    }) => {
      const errors = attachConsoleGuards(page);
      const height = width <= 768 ? 812 : 900;
      await page.setViewportSize({ width, height });

      await page.goto('./');
      await expect(page.getByTestId('lobby-view')).toBeVisible();

      const lobbyOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      );
      expect(lobbyOverflow).toBe(false);

      await page.getByTestId('start-local-btn').click();
      await expect(page.getByTestId('chess-board')).toBeVisible();

      const arenaMetrics = await page.evaluate(() => {
        const board = document.querySelector('[data-testid="chess-board"]');
        const rect = board?.getBoundingClientRect();
        return {
          overflow: document.documentElement.scrollWidth > window.innerWidth,
          width: rect?.width ?? 0,
          height: rect?.height ?? 0,
        };
      });

      expect(arenaMetrics.overflow).toBe(false);
      expect(arenaMetrics.width).toBeGreaterThan(240);
      expect(Math.abs(arenaMetrics.width - arenaMetrics.height)).toBeLessThanOrEqual(2);

      expect(errors).toEqual([]);
    });
  }
});
