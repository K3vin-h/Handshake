import { LetterBadge, type LetterStatus } from "./LetterBadge";

/** Distinct letters of a name, A–Z only, upper-case, in order of first appearance. */
export function nameLetters(name: string): string[] {
  const seen: string[] = [];
  for (const ch of name.toUpperCase()) if (/[A-Z]/.test(ch) && !seen.includes(ch)) seen.push(ch);
  return seen;
}

/**
 * Coverage of a name, counted per letter of the name (LILY = 4 letters, so "4 of 4").
 * `letters` is the distinct set, used to show one badge per letter.
 */
export function coverage(name: string, isLive: (letter: string) => boolean) {
  const all = [...name.toUpperCase()].filter((ch) => /[A-Z]/.test(ch));
  return { letters: nameLetters(name), total: all.length, liveCount: all.filter(isLive).length };
}

/**
 * Shows how much of a name can be graded live, e.g. "LILY: 4 of 4 live" (counted per letter of the name; one badge per distinct letter).
 * Letters that are not live are listed as "reference only" so nobody expects a pass/fail on them.
 *
 * Props
 * - name: the name as entered (any case). Nothing is sent anywhere; this is pure display.
 * - isLive: (letter) => boolean. Pass `isPracticeable` from "src/cv" in screens; pass a fake in demos.
 * - stateOf: optional (letter) => "mastered" | "practising" | "not-started" for live letters (e.g. from progress).
 *   Default is "not-started". Letters that are not live are always "reference-only".
 */
export function LiveCoverage(props: { name: string; isLive: (letter: string) => boolean; stateOf?: (letter: string) => Exclude<LetterStatus, "reference-only"> }) {
  const { name, isLive, stateOf } = props;
  const c = coverage(name, isLive);
  if (c.total === 0) return <p className="muted">Type a name to see which letters are live.</p>;
  const allLive = c.liveCount === c.total;
  return (
    <div className="live-coverage">
      <p>
        <strong>
          {name.trim().toUpperCase()}: {c.liveCount} of {c.total} live
        </strong>
        {!allLive && <span className="muted"> · {c.total - c.liveCount} of its letters are reference only (no pass/fail)</span>}
      </p>
      <div className="chip-row">
        {c.letters.map((l) => (
          <LetterBadge key={l} letter={l} status={isLive(l) ? (stateOf?.(l) ?? "not-started") : "reference-only"} />
        ))}
      </div>
    </div>
  );
}
