import type { ReactNode } from "react";
import { motion } from "motion/react";
import { useReduceMotion } from "./MotionProvider";
import { motionTokens } from "./tokens";

/**
 * Short opacity fade when a screen mounts. Give it a `key` (the route) so it replays on navigation.
 * Opacity only: no movement, so the page never shifts under the pointer.
 * Enter only: no exit animation, so focus handling and layout are never delayed or shifted.
 * Under reduced motion it renders with no animation at all.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  const reduce = useReduceMotion();
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: motionTokens.duration.fast, ease: motionTokens.ease.out as unknown as [number, number, number, number] }}
    >
      {children}
    </motion.div>
  );
}
