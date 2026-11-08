import { useMemo } from "react";
import { Page, Spread, Stamp, Sticker, HandBar, Ink } from "../components/journal/Journal";
import { buildCurriculum, flatLessons } from "../lib/curriculum";
import { requireProfile } from "../lib/requireProfile";
import { isUnlocked, loadProgress, nextLesson } from "../lib/progress";
import { ALPHABET, alphabetStates, type LetterState } from "./alphabetState";
import { loadMistakes } from "../lib/mistakes";
import { isPracticeable } from "../cv";
import { almostThere, boxCounts, fingerBars, kindCounts, letterBars, masteryCounts, reviewPlan, strongAndWeak, topMistake } from "./progressStats";

// Progress journal, spreads 1 (Overview) and 2 (How my tries went). Every number comes from localStorage via the
// progress code: no server call. Wording rule: "matches the reference", never "correct".

const FINGERS = ["thumb", "index", "middle", "ring", "pinky"];
const KINDS = ["curl", "direction", "placement"] as const;
const BOX_LABELS = ["today", "1 day", "3 days", "7 days", "14 days"];
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const list = (l: string[]) => (l.length > 1 ? `${l.slice(0, -1).join(", ")} and ${l[l.length - 1]}` : l[0]);

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

  const allItems = progress.items;
  // Signs, sentences and scenes ("HELLO", "scene:4.1") live in the same store; letter views only use A to Z.
  const items = Object.fromEntries(Object.entries(allItems).filter(([k]) => /^[A-Z]$/.test(k)));
  const all = Object.values(allItems);
  const tries = all.reduce((n, it) => n + it.attempts, 0);
  const matched = all.reduce((n, it) => n + Math.max(0, it.attempts - it.misses), 0);

  const lessons = flatLessons(units.filter((u) => ["u1", "u2", "u3", "u4"].includes(u.id)));
  const unlocked = new Set(lessons.filter((l) => isUnlocked(units, progress, l.id)).map((l) => l.id));
  const states = alphabetStates({ lessons, unlocked, completed: progress.completed, items });
  const doneCount = ALPHABET.filter((l) => states[l] === "done").length;

  const pages = lessons.filter((l) => progress.completed.includes(l.id) && l.teaches?.length);
  const bars = letterBars(items);
  const { strong, weak } = strongAndWeak(items);
  const { mastered, practicing } = masteryCounts(items);
  const almost = almostThere(items);
  const maxCount = Math.max(1, mastered, practicing);

  const mistakes = loadMistakes();
  const fingers = fingerBars(mistakes, FINGERS);
  const kinds = kindCounts(mistakes);
  const top = topMistake(mistakes);
  const maxFinger = Math.max(1, ...fingers.map((f) => f.count));
  const maxKind = Math.max(1, ...KINDS.map((k) => kinds[k]));
  const noMistakes = fingers.every((f) => f.count === 0);
  const plan = reviewPlan(items, Date.now());
  const boxes = boxCounts(items);
  const maxBox = Math.max(1, ...boxes);
  const statusOf = (l: string) => {
    const it = items[l];
    if (!isPracticeable(l)) return "Reference only";
    if (!it) return "Not started";
    return it.mastered ? "Mastered ✓" : `Practicing: ${Math.min(it.streak, 3)} of 3 in a row`;
  };
  const tableRows = (letters: string[], name: string) => (
    <div className="jr-table-wrap">
    <table className="jr-table" aria-label={name}>
      <thead>
        <tr><th scope="col">Letter</th><th scope="col">Status</th><th scope="col">Tries</th><th scope="col">Matched the reference</th></tr>
      </thead>
      <tbody>
        {letters.map((l) => {
          const it = items[l];
          return (
            <tr key={l}>
              <th scope="row">{l}</th>
              <td>{statusOf(l)}</td>
              <td>{it ? it.attempts : 0}</td>
              <td>{it && it.attempts > 0 ? `${Math.max(0, it.attempts - it.misses)} of ${it.attempts}` : "–"}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
    </div>
  );
  const coming: [string, string[]][] = [["Tomorrow", plan.tomorrow], ["In 3 days", plan.threeDays], ["In a week", plan.week], ["Later", plan.later]];

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
            <span style={{ "--p": demo.length ? lessonsDone / demo.length : 0 } as React.CSSProperties} />
          </div>
          <div className="jr-stamps">
            <Stamp value={progress.streakDays} label="day streak" />
            <Stamp value={progress.xp} label="XP" />
            <Stamp value={tries > 0 ? `${pct(matched, tries)}%` : "No tries yet"} label="matches the reference" />
          </div>
          <ul className="jr-log">
            {pages.map((l, i) => (
              <li key={l.id}>
                <Ink tone="plain">Page {i + 1} · {(l.teaches ?? []).join(" ")}</Ink>
              </li>
            ))}
            {pages.length === 0 && <li>Your first page is waiting. Finish a lesson to write it down.</li>}
          </ul>
        </Page>
        <Page side="right" label="Your alphabet" title={`Your alphabet · ${doneCount} of 26`} ribbon number={2}>
          <ol className="alpha-grid" aria-label="Alphabet">
            {ALPHABET.map((letter) => {
              const st = states[letter];
              return (
                <li key={letter} className={`alpha-box alpha-${st}`}>
                  <span aria-hidden="true">{letter}</span>
                  <span className="sr-only">{letter}, {LABEL[st]}</span>
                  {st === "done" && <b className="alpha-check" aria-hidden="true">✓</b>}
                  {st === "locked" && <Lock />}
                </li>
              );
            })}
          </ol>
          <p className="jr-next">
            {!next ? (
              <span>You finished every lesson that is available right now.</span>
            ) : nextOpen ? (
              <a href={`#/lesson/${next.id}`}>Practice next: {next.id} {next.title}</a>
            ) : (
              <span>Finish the lesson before to unlock {next.id}.</span>
            )}
          </p>
          {weak[0] && (
            <p>
              <Ink tone="smudge">{weak[0]} was hard · practice again</Ink>
            </p>
          )}
        </Page>
      </Spread>

      <Spread>
        <Page side="left" label="Tries" title="How my tries went" number={3}>
          {bars.length === 0 ? (
            <p className="muted">Nothing here yet. Practice a lesson and this page fills in.</p>
          ) : (
            <div className="jr-stack">
              {bars.map((b) => (
                <HandBar key={b.letter} label={b.letter} value={b.matched} max={b.attempts} text={`${b.matched} of ${b.attempts}`} tone={b.share < 0.6 ? "warn" : "good"} />
              ))}
            </div>
          )}
        </Page>
        <Page side="right" label="Standouts" title="Where I am" number={4}>
          <div className="jr-stack jr-stack-wide">
            <section aria-labelledby="jr-strong">
              <h3 id="jr-strong">Going well</h3>
              {strong.length ? (
                <p><Ink tone="good">{strong.join(", ")}</Ink>{" "}{strong.every((l) => items[l].mastered) ? "mastered: 3 in a row" : strong.some((l) => items[l].mastered) ? "mastered or matching the reference most of the time" : "matches the reference most of the time"}</p>
              ) : (
                <p className="muted">No standouts yet. A few more tries and they show up here.</p>
              )}
            </section>
            <section aria-labelledby="jr-weak">
              <h3 id="jr-weak">Needs another go</h3>
              {weak.length ? (
                <p><Ink tone="smudge">{weak.join(", ")}</Ink> could use another go.</p>
              ) : (
                <p className="muted">Nothing is giving you trouble right now.</p>
              )}
            </section>
            <div className="jr-stack">
              <HandBar label="Mastered" value={mastered} max={maxCount} text={String(mastered)} tone="good" />
              <HandBar label="Practicing" value={practicing} max={maxCount} text={String(practicing)} />
            </div>
            {almost && (
              <Sticker>{almost.letter} is {almost.need === 1 ? "1 away" : `${almost.need} away`} from mastered</Sticker>
            )}
          </div>
        </Page>
      </Spread>

      <details className="jr-more">
        <summary>More detail: fingers, review plan, every letter</summary>
      <Spread>
        <Page side="left" label="My hands" title="Which finger needs love" number={5}>
          {noMistakes ? (
            <p className="muted">No finger differences recorded yet. Practice a lesson and they will appear here.</p>
          ) : (
            <div className="jr-stack">
              {fingers.map((f) => (
                <HandBar key={f.finger} label={f.finger} value={f.count} max={maxFinger} text={plural(f.count, "difference", "differences")} tone={f.count === maxFinger ? "warn" : "good"} />
              ))}
            </div>
          )}
          <p className="jr-note">How often the camera measured each finger away from the reference. Fewer is better.</p>
        </Page>
        <Page side="right" label="Kinds of difference" title="Curl, direction, placement" number={6}>
          {noMistakes ? (
            <p className="muted">Nothing to sort yet.</p>
          ) : (
            <div className="jr-stack jr-stack-wide">
              <div className="jr-stack">
                {KINDS.map((k) => (
                  <HandBar key={k} label={k} value={kinds[k]} max={maxKind} text={plural(kinds[k], "difference", "differences")} />
                ))}
              </div>
              {top && <Sticker>Most often: {top.finger} finger {top.kind} on {list(top.letters)}</Sticker>}
            </div>
          )}
        </Page>
      </Spread>

      <Spread>
        <Page side="left" label="Review" title="Due today" number={7}>
          {plan.today.length ? (
            <>
              <ol className="jr-chips" aria-label="Letters due today">
                {plan.today.map((l) => (
                  <li key={l} className="alpha-box alpha-open">
                    <span aria-hidden="true">{l}</span>
                    <span className="sr-only">{l}, due today</span>
                  </li>
                ))}
              </ol>
              <p>{plan.today.length === 1 ? "1 letter is due for a quick review." : `${plan.today.length} letters are due for a quick review.`}</p>
            </>
          ) : (
            <p className="muted">Nothing is due today.</p>
          )}
          <section aria-labelledby="jr-coming">
            <h3 id="jr-coming">Coming up</h3>
            <ul className="jr-log">
              {coming.map(([when, letters]) => (
                <li key={when}><b>{when}</b>{" "}<Ink tone="plain">{letters.length ? letters.join(" ") : "—"}</Ink></li>
              ))}
            </ul>
          </section>
        </Page>
        <Page side="right" label="Spaced practice" title="The review boxes" number={8}>
          <ol className="jr-boxes" aria-label="Letters in each review box">
            {boxes.map((n, i) => (
              <li key={i} className="jr-box">
                <span className="jr-box-count">{plural(n, "letter", "letters")}</span>
                <span className="jr-box-bar" aria-hidden="true"><i style={{ height: `${(n / maxBox) * 100}%` }} /></span>
                <b>{BOX_LABELS[i]}</b>
              </li>
            ))}
          </ol>
          <p className="jr-note">A letter moves up a box each time it matches the reference, and drops back to today on a miss.</p>
        </Page>
      </Spread>

      <Spread>
        <Page side="left" label="Every letter" title="The full table" number={9}>
          {tableRows(ALPHABET.slice(0, 13), "Letters A to M")}
        </Page>
        <Page side="right" label="Every letter, continued" number={10}>
          {tableRows(ALPHABET.slice(13), "Letters N to Z")}
          <p className="jr-note">Mastered means matching the reference 3 times in a row. Reference-only letters have no pass or fail.</p>
        </Page>
      </Spread>
      </details>
    </div>
  );
}
