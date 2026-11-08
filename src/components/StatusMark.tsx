export type MarkState = "mastered" | "practising" | "not-started" | "reference-only";

export const MARK_LABEL: Record<MarkState, string> = {
  mastered: "Mastered",
  practising: "Practising",
  "not-started": "Not started",
  "reference-only": "Reference only",
};

/**
 * The one status symbol used everywhere (letters, lessons, badges). The SHAPE differs per state, so it never
 * depends on colour, and every use must sit next to its text label (MARK_LABEL).
 *
 * - mastered: filled accent circle with a check
 * - practising: accent ring, half filled
 * - not-started: plain neutral outline ring (never green)
 * - reference-only: dashed grey ring
 *
 * Props
 * - state: MarkState.
 * - size: pixels, default 20.
 * Decorative: aria-hidden. The adjacent text carries the meaning.
 */
export function StatusMark({ state, size = 20 }: { state: MarkState; size?: number }) {
  return (
    <svg className={`mark mark-${state}`} viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false">
      {state === "mastered" && (
        <>
          <circle cx="12" cy="12" r="10" className="mark-fill" />
          <path d="M7.5 12.5l3 3 6-6.5" className="mark-check" fill="none" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
      {state === "practising" && (
        <>
          <circle cx="12" cy="12" r="9" className="mark-ring" fill="none" strokeWidth="2.4" />
          <path d="M12 3a9 9 0 0 0 0 18z" className="mark-half" />
        </>
      )}
      {state === "not-started" && <circle cx="12" cy="12" r="9" className="mark-outline" fill="none" strokeWidth="2.4" />}
      {state === "reference-only" && <circle cx="12" cy="12" r="9" className="mark-dashed" fill="none" strokeWidth="2.4" strokeDasharray="3.4 3.4" />}
    </svg>
  );
}
