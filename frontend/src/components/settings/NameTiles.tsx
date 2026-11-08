import { motion } from "motion/react";
import { useReduceMotion } from "../motion/MotionProvider";
import { motionTokens } from "../motion/tokens";
import "./settings.css";

const MAX_TILES = 8;
const TILT = [-4, 3, -2, 4, -3, 2, -1, 3]; // static tilt in degrees, same idea as the Home tiles

/** Letters A-Z of a name, upper-cased; everything else is ignored. */
export const nameLetters = (name: string) => name.toUpperCase().match(/[A-Z]/g) ?? [];

/**
 * A name spelled as letter tiles (decorative; the list carries the full name as its label).
 * Tiles rise in once with a 50 ms stagger. Reduced motion: opacity only.
 */
export function NameTiles({ name, label }: { name: string; label: string }) {
  const reduce = useReduceMotion();
  const all = nameLetters(name);
  const shown = all.slice(0, MAX_TILES);
  const more = all.length > MAX_TILES;
  const rise = (i: number) => ({
    initial: reduce ? { opacity: 0 } : { opacity: 0, transform: `translateY(${motionTokens.distance.enter}px)` },
    animate: reduce ? { opacity: 1 } : { opacity: 1, transform: "translateY(0px)" },
    transition: { duration: reduce ? motionTokens.duration.fast : motionTokens.duration.enter, ease: motionTokens.ease.out as unknown as [number, number, number, number], delay: i * motionTokens.stagger.list },
  });
  return (
    <div className="set-person">
      <p className="set-person-label">{label}</p>
      {all.length === 0 ? (
        <p className="set-name-plain">{name}</p>
      ) : (
        <div className="set-tiles" role="img" aria-label={`${label}: ${name}`}>
          {shown.map((l, i) => (
            <motion.span key={`${l}-${i}`} className="set-tile" aria-hidden="true" style={{ ["--r" as string]: `${TILT[i % TILT.length]}deg` }} {...rise(i)}>
              {l}
            </motion.span>
          ))}
          {more && (
            <motion.span className="set-tile set-tile-more" aria-hidden="true" {...rise(shown.length)}>
              …
            </motion.span>
          )}
        </div>
      )}
    </div>
  );
}
