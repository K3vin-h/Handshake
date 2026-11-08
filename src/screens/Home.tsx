import { useMemo } from "react";
import { isPracticeable } from "../cv";
import { LiveCoverage } from "../components/LiveCoverage";
import { LockedUnit } from "../components/LockedUnit";
import { UnitSection, type MapLesson } from "../components/PathMap";
import { LetterBadge, type LetterStatus } from "../components/LetterBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buildCurriculum } from "../lib/curriculum";
import { DEMO_PROFILE, loadProfile } from "../lib/profile";
import { dueItems, isUnlocked, loadProgress, nextLesson } from "../lib/progress";

// Home: the path. Units 1-2 are active; Units 3-4 are locked ("Coming later").
// Reads the profile and progress from localStorage only.

export function Home() {
  const profile = loadProfile() ?? DEMO_PROFILE;
  const units = useMemo(() => buildCurriculum(profile), []); // eslint-disable-line react-hooks/exhaustive-deps
  const progress = loadProgress();
  const next = nextLesson(units, progress);
  const due = dueItems(progress);
  const letterState = (l: string): Exclude<LetterStatus, "reference-only"> => {
    const it = progress.items[l];
    return it?.mastered ? "mastered" : it && it.attempts > 0 ? "practising" : "not-started";
  };

  const stateOf = (id: string): MapLesson["state"] => {
    if (progress.completed.includes(id)) return "done";
    if (next?.id === id) return "current";
    return isUnlocked(units, progress, id) ? "available" : "locked";
  };
  const open = (id: string) => (location.hash = `#/lesson/${id}`);

  return (
    <div className="page home">
      <header className="hero stagger" style={{ "--i": 0 } as React.CSSProperties}>
        <p className="eyebrow">Your path</p>
        <h1>
          Start with your name, {profile.userName}. Then {profile.theirName}&rsquo;s.
        </h1>
      </header>

      <section className="continue-card stagger" style={{ "--i": 1 } as React.CSSProperties} aria-labelledby="continue-title">
        {next ? (
          <>
            <div>
              <p className="eyebrow" id="continue-title">Continue</p>
              <h2>{next.title}</h2>
              <p className="muted">Lesson {next.id} · {next.xp} XP</p>
            </div>
            <Button size="lg" className="h-12 rounded-2xl border-b-4 border-brand-deep px-7 text-base" onClick={() => open(next.id)}>
              Continue lesson {next.id}
            </Button>
          </>
        ) : (
          <div>
            <p className="eyebrow" id="continue-title">Continue</p>
            <h2>Every available lesson is finished</h2>
            <p className="muted">More lessons are coming later.</p>
          </div>
        )}
      </section>

      <div className="home-layout">
        <div className="units stagger" style={{ "--i": 2 } as React.CSSProperties}>
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

        <aside className="side stagger" style={{ "--i": 3 } as React.CSSProperties} aria-label="Your letters and review">
          <Card className="rounded-3xl border-2 gap-3 py-5">
            <CardHeader className="gap-0 px-5">
              <CardTitle className="text-xl">Letters in {profile.theirName}</CardTitle>
            </CardHeader>
            <CardContent className="px-5">
              <LiveCoverage name={profile.theirName} isLive={isPracticeable} stateOf={letterState} />
            </CardContent>
          </Card>
          <Card className="rounded-3xl border-2 gap-3 py-5">
            <CardHeader className="gap-0 px-5">
              <CardTitle className="text-xl">Due for review</CardTitle>
            </CardHeader>
            <CardContent className="px-5">
              {due.length === 0 ? (
                <p className="muted">Nothing is due. Letters you practise will come back here for review.</p>
              ) : (
                <div className="chip-row">
                  {due.map((l) => (
                    <LetterBadge key={l} letter={l} status={isPracticeable(l) ? letterState(l) : "reference-only"} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          <p className="muted small">
            <a href="#/camera-demo">Try the camera and coach (demo, not scored)</a>
          </p>
        </aside>
      </div>
    </div>
  );
}
