import type { ReactNode } from "react";
import { MotionConfig } from "motion/react";

/** Wraps the app so every motion component honours the OS "reduce motion" setting. */
export function MotionProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
