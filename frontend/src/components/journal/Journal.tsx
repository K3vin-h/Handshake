import type { ReactNode } from "react";
import "./journal.css";

/** Notebook-style building blocks for the #/progress journal. Presentational only. */

export function Spread({ children }: { children: ReactNode }) {
  return <section className="jr-spread">{children}</section>;
}

export function Page({ side, label, title, number, ribbon, stain, children }: {
  side: "left" | "right"; label?: string; title?: string; number?: number; ribbon?: boolean; stain?: boolean; children?: ReactNode;
}) {
  return (
    <div className={`jr-page jr-page-${side}`}>
      {side === "left" && <div className="jr-holes" aria-hidden="true" />}
      {ribbon && <div className="jr-ribbon" aria-hidden="true" />}
      {label && <div className="jr-label">{label}</div>}
      {title && <h2 className="jr-title">{title}</h2>}
      <div className="jr-body">{children}</div>
      {stain && (
        <>
          <div className="jr-stain" aria-hidden="true" />
          <div className="jr-ripple" aria-hidden="true" />
        </>
      )}
      {number !== undefined && <span className="jr-num" aria-hidden="true">{number}</span>}
    </div>
  );
}

export function Stamp({ value, label }: { value: string | number; label: string }) {
  return (
    <span className="jr-stamp">
      <b>{value}</b>
      <span>{label}</span>
    </span>
  );
}

export function Sticker({ children }: { children: ReactNode }) {
  return <div className="jr-sticker">{children}</div>;
}

export function HandBar({ label, value, max, text, tone }: {
  label: string; value: number; max: number; text: string; tone?: "good" | "warn";
}) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div className="jr-row">
      <b className="jr-row-label">{label}</b>
      <div className="jr-bar" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max} aria-label={label} aria-valuetext={text}>
        <i className={tone === "warn" ? "jr-warn" : undefined} style={{ width: `${pct}%` }} />
      </div>
      <span className="jr-row-text">{text}</span>
    </div>
  );
}

export function Ink({ tone, children }: { tone: "good" | "smudge" | "plain"; children: ReactNode }) {
  return <span className={`jr-ink jr-ink-${tone}`}>{children}</span>;
}
