export type PathNodeState = "locked" | "available" | "current" | "done";

const LABEL: Record<PathNodeState, string> = { locked: "Locked", available: "Ready", current: "Up next", done: "Done" };
const ICON: Record<PathNodeState, string> = { locked: "🔒", available: "○", current: "▶", done: "✓" };

/**
 * One lesson on the path. State is text + icon, never colour alone.
 *
 * Props
 * - id: lesson id, e.g. "1.1".
 * - title: lesson title.
 * - state: "locked" | "available" | "current" | "done".
 * - xp: optional XP reward, shown as text.
 * - onOpen: called on click / Enter / Space (not for locked nodes). Locked nodes stay focusable
 *   (aria-disabled) so keyboard users can reach and read them.
 */
export function PathNode(props: { id: string; title: string; state: PathNodeState; xp?: number; onOpen?: (id: string) => void }) {
  const { id, title, state, xp, onOpen } = props;
  return (
    <button
      type="button"
      className={`path-node path-node-${state}`}
      aria-disabled={state === "locked" || undefined}
      aria-current={state === "current" ? "step" : undefined}
      onClick={() => state !== "locked" && onOpen?.(id)}
    >
      <span className="path-node-id">{id}</span>
      <span className="path-node-title">{title}</span>
      <span className="path-node-state">
        <span aria-hidden="true">{ICON[state]} </span>
        {LABEL[state]}
        {xp !== undefined && <span> · {xp} XP</span>}
      </span>
    </button>
  );
}
