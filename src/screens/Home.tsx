import { useMemo } from "react";
import { isPracticeable } from "../cv";
import { LiveCoverage } from "../components/LiveCoverage";
import { LockedUnit } from "../components/LockedUnit";
import { UnitSection, type MapLesson } from "../components/PathMap";
import { StatusBadge } from "../components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buildCurriculum } from "../lib/curriculum";
import { DEMO_PROFILE, WELCOME, fillNames, loadProfile } from "../lib/profile";
import { dueItems, isUnlocked, loadProgress, nextLesson, weakItems } from "../lib/progress";

// Home: the path. Units 1-2 are active; Units 3-4 are locked ("Coming later").
// Reads the profile and progress from localStorage only.

export function Home() {
  const profile = loadProfile() ?? DEMO_PROFILE;
  const units = useMemo(() => buildCurriculum(profile), []); // eslint-disable-line react-hooks/exhaustive-deps
  const progress = loadProgress();
  const next = nextLesson(units, progress);
  const weak = weakItems(progress);
  const due = dueItems(progress).length;

  const stateOf = (id: string): MapLesson["state"] => {
    if (progress.completed.includes(id)) return "done";
    if (next?.id === id) return "current";
    return isUnlocked(units, progress, id) ? "available" : "locked";
  };
  const open = (id: string) => (location.hash = `#/lesson/${id}`);
  const themKey = profile.theirName.toUpperCase().replace(/[^A-Z]/g, "");
  const spellThem = units.flatMap((u) => u.lessons).find((l) => l.title.toUpperCase() === `SPELL ${themKey}`);
  const spellOpen = spellThem ? isUnlocked(units, progress, spellThem.id) : false;

  return (
    <div className="page home">
      <header className="hero">
        <p className="eyebrow">Your path</p>
        <h1>{fillNames(WELCOME, profile)}</h1>
        {next ? (
          <div className="row">
            <Button size="lg" className="h-12 rounded-2xl border-b-4 border-brand-deep px-7 text-base" onClick={() => open(next.id)}>
              Continue: {next.id} {next.title}
            </Button>
            <Button asChild variant="outline" size="lg" className="h-12 rounded-2xl border-2">
              <a href="#/progress">See progress</a>
            </Button>
          </div>
        ) : (
          <p className="lead">You have finished every lesson that is available right now.</p>
        )}
      </header>

      <section className="feature-tiles" aria-label="Where to go">
        {next && (
          <a className="feature-tile" href={`#/lesson/${next.id}`}>
            <span className="feature-eyebrow">Lessons</span>
            <strong>{next.title}</strong>
            <span className="muted small">Lesson {next.id} · {next.xp} XP</span>
          </a>
        )}
        <a className="feature-tile" href="#/progress">
          <span className="feature-eyebrow">Progress</span>
          <strong>Your alphabet</strong>
          <span className="muted small">{progress.completed.length} lessons done · {progress.xp} XP</span>
        </a>
        {spellThem && (spellOpen ? (
          <a className="feature-tile" href={`#/lesson/${spellThem.id}`}>
            <span className="feature-eyebrow">Their name</span>
            <strong>{spellThem.title}</strong>
            <span className="muted small">Lesson {spellThem.id}</span>
          </a>
        ) : (
          <div className="feature-tile is-locked" aria-disabled="true">
            <span className="feature-eyebrow">Their name</span>
            <strong>{spellThem.title}</strong>
            <span className="muted small">Locked until you finish the lessons before it</span>
          </div>
        ))}
        <a className="feature-tile" href="#/stats">
          <span className="feature-eyebrow">Stats</span>
          <strong>Accuracy and your plan</strong>
          <span className="muted small">Charts and today's practice plan</span>
        </a>
        <a className="feature-tile" href="#/welcome">
          <span className="feature-eyebrow">Settings</span>
          <strong>Names and hand</strong>
          <span className="muted small">{profile.userName} → {profile.theirName}</span>
        </a>
      </section>

      <div className="home-layout">
        <div className="units">
          {units.slice(0, 2).map((u, i) => (
            <UnitSection
              key={u.id}
              index={i + 1}
              title={u.title}
              goal={u.goal}
              lessons={u.lessons.filter((l) => l.scope === "demo").map((l) => ({ id: l.id, title: l.title, summary: l.summary, xp: l.xp, state: stateOf(l.id) }))}
              onOpen={open}
            />
          ))}
          <div className="locked-grid">
            {units.slice(2, 4).map((u, i) => (
              <LockedUnit key={u.id} title={`Unit ${i + 3} · ${u.title}`} />
            ))}
          </div>
        </div>

        <aside className="side" aria-label="Your letters and practice">
          <Card className="rounded-3xl border-2 gap-3 py-5">
            <CardHeader className="gap-0 px-5">
              <CardTitle className="text-xl">Letters in {profile.theirName}</CardTitle>
            </CardHeader>
            <CardContent className="px-5">
              <LiveCoverage name={profile.theirName} isLive={isPracticeable} />
            </CardContent>
          </Card>
          <Card className="rounded-3xl border-2 gap-3 py-5">
            <CardHeader className="gap-0 px-5">
              <CardTitle className="text-xl">Practice</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 px-5">
              {weak.length === 0 && due === 0 ? (
                <p className="muted">Nothing to review yet. Finish a lesson and it will show up here.</p>
              ) : (
                <>
                  {weak.length > 0 && (
                    <p className="flex flex-wrap items-center gap-2">
                      Needs practice:
                      {weak.map((l) => (
                        <StatusBadge key={l} kind="notyet">{l}</StatusBadge>
                      ))}
                    </p>
                  )}
                  {due > 0 && <p>{due} {due === 1 ? "item is" : "items are"} due for review.</p>}
                </>
              )}
            </CardContent>
          </Card>
          <p className="muted small">
            <a href="#/welcome">Change names or hand</a>
          </p>
        </aside>
      </div>
    </div>
  );
}
