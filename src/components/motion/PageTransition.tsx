import type { ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";

/**
 * Short fade/slide-in when a screen mounts. Give it a `key` (the route) so it replays on navigation.
 * Enter only: no exit animation, so focus handling and layout are never delayed or shifted.
 * Under reduced motion it renders with no animation at all.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}
