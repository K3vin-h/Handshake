import { useEffect, useRef, useState } from "react";
import { StatusMessage } from "../components/StatusMessage";
import { Button } from "@/components/ui/button";
import { buildCurriculum, flatLessons } from "../lib/curriculum";
import { requireProfile } from "../lib/requireProfile";
import { isUnlocked, loadProgress, nextLesson } from "../lib/progress";
import { ALPHABET, alphabetStates, newlyEarned, type LetterState } from "./alphabetState";

// "Your alphabet": all 26 letters after a lesson. Done = highlighted with a check, open = greyed out,
// locked = translucent with a chain-lock in the corner. Every state is also text (aria-label, check, lock icon),
// never colour alone. The pop on newly earned letters is skipped under prefers-reduced-motion (see styles.css).

const LABEL: Record<LetterState, string> = { done: "matches the reference", open: "unlocked, not done yet", locked: "locked" };

function Lock() {
  return (
    <svg className="alpha-lock" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
      <path d="M7 11V8a5 5 0 0 1 10 0v3" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <rect x="4.5" y="11" width="15" height="10" rx="2.5" fill="currentColor" />
      <path d="M2 14.5l3 1.5M22 14.5l-3 1.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function Alphabet({ lessonId }: { lessonId?: string }) {
  const heading = useRef<HTMLHeadingElement>(null);
  const [progress] = useState(loadProgress);
  const [units] = useState(() => buildCurriculum(requireProfile()).filter((u) => ["u1", "u2", "u3", "u4"].includes(u.id)));
  const lessons = flatLessons(units);
  const unlocked = new Set(lessons.filter((l) => isUnlocked(units, progress, l.id)).map((l) => l.id));
  const states = alphabetStates({ lessons, unlocked, completed: progress.completed, items: progress.items });
  const fresh = lessonId ? newlyEarned(lessons, lessonId, states) : [];
  const doneCount = ALPHABET.filter((l) => states[l] === "done").length;
  const next = nextLesson(units, progress);
  const nextOpen = next && isUnlocked(units, progress, next.id);

  useEffect(() => { heading.current?.focus(); }, []);

  return (
    <div className="page alphabet reward-dawn">
      <header className="hero">
        <p className="eyebrow">Your alphabet</p>
        <h1 ref={heading} tabIndex={-1}>{doneCount} of 26 letters</h1>
        <div className="alpha-bar" role="progressbar" aria-label="Letters done" aria-valuemin={0} aria-valuemax={26} aria-valuenow={doneCount}>
          <i style={{ "--p": doneCount / 26 } as React.CSSProperties} />
        </div>
      </header>

      {fresh.length > 0 && <StatusMessage kind="match" label="New letters" message={`You earned ${fresh.join(", ")}.`} />}

      <ol className="alpha-grid" aria-label="Alphabet">
        {ALPHABET.map((letter) => {
          const st = states[letter];
          const idx = fresh.indexOf(letter);
          return (
            <li
              key={letter}
              className={`alpha-box alpha-${st}${idx >= 0 ? " alpha-new" : ""}`}
              style={idx >= 0 ? ({ "--i": idx } as React.CSSProperties) : undefined}
              aria-label={`${letter}, ${LABEL[st]}`}
            >
              <span aria-hidden="true">{letter}</span>
              {st === "done" && <b className="alpha-check" aria-hidden="true">✓</b>}
              {st === "locked" && <Lock />}
            </li>
          );
        })}
      </ol>

      <div className="row">
        {nextOpen && (
          <Button asChild size="lg" className="h-12 rounded-2xl border-b-4 border-brand-deep">
            <a href={`#/lesson/${next.id}`}>Continue: {next.id} {next.title}</a>
          </Button>
        )}
        <Button asChild variant="outline" size="lg" className="h-12 rounded-2xl border-2">
          <a href="#/path">Back to levels</a>
        </Button>
      </div>
    </div>
  );
}
