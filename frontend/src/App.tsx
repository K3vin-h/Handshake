import { useEffect, useReducer, useRef, useState, type ReactElement } from "react";
import { LessonDemo } from "./screens/LessonDemo";
import { RecordPage } from "./screens/RecordPage";
import { RecordSignsPage } from "./screens/RecordSignsPage";
import { SignDiagramsPage } from "./screens/SignDiagramsPage";
import { CurriculumPreview } from "./screens/CurriculumPreview";
import { ComponentGallery } from "./screens/ComponentGallery";
import { StatsPage } from "./screens/StatsPage";
import { CameraDemo } from "./screens/CameraDemo";
import { Home } from "./screens/Home";
import { PathPage } from "./screens/Path";
import { Onboarding } from "./screens/Onboarding";
import { LessonPlayer } from "./screens/LessonPlayer";
import { Complete } from "./screens/Complete";
import { Alphabet } from "./screens/Alphabet";
import { ProgressScreen } from "./screens/Progress";
import { LessonPreview } from "./screens/LessonPreview";
import { Settings } from "./screens/Settings";
import { loadProfile } from "./lib/profile";
import { loadProgress } from "./lib/progress";
import { ReduceMotionToggle } from "./components/motion/MotionProvider";
import { PageTransition } from "./components/motion/PageTransition";
import { StreakXpChip } from "./components/StreakXpChip";
import { AccountChip } from "./components/AccountChip";
import { SignUp } from "./screens/SignUp";
import { Login } from "./screens/Login";
import { ForgotPassword } from "./screens/ForgotPassword";
import { ResetPassword } from "./screens/ResetPassword";

// Hash router: "#/lesson/1.1" → name "lesson", param "1.1".
// Dev tools (record, curriculum, demo) work without a profile; everything else needs onboarding first.
function screen(hash: string): ReactElement {
  const [, name = "", param = ""] = hash.split("/");
  if (name === "record") return <RecordPage />;
  if (name === "record-signs") return <RecordSignsPage />;
  if (name === "sign-diagrams") return <SignDiagramsPage />;
  if (name === "curriculum") return <CurriculumPreview />;
  if (name === "demo") return <LessonDemo />;
  if (name === "lesson-preview") return <LessonPreview />;
  if (name === "components") return <ComponentGallery />;
  // Account screens work without a profile: a returning user logs in before onboarding.
  if (name === "signup") return <SignUp />;
  if (name === "login") return <Login />;
  if (name === "forgot") return <ForgotPassword />;
  if (name === "reset") return <ResetPassword />;
  if (name === "welcome" || !loadProfile()) return <Onboarding />;
  if (name === "lesson") return <LessonPlayer key={param} lessonId={param} />;
  if (name === "complete") return <Complete lessonId={param} />;
  if (name === "alphabet") return <Alphabet lessonId={param || undefined} />;
  if (name === "progress") return <ProgressScreen />;
  if (name === "settings") return <Settings />;
  if (name === "path") return <PathPage />;
  if (name === "stats") return <StatsPage />;
  if (name === "camera-demo") return <CameraDemo />;
  return <Home />;
}

const TITLES: Record<string, string> = {
  home: "Home",
  path: "Your path",
  welcome: "Welcome",
  lesson: "Lesson",
  complete: "Lesson complete",
  alphabet: "Your alphabet",
  progress: "Progress",
  settings: "Settings",
  stats: "Stats",
  "camera-demo": "Camera demo",
  demo: "Demo",
  record: "Record",
  "record-signs": "Record signs",
  "sign-diagrams": "Sign diagrams",
  curriculum: "Curriculum",
  components: "Components",
  "lesson-preview": "Lesson preview",
  signup: "Create your profile",
  login: "Log in",
  forgot: "Forgot password",
  reset: "Reset password",
};

// Player-facing nav is deliberately small: Home (the main page that leads everywhere) and Progress.
// Dev tools live in a "Dev tools" menu that only exists in `npm run dev`; their routes keep working in every build.
const NAV: [string, string][] = [
  ["#/", "Home"],
  ["#/path", "Levels"],
  ["#/progress", "Progress"],
];
/** Settings sits at the right end of the bar, by the Dev tools menu. */
const SETTINGS: [string, string] = ["#/settings", "Settings"];
const LEVELS: [string, string] = ["#/path", "Levels"];
const DEV_NAV: [string, string][] = [
  ["#/demo", "Demo"],
  ["#/record", "Record"],
  ["#/record-signs", "Record signs"],
  ["#/sign-diagrams", "Sign diagrams"],
  ["#/curriculum", "Curriculum"],
  ["#/lesson-preview", "Lesson preview"],
  ["#/components", "Components"],
];

/** Pages that belong to a nav item. "Levels" also covers the lesson, completion and alphabet pages that you reach from it. */
const LEVEL_PAGES = ["path", "lesson", "complete", "alphabet"];
export const navActive = (href: string, hash: string) =>
  href === "#/path" ? LEVEL_PAGES.includes(hash.split("/")[1]?.split("?")[0] ?? "") : hash === href || (href !== "#/" && hash.startsWith(`${href}/`));

export default function App() {
  const [hash, setHash] = useState(location.hash || "#/");
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    // rerender: Onboarding saves the profile while already at "#/", so the hash is unchanged but screen() must run again.
    const on = () => { setHash(location.hash || "#/"); rerender(); };
    addEventListener("hashchange", on);
    // Progress and profile saves announce themselves: re-read the top bar's streak and XP then, not only on navigation.
    addEventListener("handshake:state", rerender);
    return () => { removeEventListener("hashchange", on); removeEventListener("handshake:state", rerender); };
  }, []);
  // Route change: update the tab title and move focus to <main> so keyboard and screen-reader users land on the new page.
  const first = useRef(true);
  useEffect(() => {
    const name = hash.split("/")[1] || "home";
    document.title = `${TITLES[name] ?? "Handshake"} · Handshake`;
    if (first.current) first.current = false;
    else {
      // Hash routing keeps the old scroll offset, and focus() scrolls by itself: start each page at the top instead.
      window.scrollTo(0, 0);
      document.getElementById("main")?.focus({ preventScroll: true });
    }
  }, [hash]);
  return (
    <>
      <a className="skip-link" href="#main" onClick={(e) => { e.preventDefault(); document.getElementById("main")?.focus(); }}>
        Skip to content
      </a>
      <nav aria-label="Main" className="top-nav">
        {/* Three zones with equal side columns: Levels and the streak / XP chip are always exactly in the middle. */}
        <div className="nav-left">
          <a className="brand" href="#/">Handshake</a>
          {NAV.filter(([href]) => href !== LEVELS[0]).map(([href, label]) => (
            <a key={href} href={href} aria-current={navActive(href, hash) ? "page" : undefined}>
              {label}
            </a>
          ))}
        </div>
        <div className="nav-center">
          <a href={LEVELS[0]} aria-current={navActive(LEVELS[0], hash) ? "page" : undefined}>{LEVELS[1]}</a>
          {loadProfile() && (
            <span className="nav-chips">
              <StreakXpChip streakDays={loadProgress().streakDays} xp={loadProgress().xp} />
            </span>
          )}
        </div>
        <div className="nav-right">
          <AccountChip />
          <ReduceMotionToggle />
          <a href={SETTINGS[0]} aria-current={navActive(SETTINGS[0], hash) ? "page" : undefined}>{SETTINGS[1]}</a>
        </div>
      </nav>
      <main id="main" tabIndex={-1}>
        <PageTransition key={hash}>{screen(hash)}</PageTransition>
      </main>
      {import.meta.env.DEV && (
        <details className="dev-menu dev-corner">
          <summary aria-label="Dev tools">dev</summary>
          <div className="dev-menu-list">
            {DEV_NAV.map(([href, label]) => (
              <a key={href} href={href} aria-current={hash === href ? "page" : undefined}>
                {label}
              </a>
            ))}
          </div>
        </details>
      )}
    </>
  );
}
