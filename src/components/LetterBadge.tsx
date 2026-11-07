export type LetterStatus = "live" | "reference-only" | "locked" | "mastered";

const LABEL: Record<LetterStatus, string> = {
  live: "Live",
  "reference-only": "Reference only",
  locked: "Locked",
  mastered: "Mastered",
};
const ICON: Record<LetterStatus, string> = { live: "●", "reference-only": "○", locked: "🔒", mastered: "✓" };

/**
 * One letter with its status. The status is always shown as text and an icon, never colour alone.
 *
 * Props
 * - letter: the letter or handshape id, e.g. "A" or "5".
 * - status: "live" (real pass/fail) | "reference-only" (image + how-to, no pass/fail) | "locked" | "mastered".
 * - selected: highlights the badge (adds aria-current).
 * - onSelect: when given, the badge is a button (keyboard: Tab, Enter/Space). Locked badges stay focusable
 *   but do nothing (aria-disabled), so keyboard users can still read why.
 */
export function LetterBadge(props: { letter: string; status: LetterStatus; selected?: boolean; onSelect?: (letter: string) => void }) {
  const { letter, status, selected, onSelect } = props;
  const label = `Letter ${letter}, ${LABEL[status].toLowerCase()}`;
  const body = (
    <>
      <span className="badge-letter" aria-hidden="true">{letter}</span>
      <span className="badge-status">
        <span aria-hidden="true">{ICON[status]} </span>
        {LABEL[status]}
      </span>
    </>
  );
  const cls = `badge badge-${status}${selected ? " is-selected" : ""}`;
  if (!onSelect) {
    return <span className={cls} role="img" aria-label={label}>{body}</span>;
  }
  return (
    <button
      type="button"
      className={cls}
      aria-label={label}
      aria-disabled={status === "locked" || undefined}
      aria-current={selected || undefined}
      onClick={() => status !== "locked" && onSelect(letter)}
    >
      {body}
    </button>
  );
}
