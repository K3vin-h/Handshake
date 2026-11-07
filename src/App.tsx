import { useEffect, useState } from "react";
import { LessonDemo } from "./screens/LessonDemo";
import { RecordPage } from "./screens/RecordPage";
import { CurriculumPreview } from "./screens/CurriculumPreview";
import { ComponentGallery } from "./screens/ComponentGallery";

// Tiny hash router so nobody has to set up react-router during the hackathon.
// Add routes here: "#/onboarding", "#/path", "#/progress", ...
const routes: Record<string, () => React.ReactElement> = {
  "#/": LessonDemo,
  "#/record": RecordPage,
  "#/curriculum": CurriculumPreview,
  "#/components": ComponentGallery,
};

const NAV: [string, string][] = [
  ["#/", "Lesson"],
  ["#/record", "Record"],
  ["#/curriculum", "Curriculum"],
  ["#/components", "Components"],
];

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
      <a className="skip-link" href="#main" onClick={(e) => { e.preventDefault(); document.getElementById("main")?.focus(); }}>
        Skip to content
      </a>
      <nav aria-label="Main">
        <b>Handshake</b>
        {NAV.map(([href, label]) => (
          <a key={href} href={href} aria-current={hash === href ? "page" : undefined}>
            {label}
          </a>
        ))}
      </nav>
      <main id="main" tabIndex={-1}>
        <Screen />
      </main>
    </>
  );
}
