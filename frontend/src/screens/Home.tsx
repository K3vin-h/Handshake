import { useEffect, useMemo } from "react";
import { isPracticeable } from "../cv";
import type { MarkState } from "../components/StatusMark";
import { coverage } from "../components/LiveCoverage";
import { Hero, type HeroLetter } from "../components/landing/Hero";
import { LevelsCard } from "../components/landing/LevelsCard";
import { StatusPanel } from "../components/landing/StatusPanel";
import { LevelDeck, type DeckLesson, type DeckUnit, type LessonState, type UnitState } from "../components/landing/LevelDeck";
import { buildCurriculum } from "../lib/curriculum";
import { loadProfile, type Profile } from "../lib/profile";
import { dueItems, isUnlocked, loadProgress, nextLesson } from "../lib/progress";

// Home = the landing page: a big title for the person you are learning for, your progress, and a deck of levels.
// Units 1-4 are active (demo lessons only). Reads the profile and progress from localStorage only.

const ART: Record<string, { art: (p: { me: string }) => string[]; kind: "tiles" | "bubbles" }> = {
  u1: { art: ({ me }) => [...me.toUpperCase()].filter((c) => /[A-Z]/.test(c)).slice(0, 12), kind: "tiles" },
  u2: { art: () => ["A", "B", "C", "D", "E"], kind: "tiles" },
  u3: { art: () => ["HELLO", "BYE"], kind: "bubbles" },
  u4: { art: () => ["HELLO", "MY NAME…"], kind: "bubbles" },
};

/** The names come from onboarding only. With no saved profile there is nothing to show, so send the learner to the welcome steps. */
export function Home() {
  const profile = loadProfile();
  useEffect(() => {
    if (!profile) location.hash = "#/welcome";
  }, [profile]);
  return profile ? <HomeInner profile={profile} /> : null;
}

function HomeInner({ profile }: { profile: Profile }) {
  const units = useMemo(() => buildCurriculum(profile), []); // eslint-disable-line react-hooks/exhaustive-deps
  const progress = loadProgress();
  const next = nextLesson(units, progress);
  const dueSet = new Set(dueItems(progress));

  const letterStatus = (l: string): MarkState => {
    if (!isPracticeable(l)) return "reference-only";
    const it = progress.items[l];
    return it?.mastered ? "mastered" : it && it.attempts > 0 ? "practising" : "not-started";
  };
  const stateOf = (id: string): LessonState => {
    if (progress.completed.includes(id)) return "done";
    if (next?.id === id) return "current";
    return isUnlocked(units, progress, id) ? "available" : "locked";
  };
  const open = (id: string) => (location.hash = `#/lesson/${id}`);

  // Only demo lessons are shown (stretch lessons stay out of the path, as before).
  const deckUnits: DeckUnit[] = units.slice(0, 4).map((u, i) => {
    const lessons: DeckLesson[] = u.lessons
      .filter((l) => l.scope === "demo")
      .map((l) => {
        const spell = l.title.match(/^Spell (.+)$/i)?.[1];
        const c = spell ? coverage(spell, isPracticeable) : null;
        const letters = (l.teaches ?? []).filter((x) => /^[A-Z]$/.test(x)).map((x) => ({ letter: x, status: letterStatus(x), due: dueSet.has(x) }));
        return {
          id: l.id,
          title: l.title,
          summary: c && c.total > 0 ? `${l.summary} ${spell!.toUpperCase()}: ${c.liveCount} of ${c.total} letters have a camera check.` : l.summary,
          xp: l.xp,
          state: stateOf(l.id),
          letters,
        };
      });
    const done = lessons.filter((l) => l.state === "done").length;
    const state: UnitState =
      lessons.length > 0 && done === lessons.length ? "done" : lessons.some((l) => l.state === "current") ? "current" : lessons[0]?.state === "locked" ? "locked" : "ready";
    const a = ART[u.id] ?? ART.u2;
    return {
      id: u.id,
      number: i + 1,
      title: u.title,
      goal: u.goal,
      state,
      lessons,
      done,
      xp: lessons.reduce((n, l) => n + l.xp, 0),
      art: a.art({ me: profile.userName }),
      artKind: a.kind,
    };
  });
  const startUnit = Math.max(0, deckUnits.findIndex((u) => u.state === "current"));

  // The hero spells the app's name, one tile per letter, each with the learner's status for that letter.
  const letters: HeroLetter[] = [..."HANDSHAKE"].map((c) => ({ letter: c, status: letterStatus(c) }));

  const started = progress.completed.length > 0 || Object.keys(progress.items).length > 0;

  const toPath = () => (location.hash = "#/path");
  const curUnit = deckUnits[startUnit];

  return (
    <div className="page home lp">
      <Hero
        letters={letters}
        cta={next ? { label: started ? `Continue: ${next.title}` : `Start lesson ${next.id}`, onClick: toPath } : null}
        onSeeLevels={toPath}
      />
      <div className="lp-duo">
        <StatusPanel
          levels={deckUnits.map((u) => ({ number: u.number, title: u.title, done: u.done, total: u.lessons.length }))}
          timeline={deckUnits.flatMap((u) => u.lessons.map((l) => ({ id: l.id, title: l.title, level: u.number, state: l.state })))}
          xp={progress.xp}
          streak={progress.streakDays}
          due={dueSet.size}
          started={started}
          onStart={open}
        />
        <LevelsCard unitNumber={curUnit.number} unitTitle={curUnit.title} lessons={curUnit.lessons.map((l) => ({ id: l.id, state: l.state }))} onOpen={toPath} />
      </div>
      <LevelDeck units={deckUnits} initial={startUnit} onLesson={open} />
    </div>
  );
}
