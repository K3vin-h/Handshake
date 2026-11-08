import { useEffect, useRef, useState, type ReactElement } from "react";
import { LessonDemo } from "./screens/LessonDemo";
import { RecordPage } from "./screens/RecordPage";
import { CurriculumPreview } from "./screens/CurriculumPreview";
import { ComponentGallery } from "./screens/ComponentGallery";
import { StatsPage } from "./screens/StatsPage";
import { CameraDemo } from "./screens/CameraDemo";
import { Home } from "./screens/Home";
import { Onboarding } from "./screens/Onboarding";
import { LessonPlayer } from "./screens/LessonPlayer";
import { Complete } from "./screens/Complete";
import { ProgressScreen } from "./screens/Progress";
import { LessonPreview } from "./screens/LessonPreview";
import { loadProfile } from "./lib/profile";
import { loadProgress } from "./lib/progress";
import { ReduceMotionToggle } from "./components/motion/MotionProvider";
import { PageTransition } from "./components/motion/PageTransition";
import { StreakXpChip } from "./components/StreakXpChip";

// Hash router: "#/lesson/1.1" → name "lesson", param "1.1".
// Dev tools (record, curriculum, demo) work without a profile; everything else needs onboarding first.
function screen(hash: string): ReactElement {
  const [, name = "", param = ""] = hash.split("/");
  if (name === "record") return <RecordPage />;
  if (name === "curriculum") return <CurriculumPreview />;
  if (name === "demo") return <LessonDemo />;
  if (name === "lesson-preview") return <LessonPreview />;
  if (name === "components") return <ComponentGallery />;
  if (name === "welcome" || !loadProfile()) return <Onboarding />;
  if (name === "lesson") return <LessonPlayer key={param} lessonId={param} />;
  if (name === "complete") return <Complete lessonId={param} />;
  if (name === "progress") return <ProgressScreen />;
  if (name === "stats") return <StatsPage />;
  if (name === "camera-demo") return <CameraDemo />;
  return <Home />;
}

const TITLES: Record<string, string> = {
  path: "Your path",
  welcome: "Welcome",
  lesson: "Lesson",
  complete: "Lesson complete",
  progress: "Progress",
  stats: "Stats",
  "camera-demo": "Camera demo",
  demo: "Demo",
  record: "Record",
  curriculum: "Curriculum",
  components: "Components",
  "lesson-preview": "Lesson preview",
};

// Player-facing nav is deliberately small: Home (the main page that leads everywhere) and Progress.
// Dev tools live in a "Dev tools" menu that only exists in `npm run dev`; their routes keep working in every build.
const NAV: [string, string][] = [
  ["#/", "Home"],
  ["#/progress", "Progress"],
];
const DEV_NAV: [string, string][] = [
  ["#/demo", "Demo"],
  ["#/record", "Record"],
  ["#/curriculum", "Curriculum"],
  ["#/lesson-preview", "Lesson preview"],
  ["#/components", "Components"],
];

export default function App() {
  const [hash, setHash] = useState(location.hash || "#/");
  useEffect(() => {
    const on = () => setHash(location.hash || "#/");
    addEventListener("hashchange", on);
    return () => removeEventListener("hashchange", on);
  }, []);
  // Route change: update the tab title and move focus to <main> so keyboard and screen-reader users land on the new page.
  const first = useRef(true);
  useEffect(() => {
    const name = hash.split("/")[1] || "path";
    document.title = `${TITLES[name] ?? "Handshake"} · Handshake`;
    if (first.current) first.current = false;
    else document.getElementById("main")?.focus();
  }, [hash]);
  return (
    <>
      <a className="skip-link" href="#main" onClick={(e) => { e.preventDefault(); document.getElementById("main")?.focus(); }}>
        Skip to content
      </a>
      <nav aria-label="Main">
        <a className="brand" href="#/">Handshake</a>
        {NAV.map(([href, label]) => (
          <a key={href} href={href} aria-current={hash === href || (href !== "#/" && hash.startsWith(`${href}/`)) ? "page" : undefined}>
            {label}
          </a>
        ))}
        {loadProfile() && (
          <span className="nav-chips">
            <StreakXpChip streakDays={loadProgress().streakDays} xp={loadProgress().xp} />
          </span>
        )}
        <ReduceMotionToggle />
        {import.meta.env.DEV && (
          <details className="dev-menu">
            <summary>Dev tools</summary>
            <div className="dev-menu-list">
              {DEV_NAV.map(([href, label]) => (
                <a key={href} href={href} aria-current={hash === href ? "page" : undefined}>
                  {label}
                </a>
              ))}
            </div>
          </details>
        )}
      </nav>
      <main id="main" tabIndex={-1}>
        <PageTransition key={hash}>{screen(hash)}</PageTransition>
      </main>
    </>
  );
}
