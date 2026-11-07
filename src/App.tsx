import { useEffect, useState, type ReactElement } from "react";
import { LessonDemo } from "./screens/LessonDemo";
import { RecordPage } from "./screens/RecordPage";
import { CurriculumPreview } from "./screens/CurriculumPreview";
import { StatsPage } from "./screens/StatsPage";
import { Home } from "./screens/Home";
import { Onboarding } from "./screens/Onboarding";
import { LessonPlayer } from "./screens/LessonPlayer";
import { Complete } from "./screens/Complete";
import { ProgressScreen } from "./screens/Progress";
import { LessonPreview } from "./screens/LessonPreview";
import { loadProfile } from "./lib/profile";

// Hash router: "#/lesson/1.1" → name "lesson", param "1.1".
// Dev tools (record, curriculum, demo) work without a profile; everything else needs onboarding first.
function screen(hash: string): ReactElement {
  const [, name = "", param = ""] = hash.split("/");
  if (name === "record") return <RecordPage />;
  if (name === "curriculum") return <CurriculumPreview />;
  if (name === "demo") return <LessonDemo />;
  if (name === "lesson-preview") return <LessonPreview />;
  if (name === "welcome" || !loadProfile()) return <Onboarding />;
  if (name === "lesson") return <LessonPlayer key={param} lessonId={param} />;
  if (name === "complete") return <Complete lessonId={param} />;
  if (name === "stats") return <StatsPage />;
  if (name === "progress") return <ProgressScreen />;
  return <Home />;
}

export default function App() {
  const [hash, setHash] = useState(location.hash || "#/");
  useEffect(() => {
    const on = () => setHash(location.hash || "#/");
    addEventListener("hashchange", on);
    return () => removeEventListener("hashchange", on);
  }, []);
  return (
    <>
      <nav>
        <b>Handshake</b>
        <a href="#/">Path</a>
        <a href="#/progress">Progress</a>
        <a href="#/stats">Stats</a>
        <a href="#/demo">Demo</a>
        <a href="#/record">Record</a>
        <a href="#/curriculum">Curriculum</a>
      </nav>
      {screen(hash)}
    </>
  );
}
