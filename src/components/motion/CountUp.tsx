import { useEffect, useRef } from "react";
import { animate, useReducedMotion } from "motion/react";

/**
 * Number that counts from its previous value to `value`. The DOM text is always the final
 * value in React's eyes, so screen readers and reduced-motion users get the number immediately.
 */
export function CountUp({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const prev = useRef(value);
  const reduce = useReducedMotion();
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reduce || prev.current === value) {
      el.textContent = String(value);
      prev.current = value;
      return;
    }
    const controls = animate(prev.current, value, {
      duration: 0.6,
      ease: "easeOut",
      onUpdate: (v) => { el.textContent = String(Math.round(v)); },
      onComplete: () => { el.textContent = String(value); },
    });
    prev.current = value;
    return () => controls.stop();
  }, [value, reduce]);
  return <span ref={ref} className="m-count">{value}</span>;
}
