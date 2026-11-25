import { useGameStore } from '../../stores/gameStore';
import { useSettingsStore } from '../../stores/settingsStore';

function computeWhiteFillPercent(
  evalData: { type: 'cp' | 'mate'; value: number } | null,
): number {
  if (!evalData) return 50;
  if (evalData.type === 'mate') {
    return evalData.value > 0 ? 96 : 4;
  }
  // Smooth logistic curve clamping centipawns into [6%, 94%]
  const clamped = Math.max(-1000, Math.min(1000, evalData.value));
  const prob = 1 / (1 + Math.exp(-0.004 * clamped));
  return Math.max(6, Math.min(94, Math.round(prob * 100)));
}

function formatEvalText(
  evalData: { type: 'cp' | 'mate'; value: number } | null,
): string {
  if (!evalData) return '0.0';
  if (evalData.type === 'mate') {
    return `M${Math.abs(evalData.value)}`;
  }
  const pawns = (evalData.value / 100).toFixed(1);
  return evalData.value > 0 ? `+${pawns}` : pawns;
}

export function EvalBar() {
  const mode = useGameStore((s) => s.mode);
  const flipped = useGameStore((s) => s.flipped);
  const evaluation = useGameStore((s) => s.evaluation);
  const showEvalBar = useSettingsStore((s) => s.showEvalBar);

  if (mode !== 'ai' || !showEvalBar) {
    return null;
  }

  const whitePct = computeWhiteFillPercent(evaluation);
  const text = formatEvalText(evaluation);
  const whiteFavored = !evaluation || evaluation.value >= 0;

  return (
    <div
      className="kc-eval-bar"
      role="status"
      aria-label={`Engine evaluation ${text}`}
      data-testid="eval-bar"
    >
      <div
        className="kc-eval-fill"
        style={{
          height: `${flipped ? 100 - whitePct : whitePct}%`,
          background: flipped ? '#1d222c' : 'var(--kc-ivory)',
        }}
      />
      <span className={`kc-eval-label ${whiteFavored ? 'is-bottom' : 'is-top'}`}>
        {text}
      </span>
    </div>
  );
}
