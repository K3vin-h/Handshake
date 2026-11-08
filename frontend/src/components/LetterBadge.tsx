import { MARK_LABEL, StatusMark, type MarkState } from "./StatusMark";

export type LetterStatus = MarkState;

/**
 * One letter with its status. The status is always a shape (StatusMark) plus a text label, never colour alone.
 *
 * Props
 * - letter: the letter or handshape id, e.g. "A" or "5".
 * - status: "mastered" | "practicing" | "not-started" | "reference-only" (image + how-to, no pass/fail).
 * - selected: highlights the badge (adds aria-current).
 * - onSelect: when given, the badge is a button (keyboard: Tab, Enter/Space).
 */
export function LetterBadge(props: { letter: string; status: LetterStatus; selected?: boolean; onSelect?: (letter: string) => void }) {
  const { letter, status, selected, onSelect } = props;
  const label = `Letter ${letter}, ${MARK_LABEL[status].toLowerCase()}`;
  const body = (
    <>
      <span className="badge-letter" aria-hidden="true">{letter}</span>
      <span className="badge-status">
        <StatusMark state={status} size={16} />
        {MARK_LABEL[status]}
      </span>
    </>
  );
  const cls = `badge badge-${status}${selected ? " is-selected" : ""}`;
  if (!onSelect) return <span className={cls} role="img" aria-label={label}>{body}</span>;
  return (
    <button type="button" className={cls} aria-label={label} aria-current={selected || undefined} onClick={() => onSelect(letter)}>
      {body}
    </button>
  );
}
