/**
 * Coaching in two layers. The instant tip (from the hand measurements, no network) is always shown first.
 * An optional "Coach" explanation (Gemini) appears below it once available.
 *
 * Props
 * - instantTip: short tip computed locally. Shown first whenever it is not empty.
 * - coachText: the Gemini explanation, if any.
 * - coachCached: true when coachText is a saved reply, not a fresh one. It is then labelled "(cached)".
 * - coachLoading: shows "Coach is thinking…" in place of coachText.
 * - onAskCoach: when given and there is no coachText yet, shows an "Ask Coach" button.
 *   This component does no fetching; the screen decides when to call the server and what it sends.
 */
export function CoachTip(props: {
  instantTip: string;
  coachText?: string;
  coachCached?: boolean;
  coachLoading?: boolean;
  onAskCoach?: () => void;
}) {
  const { instantTip, coachText, coachCached, coachLoading, onAskCoach } = props;
  return (
    <section className="coach" aria-label="Coaching">
      {instantTip && (
        <p className="coach-instant">
          <strong>Tip:</strong> {instantTip}
        </p>
      )}
      {coachLoading && <p className="coach-ai muted">Coach is thinking…</p>}
      {!coachLoading && coachText && (
        <p className="coach-ai">
          <strong>Coach{coachCached ? " (cached)" : ""}:</strong> {coachText}
        </p>
      )}
      {!coachLoading && !coachText && onAskCoach && (
        <button type="button" className="secondary" onClick={onAskCoach}>
          Ask Coach
        </button>
      )}
    </section>
  );
}
