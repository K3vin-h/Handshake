import { useEffect, useRef } from "react";
import { motion } from "motion/react";
import "./LessonNotice.css";
import { enter } from "./motion/tokens";
import { useReduceMotion } from "./motion/MotionProvider";

type Action = { label: string; onClick(): void };
export type LessonNoticeProps = {
  title: string; message: string; primary: Action; secondary?: Action;
  links?: { href: string; label: string }[]; footnote?: string;
};

export function LessonNotice({ title, message, primary, secondary, links = [], footnote }: LessonNoticeProps) {
  const heading = useRef<HTMLHeadingElement>(null);
  const reduce = useReduceMotion();
  useEffect(() => heading.current?.focus({ preventScroll: true }), []);
  return (
    <div className="page">
      <motion.section className="notice" {...enter(0, reduce)} aria-labelledby="notice-title">
        <h1 id="notice-title" ref={heading} tabIndex={-1}>{title}</h1>
        <p role="status">{message}</p>
        <div className="notice-actions">
          <button type="button" className="notice-primary" onClick={primary.onClick}>{primary.label}</button>
          {secondary && <button type="button" className="secondary notice-secondary" onClick={secondary.onClick}>{secondary.label}</button>}
        </div>
        {links.length > 0 && <p className="notice-links">{links.map((l) => <a key={l.href} href={l.href}>{l.label}</a>)}</p>}
        {footnote && <p className="muted small">{footnote}</p>}
      </motion.section>
    </div>
  );
}
