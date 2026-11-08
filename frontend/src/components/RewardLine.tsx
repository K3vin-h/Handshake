import type { Praise } from "../lib/praise";

/**
 * A short praise line after a confirmed match. Text only (no sound), fades in unless motion is reduced.
 * Always mounted so the polite live region is announced when the line arrives; empty when there is none.
 */
export function RewardLine({ reward }: { reward?: Praise }) {
  return (
    <p className="reward-region" role="status" aria-live="polite" aria-atomic="true">
      {reward && (
        <span key={reward.message} className="reward-line">
          <span aria-hidden="true">★ </span>{reward.message}
          {reward.cached && <span className="muted small"> (cached)</span>}
        </span>
      )}
    </p>
  );
}
