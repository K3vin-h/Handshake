/**
 * A unit that is not available yet. Nothing in it is presented as working.
 *
 * Props
 * - title: unit title, e.g. "Unit 3 · Greetings and sentences".
 * - note: optional one-line description. Do not describe it as functional.
 * - label: status text, default "Coming later".
 * Not interactive on purpose: no buttons, no links.
 */
export function LockedUnit(props: { title: string; note?: string; label?: string }) {
  const { title, note, label = "Coming later" } = props;
  return (
    <section className="locked-unit" aria-label={`${title}, ${label.toLowerCase()}`}>
      <h3>{title}</h3>
      <p className="locked-unit-label">
        <span aria-hidden="true">🔒 </span>
        {label}
      </p>
      {note && <p className="muted">{note}</p>}
    </section>
  );
}
