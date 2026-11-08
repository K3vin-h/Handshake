import { useLayoutEffect, useRef, type ReactNode } from "react";
import { StreakXpChip } from "./StreakXpChip";

export type ShellItem = { href: string; label: string; icon: "learn" | "practice" | "progress" | "settings"; match: string[] };

/** The four top-level places. `match` lists the first hash segments that count as "inside" this item. */
export const SHELL_ITEMS: ShellItem[] = [
  { href: "#/", label: "Learn", icon: "learn", match: ["", "welcome", "complete", "lesson"] },
  { href: "#/camera-demo", label: "Practice", icon: "practice", match: ["camera-demo", "lesson-preview"] },
  { href: "#/progress", label: "Progress", icon: "progress", match: ["progress", "stats"] },
  { href: "#/settings", label: "Settings", icon: "settings", match: ["settings"] },
];

const DEV_ITEMS: [string, string][] = [
  ["#/demo", "Demo"],
  ["#/record", "Record"],
  ["#/curriculum", "Curriculum"],
  ["#/lesson-preview", "Lesson preview"],
  ["#/components", "Components"],
  ["#/stats", "Stats"],
];

/** Routes that render WITHOUT the sidebar/tab bar (full focus on the lesson). */
export const BARE_ROUTES = ["lesson", "lesson-preview", "camera-demo"];
export const isBareRoute = (hash: string) => BARE_ROUTES.includes(hash.split("/")[1] ?? "");

const ICONS: Record<ShellItem["icon"], ReactNode> = {
  learn: <path d="M4 6.5 12 3l8 3.5-8 3.5-8-3.5ZM6 10.5V15c0 1.7 2.7 3 6 3s6-1.3 6-3v-4.5" />,
  practice: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="4" /><circle cx="12" cy="12" r="0.8" /></>,
  progress: <path d="M5 20V12M12 20V5M19 20v-5" />,
  settings: <path d="M4 7h9M17 7h3M4 17h3M11 17h9M15 4v6M9 14v6" />,
};

function Icon({ name }: { name: ShellItem["icon"] }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {ICONS[name]}
    </svg>
  );
}

/**
 * App frame: a left sidebar at 1024px and up, a bottom tab bar below that. One landmark each:
 * <nav aria-label="Main">, <main id="main" tabIndex={-1}> and a skip link. The active item has aria-current="page"
 * and a sliding indicator (CSS transform; stopped by prefers-reduced-motion and the in-app Reduce motion switch).
 *
 * Props
 * - hash: the current location.hash, e.g. "#/progress". Used to mark the active item.
 * - bare: when true (lesson routes), render the skip link and <main> only, with no sidebar or tab bar.
 *   Use isBareRoute(hash) to decide.
 * - streakDays, xp: shown in the chip at the bottom of the sidebar (top strip on small screens).
 * - dev: show the "Dev tools" menu. Default: true only when the URL has ?dev.
 * - children: the current screen.
 *
 * Targets are at least 44px tall. Focus rings come from the global :focus-visible style.
 */
export function Shell(props: { hash: string; bare?: boolean; streakDays: number; xp: number; dev?: boolean; children: ReactNode }) {
  const { hash, bare, streakDays, xp, children } = props;
  const dev = props.dev ?? (typeof location !== "undefined" && new URLSearchParams(location.search).has("dev"));
  const seg = hash.split("/")[1] ?? "";
  const active = SHELL_ITEMS.findIndex((i) => i.match.includes(seg));
  const list = useRef<HTMLUListElement>(null);

  // Slide the indicator to the active item. Measured from the DOM so it works for the vertical and horizontal layouts.
  useLayoutEffect(() => {
    const ul = list.current;
    if (!ul) return;
    const place = () => {
      const li = ul.children[active + 1] as HTMLElement  /* children[0] is the indicator */ | undefined;
      if (!li) return ul.style.setProperty("--ind-o", "0");
      ul.style.setProperty("--ind-x", `${li.offsetLeft}px`);
      ul.style.setProperty("--ind-y", `${li.offsetTop}px`);
      ul.style.setProperty("--ind-w", `${li.offsetWidth}px`);
      ul.style.setProperty("--ind-h", `${li.offsetHeight}px`);
      ul.style.setProperty("--ind-o", "1");
    };
    place();
    // Re-measure when the list or its items change size (window resize, font load, text zoom).
    const ro = typeof ResizeObserver === "function" ? new ResizeObserver(place) : null;
    ro?.observe(ul);
    addEventListener("resize", place);
    return () => {
      ro?.disconnect();
      removeEventListener("resize", place);
    };
  }, [active, bare]);

  const skip = (
    <a className="skip-link" href="#main" onClick={(e) => { e.preventDefault(); document.getElementById("main")?.focus(); }}>
      Skip to content
    </a>
  );
  if (bare) {
    return (
      <>
        {skip}
        <main id="main" tabIndex={-1} className="shell-bare">{children}</main>
      </>
    );
  }
  return (
    <div className="shell">
      {skip}
      <header className="shell-top">
        <a className="shell-brand" href="#/">Handshake</a>
        <StreakXpChip streakDays={streakDays} xp={xp} />
      </header>
      <nav className="shell-nav" aria-label="Main">
        <a className="shell-brand shell-brand-side" href="#/">Handshake</a>
        <ul ref={list} className="shell-list">
          <li className="shell-indicator" aria-hidden="true" />
          {SHELL_ITEMS.map((it, i) => (
            <li key={it.href}>
              <a href={it.href} aria-current={i === active ? "page" : undefined}>
                <Icon name={it.icon} />
                <span>{it.label}</span>
              </a>
            </li>
          ))}
        </ul>
        <div className="shell-foot">
          <StreakXpChip streakDays={streakDays} xp={xp} />
          {dev && (
            <details className="dev-menu">
              <summary>Dev tools</summary>
              <div className="dev-menu-list">
                {DEV_ITEMS.map(([href, label]) => (
                  <a key={href} href={href} aria-current={hash === href ? "page" : undefined}>{label}</a>
                ))}
              </div>
            </details>
          )}
        </div>
      </nav>
      <main id="main" tabIndex={-1} className="shell-main">{children}</main>
    </div>
  );
}
