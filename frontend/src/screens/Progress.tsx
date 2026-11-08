import { useMemo } from "react";
import { Page, Spread, Stamp, Sticker, HandBar, Ink } from "../components/journal/Journal";
import { buildCurriculum, flatLessons } from "../lib/curriculum";
import { requireProfile } from "../lib/requireProfile";
import { isUnlocked, loadProgress, nextLesson } from "../lib/progress";
import { ALPHABET, alphabetStates, type LetterState } from "./alphabetState";
import { almostThere, letterBars, masteryCounts, strongAndWeak } from "./progressStats";

// Progress journal, spreads 1 (Overview) and 2 (How my tries went). Every number comes from localStorage via the
// progress code: no server call. Wording rule: "matches the reference", never "correct".

const pct = (n: number, of: number) => Math.round((n / of) * 100);
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

export function ProgressScreen() {
  const profile = requireProfile();
  const progress = loadProgress();
  const units = useMemo(() => buildCurriculum(profile), []); // eslint-disable-line react-hooks/exhaustive-deps

  const demo = units.flatMap((u) => u.lessons).filter((l) => l.scope === "demo");
  const lessonsDone = demo.filter((l) => progress.completed.includes(l.id)).length;
  const next = nextLesson(units, progress);
  const nextOpen = next && isUnlocked(units, progress, next.id);

  const items = progress.items;
  const all = Object.values(items);
  const tries = all.reduce((n, it) => n + it.attempts, 0);
  const matched = all.reduce((n, it) => n + Math.max(0, it.attempts - it.misses), 0);

  const lessons = flatLessons(units.filter((u) => ["u1", "u2", "u3", "u4"].includes(u.id)));
  const unlocked = new Set(lessons.filter((l) => isUnlocked(units, progress, l.id)).map((l) => l.id));
  const states = alphabetStates({ lessons, unlocked, completed: progress.completed, items });
  const doneCount = ALPHABET.filter((l) => states[l] === "done").length;

  const pages = lessons.filter((l) => progress.completed.includes(l.id) && l.teaches?.length);
  const bars = letterBars(items);
  const { strong, weak } = strongAndWeak(items);
  const { mastered, practising } = masteryCounts(items);
  const almost = almostThere(items);
  const maxCount = Math.max(1, mastered, practising);

  return (
    <div className="page progress-page reward-dawn">
      <Spread>
        <Page side="left" label="My ASL notebook" number={1}>
          <h1 className="jr-title" id="prog-title">{`${lessonsDone} of ${demo.length} lessons done`}</h1>
          <div
            className="focus-bar"
            role="progressbar"
            aria-label="Lessons done"
            aria-valuemin={0}
            aria-valuemax={demo.length}
            aria-valuenow={lessonsDone}
            aria-valuetext={`${lessonsDone} of ${demo.length} lessons`}
          >
            <span style={{ width: `${demo.length ? pct(lessonsDone, demo.length) : 0}%` }} />
          </div>
          <div className="jr-stamps" style={{ display: "flex", flexWrap: "wrap", gap: "1rem", margin: "1.5rem 0" }}>
            <Stamp value={progress.streakDays} label={progress.streakDays === 1 ? "day streak" : "day streak"} />
            <Stamp value={progress.xp} label="XP" />
            <Stamp value={tries > 0 ? `${pct(matched, tries)}%` : "No tries yet"} label="matches the reference" />
          </div>
          <ul className="plain-list" style={{ display: "grid", gap: "0.75rem" }}>
            {pages.map((l, i) => (
              <li key={l.id}>
                <Ink tone="plain">Page {i + 1} · {(l.teaches ?? []).join(" ")}</Ink>
              </li>
            ))}
            <li aria-hidden="true" style={{ filter: "blur(3px)", opacity: 0.6 }}>
              <Ink tone="smudge">Page {pages.length + 1} · next</Ink>
            </li>
          </ul>
        </Page>
        <Page side="right" label="Your alphabet" title={`Your alphabet · ${doneCount} of 26`} ribbon number={2}>
          <ol className="alpha-grid" aria-label="Alphabet">
            {ALPHABET.map((letter) => {
              const st = states[letter];
              return (
                <li key={letter} className={`alpha-box alpha-${st}`} aria-label={`${letter}, ${LABEL[st]}`}>
                  <span aria-hidden="true">{letter}</span>
                  {st === "done" && <b className="alpha-check" aria-hidden="true">✓</b>}
                  {st === "locked" && <Lock />}
                </li>
              );
            })}
          </ol>
          <p style={{ marginTop: "1.5rem" }}>
            {next && nextOpen ? (
              <a href={`#/lesson/${next.id}`}>Practise next: {next.id} {next.title}</a>
            ) : (
              <span>You finished every lesson that is available right now.</span>
            )}
          </p>
          {weak[0] && (
            <p>
              <Ink tone="smudge">{weak[0]} was hard · practise again</Ink>
            </p>
          )}
        </Page>
      </Spread>

      <Spread>
        <Page side="left" label="Tries" title="How my tries went" number={3}>
          {bars.length === 0 ? (
            <p className="muted">Nothing here yet. Practise a lesson and this page fills in.</p>
          ) : (
            <div style={{ display: "grid", gap: "0.9rem" }}>
              {bars.map((b) => (
                <HandBar key={b.letter} label={b.letter} value={b.matched} max={b.attempts} text={`${b.matched} of ${b.attempts}`} tone={b.share < 0.6 ? "warn" : "good"} />
              ))}
            </div>
          )}
        </Page>
        <Page side="right" label="Going well" title="Where I am" number={4}>
          <div style={{ display: "grid", gap: "1.5rem" }}>
            <section aria-label="Going well">
              <h3>Going well</h3>
              {strong.length ? (
                <p>{strong.map((l) => <Ink key={l} tone="good">{l} </Ink>)} matches the reference most of the time.</p>
              ) : (
                <p className="muted">No standouts yet. A few more tries and they show up here.</p>
              )}
            </section>
            <section aria-label="Needs another go">
              <h3>Needs another go</h3>
              {weak.length ? (
                <p>{weak.map((l) => <Ink key={l} tone="smudge">{l} </Ink>)} could use another go.</p>
              ) : (
                <p className="muted">Nothing is giving you trouble right now.</p>
              )}
            </section>
            <div style={{ display: "grid", gap: "0.9rem" }}>
              <HandBar label="Mastered" value={mastered} max={maxCount} text={String(mastered)} tone="good" />
              <HandBar label="Practising" value={practising} max={maxCount} text={String(practising)} />
            </div>
            {almost && (
              <Sticker>{almost.letter} is {almost.need === 1 ? "1 away" : `${almost.need} away`} from mastered</Sticker>
            )}
          </div>
        </Page>
      </Spread>
    </div>
  );
}
