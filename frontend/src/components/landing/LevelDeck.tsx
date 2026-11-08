import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type Ref } from "react";
import { AnimatePresence, animate, motion, useMotionValue, useTransform, type MotionValue, type PanInfo } from "motion/react";
import { MARK_LABEL, StatusMark, type MarkState } from "../StatusMark";
import { useReduceMotion } from "../motion/MotionProvider";
import "./landing.css";

export type LessonState = "locked" | "available" | "current" | "done";
export type DeckLesson = {
  id: string;
  title: string;
  summary: string;
  xp: number;
  state: LessonState;
  letters: { letter: string; status: MarkState; due: boolean }[];
};
export type UnitState = "done" | "current" | "ready" | "locked";
export type DeckUnit = {
  id: string;
  number: number;
  title: string;
  goal: string;
  state: UnitState;
  lessons: DeckLesson[];
  done: number;
  xp: number;
  /** A few short strings shown as art on the card (letters of a name, sign names). */
  art: string[];
  artKind: "tiles" | "bubbles";
};

const UNIT_STATE_TEXT: Record<UnitState, string> = { done: "Done", current: "You are here", ready: "Ready", locked: "Locked" };
const LESSON_STATE_TEXT: Record<LessonState, string> = { locked: "Locked", available: "Ready", current: "Up next", done: "Done" };
const GAP = 20;
const DRAG_BUFFER = 56;
const VELOCITY = 450;

/** Check, lock, arrow: tiny inline icons so state is never colour alone. */
function Glyph({ name }: { name: "check" | "lock" | "left" | "right" | "close" }) {
  const d = {
    check: "M5 12.5l4.5 4.5L19 7.5",
    lock: "M7 11V8a5 5 0 0 1 10 0v3M6 11h12v9H6z",
    left: "M14.5 5.5 8 12l6.5 6.5",
    right: "M9.5 5.5 16 12l-6.5 6.5",
    close: "M6 6l12 12M18 6 6 18",
  }[name];
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d={d} />
    </svg>
  );
}

function CardArt({ unit }: { unit: DeckUnit }) {
  if (unit.artKind === "bubbles") {
    return (
      <div className="lp-art lp-art-bubbles" aria-hidden="true">
        {unit.art.slice(0, 2).map((t, i) => (
          <span key={i} className={i === 0 ? "lp-bubble lp-bubble-them" : "lp-bubble lp-bubble-you"}>
            {t}
          </span>
        ))}
      </div>
    );
  }
  return (
    <div className="lp-art lp-art-tiles" aria-hidden="true">
      {unit.art.slice(0, 5).map((t, i) => (
        <span key={i} style={{ ["--r" as string]: `${[-6, 4, -3, 5, -4][i % 5]}deg` }}>
          {t}
        </span>
      ))}
    </div>
  );
}

/** One card in the swipe deck. Its tilt, scale and fade come from how far it sits from the centre. */
function DeckCard(props: {
  unit: DeckUnit;
  index: number;
  slot: number;
  x: MotionValue<number>;
  active: boolean;
  flat: boolean;
  width: number;
  onSelect(): void;
  onOpen(): void;
}) {
  const { unit, index, slot, x, active, flat, width, onSelect, onOpen } = props;
  const d = useTransform(x, (v) => (v + index * slot) / slot); // 0 = centred, +1 = one card to the right
  const rotateY = useTransform(d, [-1, 0, 1], flat ? [0, 0, 0] : [32, 0, -32]);
  const scale = useTransform(d, [-1, 0, 1], flat ? [1, 1, 1] : [0.9, 1, 0.9]);
  const opacity = useTransform(d, [-2, -1, 0, 1, 2], [0.3, 0.78, 1, 0.78, 0.3]);
  const pct = unit.lessons.length ? unit.done / unit.lessons.length : 0;
  return (
    <motion.li
      className={`lp-card lp-card-u${unit.number}${active ? " is-active" : ""}`}
      style={{ width, rotateY, scale, opacity }}
      // Side cards are only a preview. Clicking one centres it; keyboard users use the arrows or the dots.
      onClick={() => !active && onSelect()}
      // inert keeps the preview cards out of the tab order and the accessibility tree until they are centred.
      inert={!active}
    >
      <div className="lp-card-top">
        <span className="lp-card-num" aria-hidden="true">
          {unit.number}
        </span>
        <span className={`lp-card-state lp-state-${unit.state}`}>
          {unit.state === "done" && <Glyph name="check" />}
          {unit.state === "locked" && <Glyph name="lock" />}
          {UNIT_STATE_TEXT[unit.state]}
        </span>
      </div>
      <CardArt unit={unit} />
      <h3 className="lp-card-title">
        <span className="sr-only">Level {unit.number}: </span>
        {unit.title}
      </h3>
      <p className="lp-card-goal">{unit.goal}</p>
      <div className="lp-card-meter">
        <div className="lp-meter" role="progressbar" aria-label={`Level ${unit.number} progress`} aria-valuemin={0} aria-valuemax={unit.lessons.length} aria-valuenow={unit.done}>
          <motion.span initial={false} animate={{ scaleX: pct }} transition={flat ? { duration: 0 } : { type: "spring", stiffness: 120, damping: 20 }} />
        </div>
        <span>
          {unit.done} of {unit.lessons.length} lessons
        </span>
      </div>
      <button type="button" className="lp-card-open" onClick={onOpen} aria-haspopup="dialog">
        {unit.state === "locked" ? "Preview lessons" : unit.state === "done" ? "Practise again" : "Open lessons"}
        <span className="sr-only"> for level {unit.number}</span>
      </button>
    </motion.li>
  );
}

/** Lesson list for one level. A real dialog: Esc closes, Tab stays inside, focus returns to the opener. */
function UnitSheet(props: { unit: DeckUnit; onClose(): void; onLesson(id: string): void }) {
  const { unit, onClose, onLesson } = props;
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
      opener?.focus();
    };
  }, []);
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose();
    }
    if (e.key !== "Tab") return;
    const f = [...(ref.current?.querySelectorAll<HTMLElement>("button:not([disabled]), a[href]") ?? [])];
    if (!f.length) return;
    const first = f[0];
    const last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };
  return (
    <motion.div className="lp-sheet-wrap" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
      <div className="lp-sheet-scrim" onClick={onClose} aria-hidden="true" />
      <motion.div
        ref={ref}
        className={`lp-sheet lp-card-u${unit.number}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="lp-sheet-title"
        onKeyDown={onKey}
        initial={{ opacity: 0, y: 36, scale: 0.94 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.97 }}
        transition={{ type: "spring", stiffness: 320, damping: 28 }}
      >
        <header className="lp-sheet-head">
          <div>
            <p className="lp-sheet-kicker">
              Level {unit.number} · {UNIT_STATE_TEXT[unit.state]}
            </p>
            <h2 id="lp-sheet-title">{unit.title}</h2>
            <p className="lp-sheet-goal">{unit.goal}</p>
          </div>
          <button type="button" className="lp-close" onClick={onClose} data-autofocus aria-label="Close lessons">
            <Glyph name="close" />
          </button>
        </header>
        <ol className="lp-lessons">
          {unit.lessons.map((l) => {
            const locked = l.state === "locked";
            return (
              <li key={l.id}>
                <button
                  type="button"
                  className={`lp-lesson lp-lesson-${l.state}`}
                  aria-disabled={locked || undefined}
                  aria-current={l.state === "current" ? "step" : undefined}
                  onClick={() => !locked && onLesson(l.id)}
                >
                  <span className="lp-lesson-id" aria-hidden="true">
                    {l.state === "done" ? <Glyph name="check" /> : locked ? <Glyph name="lock" /> : l.id}
                  </span>
                  <span className="lp-lesson-body">
                    <strong>
                      <span className="sr-only">Lesson {l.id}: </span>
                      {l.title}
                    </strong>
                    <span className="lp-lesson-sum">{l.summary}</span>
                    {l.letters.length > 0 && (
                      <span className="lp-lesson-letters">
                        {l.letters.map((m) => (
                          <span key={m.letter}>
                            <StatusMark state={m.status} size={12} />
                            <b>{m.letter}</b>
                            <span className="sr-only"> {MARK_LABEL[m.status]}{m.due ? ", due for review" : ""}</span>
                          </span>
                        ))}
                      </span>
                    )}
                  </span>
                  <span className="lp-lesson-meta">
                    {LESSON_STATE_TEXT[l.state]}
                    <br />
                    {l.xp} XP
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
        {unit.state === "locked" && <p className="lp-sheet-note">Finish the lessons before this level to unlock it. You can look, but not start yet.</p>}
      </motion.div>
    </motion.div>
  );
}

/**
 * Swipeable deck of levels (patterned on the "Card Swipe" idea: velocity-aware drag, spring snap, tilted neighbours).
 * Switch levels by dragging, clicking a side card, the arrow buttons, the dots, or the Left/Right arrow keys:
 * dragging is never the only way. "Open lessons" opens a dialog with that level's lessons.
 * The announcement region says which level is centred. Tilt and drag easing are off under reduced motion.
 */
export function LevelDeck(props: { units: DeckUnit[]; initial: number; onLesson(id: string): void; id?: string; headingRef?: Ref<HTMLHeadingElement> }) {
  const { units, initial, onLesson } = props;
  const reduce = useReduceMotion();
  const [index, setIndex] = useState(initial);
  const [open, setOpen] = useState<DeckUnit | null>(null);
  const [vw, setVw] = useState(900);
  const viewport = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);

  useLayoutEffect(() => {
    const el = viewport.current;
    if (!el) return;
    const measure = () => setVw(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const width = Math.max(240, Math.min(360, vw - 64));
  const slot = width + GAP;
  const pad = (vw - width) / 2;

  const goTo = useCallback(
    (i: number, instant = false) => {
      const n = Math.max(0, Math.min(units.length - 1, i));
      setIndex(n);
      if (instant || reduce) x.set(-n * slot);
      else animate(x, -n * slot, { type: "spring", stiffness: 330, damping: 32 });
    },
    [reduce, slot, units.length, x],
  );

  // Re-centre when the card size changes (resize, first measure).
  useLayoutEffect(() => {
    x.set(-index * slot);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slot]);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    const { offset, velocity } = info;
    if (offset.x < -DRAG_BUFFER || velocity.x < -VELOCITY) goTo(index + 1);
    else if (offset.x > DRAG_BUFFER || velocity.x > VELOCITY) goTo(index - 1);
    else goTo(index);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowRight") { e.preventDefault(); goTo(index + 1); }
    if (e.key === "ArrowLeft") { e.preventDefault(); goTo(index - 1); }
  };

  const cur = units[index];
  return (
    <section className="lp-section lp-levels" id={props.id} aria-labelledby="lp-levels-title">
      <div className="lp-section-head">
        <h2 id="lp-levels-title" ref={props.headingRef} tabIndex={-1}>
          Choose a level
        </h2>
        <p className="muted">Drag the cards, use the arrows, or press the Left and Right keys. Open a level to see its lessons.</p>
      </div>

      <div className="lp-deck" role="group" aria-roledescription="carousel" aria-label="Levels">
        <div className="lp-viewport" ref={viewport} tabIndex={0} onKeyDown={onKey} aria-label="Levels. Use the Left and Right arrow keys to switch.">
          <motion.ul
            className="lp-track"
            style={{ x, paddingLeft: pad, gap: GAP }}
            drag="x"
            dragConstraints={{ left: -(units.length - 1) * slot, right: 0 }}
            dragElastic={reduce ? 0 : 0.14}
            dragMomentum={false}
            onDragEnd={onDragEnd}
          >
            {units.map((u, i) => (
              <DeckCard key={u.id} unit={u} index={i} slot={slot} x={x} active={i === index} flat={reduce} width={width} onSelect={() => goTo(i)} onOpen={() => setOpen(u)} />
            ))}
          </motion.ul>
        </div>

        <div className="lp-deck-nav">
          <button type="button" className="lp-arrow" onClick={() => goTo(index - 1)} disabled={index === 0} aria-label="Previous level">
            <Glyph name="left" />
          </button>
          <ol className="lp-dots">
            {units.map((u, i) => (
              <li key={u.id}>
                <button type="button" className="lp-dot" onClick={() => goTo(i)} aria-current={i === index || undefined} aria-label={`Level ${u.number}: ${u.title}`}>
                  <span aria-hidden="true">{u.number}</span>
                </button>
              </li>
            ))}
          </ol>
          <button type="button" className="lp-arrow" onClick={() => goTo(index + 1)} disabled={index === units.length - 1} aria-label="Next level">
            <Glyph name="right" />
          </button>
        </div>
        <p className="sr-only" role="status" aria-live="polite">
          Level {cur.number} of {units.length}: {cur.title}. {UNIT_STATE_TEXT[cur.state]}. {cur.done} of {cur.lessons.length} lessons done.
        </p>
      </div>

      <AnimatePresence>{open && <UnitSheet key={open.id} unit={open} onClose={() => setOpen(null)} onLesson={(id) => { setOpen(null); onLesson(id); }} />}</AnimatePresence>
    </section>
  );
}
