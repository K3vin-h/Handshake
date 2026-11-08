import { test } from "node:test";
import assert from "node:assert/strict";
import { withApp } from "./ssr.mjs";

test("motion tokens: no bounce on UI springs, press is 0.96, strong ease-out", () =>
  withApp(async (load) => {
    const { springs, motionTokens: t } = await load("/src/components/motion/tokens.ts");
    assert.equal(springs.ui.bounce, 0);
    assert.equal(springs.layout.bounce, 0);
    assert.equal(t.press, 0.96);
    assert.deepEqual(t.ease.out, [0.23, 1, 0.32, 1]);
  }));

test("nav: links in the centre zone, active one marked, chip and settings on the right, dev menu outside", () =>
  withApp(async (load, render, h) => {
    const { TopNav } = await load("/src/components/TopNav.tsx");
    const html = render(h(TopNav, { hash: "#/progress" }));
    assert.equal((html.match(/<nav /g) ?? []).length, 1);
    assert.match(html, /nav-center.*nav-links.*href="#\/progress"[^>]*aria-current="page"/s);
    assert.doesNotMatch(html.split("nav-center")[0], /href="#\/path"/);
    assert.match(html, /nav-right.*(day|XP).*href="#\/settings"/s);
    assert.doesNotMatch(html, /dev-corner|Dev tools/);
  }));

test("lesson routes hide the site nav", () =>
  withApp(async (load) => {
    const { showNav } = await load("/src/components/TopNav.tsx");
    assert.equal(showNav("#/lesson/1.1"), false);
    assert.equal(showNav("#/path"), true);
  }));

test("levels: no shortcut row, exactly three hero stats", () =>
  withApp(async (load, render, h) => {
    const { PathPage } = await load("/src/screens/Path.tsx");
    const html = render(h(PathPage));
    assert.doesNotMatch(html, /aria-label="Shortcuts"|Camera demo|Names and hand/);
    assert.equal((html.match(/<dt>/g) ?? []).length, 3);
    assert.match(html, /XP earned/);
    assert.match(html, /lessons done/);
    assert.match(html, /day streak|days streak/);
  }));

test("settings links to the camera demo", () =>
  withApp(async (load, render, h) => {
    const { Settings } = await load("/src/screens/Settings.tsx");
    assert.match(render(h(Settings)), /href="#\/camera-demo"/);
  }));

test("progress: detail spreads sit inside one closed disclosure", () =>
  withApp(async (load, render, h) => {
    const { ProgressScreen } = await load("/src/screens/Progress.tsx");
    const html = render(h(ProgressScreen));
    assert.equal((html.match(/<details[^>]*jr-more/g) ?? []).length, 1);
    assert.doesNotMatch(html, /<details[^>]*jr-more[^>]*\sopen/);
    assert.match(html.split("jr-more")[0], /Your alphabet/);
    assert.match(html.split("jr-more")[1], /Due today/);
  }));

test("lesson notice: heading, status message, one primary action", () =>
  withApp(async (load, render, h) => {
    const { LessonNotice } = await load("/src/components/LessonNotice.tsx");
    const html = render(h(LessonNotice, {
      title: "Lesson not finished yet", message: "You skipped 1 step.",
      primary: { label: "Redo the skipped step", onClick() {} },
      secondary: { label: "Start the whole lesson over", onClick() {} },
      links: [{ href: "#/", label: "Back to your path" }], footnote: "Stays partly filled.",
    }));
    assert.match(html, /<h1[^>]*tabindex="-1"[^>]*>Lesson not finished yet/);
    assert.match(html, /role="status"[^>]*>You skipped 1 step\./);
    assert.equal((html.match(/notice-primary/g) ?? []).length, 1);
    assert.match(html, /href="#\/">Back to your path/);
  }));
