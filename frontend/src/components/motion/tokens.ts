// Motion tokens (values per the animate skill). CSS twins live in styles.css (--ease-out, --dur-*).
export const motionTokens = {
  duration: { instant: 0.1, fast: 0.15, normal: 0.2, enter: 0.3 },
  ease: { out: [0.23, 1, 0.32, 1], inOut: [0.77, 0, 0.175, 1], drawer: [0.32, 0.72, 0, 1] },
  distance: { enter: 12, blur: 4 },
  stagger: { list: 0.05, stage: 0.1 },
  press: 0.96,
} as const;

export const springs = {
  ui: { type: "spring", duration: 0.3, bounce: 0 }, // nav pill, small layout moves
  layout: { type: "spring", duration: 0.45, bounce: 0 },
  pop: { type: "spring", duration: 0.5, bounce: 0.2 }, // success moments only
} as const;

type Bezier = [number, number, number, number];

/** Staged entrance for RARE moments (hero, first load, success): opacity + 4px blur + 12px rise. Reduced motion -> opacity only. */
export const enter = (index = 0, reduce = false) =>
  reduce
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: motionTokens.duration.fast } }
    : {
        initial: { opacity: 0, filter: "blur(4px)", transform: "translateY(12px)" },
        animate: { opacity: 1, filter: "blur(0px)", transform: "translateY(0px)" },
        transition: { duration: motionTokens.duration.enter, ease: motionTokens.ease.out as unknown as Bezier, delay: index * motionTokens.stagger.stage },
      };
