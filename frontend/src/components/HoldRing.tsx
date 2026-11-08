/**
 * Circular hold progress with the percentage as text in the middle.
 * It is a progressbar (read on demand), not a live region, so it does not chatter at screen readers
 * 20 times a second. Announce the result with <StatusMessage> instead.
 *
 * Props
 * - progress: 0..1 (clamped).
 * - label: what is being held, e.g. "Hold the L handshape". Used as the accessible name.
 * - size: pixel width/height (default 96).
 */
export function HoldRing(props: { progress: number; label?: string; size?: number }) {
  const { progress, label = "Hold progress", size = 96 } = props;
  const p = Math.max(0, Math.min(1, progress));
  const pct = Math.round(p * 100);
  const r = 42;
  const c = 2 * Math.PI * r;
  return (
    <div className="hold-ring" style={{ width: size, height: size }} role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
      <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true">
        <circle className="hold-ring-track" cx="50" cy="50" r={r} fill="none" strokeWidth="9" />
        <circle
          className="hold-ring-fill"
          cx="50"
          cy="50"
          r={r}
          fill="none"
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - p)}
          transform="rotate(-90 50 50)"
        />
      </svg>
      <span className="hold-ring-text">{pct}%</span>
    </div>
  );
}
