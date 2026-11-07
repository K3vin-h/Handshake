import { useEffect, useState } from "react";
import { LessonDemo } from "./screens/LessonDemo";
import { RecordPage } from "./screens/RecordPage";
import { CurriculumPreview } from "./screens/CurriculumPreview";

// Tiny hash router so nobody has to set up react-router during the hackathon.
// Add routes here: "#/onboarding", "#/path", "#/progress", ...
const routes: Record<string, () => React.ReactElement> = {
  "#/": LessonDemo,
  "#/record": RecordPage,
  "#/curriculum": CurriculumPreview,
};

export default function App() {
  const [hash, setHash] = useState(location.hash || "#/");
  useEffect(() => {
    const on = () => setHash(location.hash || "#/");
    addEventListener("hashchange", on);
    return () => removeEventListener("hashchange", on);
  }, []);
  const Screen = routes[hash] ?? LessonDemo;
  return (
    <>
      <nav>
        <b>Handshake</b>
        <a href="#/">Lesson</a>
        <a href="#/record">Record</a>
        <a href="#/curriculum">Curriculum</a>
      </nav>
      <Screen />
    </>
  );
}
