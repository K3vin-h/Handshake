import { motion, useReducedMotion } from "motion/react";
import "./motion.css";

/**
 * Progress bar whose fill eases to the new value (scaleX, so no layout shift).
 * Semantics match a native <progress>: pass `label`, and show the number as text nearby.
 */
export function AnimatedProgress(props: { value: number; max: number; label: string; className?: string }) {
  const { value, max, label, className = "" } = props;
  const p = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  const reduce = useReducedMotion();
  return (
    <div
      className={`m-progress ${className}`}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
    >
      <motion.div
        className="m-progress-fill"
        initial={false}
        animate={{ scaleX: p }}
        transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 120, damping: 20 }}
      />
    </div>
  );
}
