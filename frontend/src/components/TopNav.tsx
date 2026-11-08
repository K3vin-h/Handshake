import { motion } from "motion/react";
import "./TopNav.css";
import { StreakXpChip } from "./StreakXpChip";
import { AccountChip } from "./AccountChip";
import { ReduceMotionToggle } from "./motion/MotionProvider";
import { springs } from "./motion/tokens";
import { loadProfile } from "../lib/profile";
import { loadProgress } from "../lib/progress";

// Player-facing nav is deliberately small: Home (the main page that leads everywhere), Levels and Progress.
// Dev tools live in a "Dev tools" menu (App.tsx) that only exists in `npm run dev`; their routes keep working in every build.
const NAV: [string, string][] = [
  ["#/", "Home"],
  ["#/path", "Levels"],
  ["#/progress", "Progress"],
];
/** Settings sits at the right end of the bar. */
const SETTINGS: [string, string] = ["#/settings", "Settings"];

/** Pages that belong to a nav item. "Levels" also covers the lesson, completion and alphabet pages that you reach from it. */
const LEVEL_PAGES = ["path", "lesson", "complete", "alphabet"];
export const navActive = (href: string, hash: string) =>
  href === "#/path" ? LEVEL_PAGES.includes(hash.split("/")[1]?.split("?")[0] ?? "") : hash === href || (href !== "#/" && hash.startsWith(`${href}/`));

/** Lessons run in focus mode: no site nav, the lesson screen has its own way back. */
export const showNav = (hash: string) => hash.split("/")[1] !== "lesson";

/** Brand left, the three pages in a centred segmented pill, streak / account / settings right. */
export function TopNav({ hash }: { hash: string }) {
  const progress = loadProgress();
  return (
    <nav aria-label="Main" className="top-nav">
      <div className="nav-left"><a className="brand" href="#/">Handshake</a></div>
      <div className="nav-center">
        <div className="nav-links">
          {NAV.map(([href, label]) => {
            const on = navActive(href, hash);
            return (
              <a key={href} href={href} aria-current={on ? "page" : undefined}>
                {on && <motion.span layoutId="nav-pill" className="nav-pill" transition={springs.ui} aria-hidden="true" />}
                {label}
              </a>
            );
          })}
        </div>
      </div>
      <div className="nav-right">
        <div className="nav-status">
          {loadProfile() && <StreakXpChip streakDays={progress.streakDays} xp={progress.xp} />}
          <AccountChip />
          <ReduceMotionToggle />
        </div>
        <a href={SETTINGS[0]} aria-current={navActive(SETTINGS[0], hash) ? "page" : undefined}>{SETTINGS[1]}</a>
      </div>
    </nav>
  );
}
