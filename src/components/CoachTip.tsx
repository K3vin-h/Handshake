import { useEffect, useRef, useState } from "react";

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
 *
 * Look: a card with a soft rotating "halo" glow (our own CSS, inspired by Cult UI's Halo Input) so new coaching is
 * hard to miss. When the tip or the coach text CHANGES the glow flares, the new text pops in and a "New" label shows for
 * a few seconds. "New" is real text, so it does not rely on colour or motion; the motion stops under prefers-reduced-motion
 * and the in-app "Reduce motion" switch. The card is an aria-live="polite" region, so a changed tip is announced.
 */
export function CoachTip(props: {
  instantTip: string;
  coachText?: string;
  coachCached?: boolean;
  coachLoading?: boolean;
  onAskCoach?: () => void;
}) {
  const { instantTip, coachText, coachCached, coachLoading, onAskCoach } = props;
  const hasContent = !!(instantTip || coachText || coachLoading || onAskCoach);

  // "Fresh" for a few seconds after the tip or the coach text changes to something new (not when it clears).
  const [fresh, setFresh] = useState(false);
  const last = useRef("");
  useEffect(() => {
    const now = `${instantTip}\u0000${coachText ?? ""}`;
    const changed = now !== last.current;
    last.current = now;
    if (!changed || !(instantTip || coachText)) return;
    setFresh(true);
    const t = setTimeout(() => setFresh(false), 5000);
    return () => clearTimeout(t);
  }, [instantTip, coachText]);

  return (
    <div className={`coach-halo${hasContent ? " is-active" : ""}${fresh ? " is-fresh" : ""}`}>
      <section className="coach" aria-label="Coaching" aria-live="polite">
        {fresh && <span className="coach-new">New</span>}
        {instantTip && (
          <p key={instantTip} className="coach-instant coach-pop">
            <strong className="coach-pill">Tip</strong> {instantTip}
          </p>
        )}
        {coachLoading && <p className="coach-ai muted">Coach is thinking…</p>}
        {!coachLoading && coachText && (
          <p key={coachText} className="coach-ai coach-pop">
            <strong className="coach-pill coach-pill-ai">Coach{coachCached ? " (cached)" : ""}</strong> {coachText}
          </p>
        )}
        {!coachLoading && !coachText && onAskCoach && (
          <button type="button" className="secondary" onClick={onAskCoach}>
            Ask Coach
          </button>
        )}
      </section>
    </div>
  );
}
