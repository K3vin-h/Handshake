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

test("lesson headlines are calm: no exclamation marks for any lesson", () =>
  withApp(async (load) => {
    const { lessonHeadline } = await load("/src/components/lessonHeadline.ts");
    const { buildCurriculum } = await load("/src/lib/curriculum.ts");
    const units = buildCurriculum({ userName: "Ryan", theirName: "Lily" });
    const lessons = units.flatMap((u) => u.lessons);
    assert.ok(lessons.length > 5);
    for (const l of lessons) {
      const h = lessonHeadline(l, "Lily");
      assert.ok(typeof h === "string" && h.length > 0, l.id);
      assert.doesNotMatch(h, /!/, `${l.id}: ${h}`);
    }
  }));

test("nav brand: decorative handshake mark plus the text 'Handshake' as the link name", () =>
  withApp(async (load, render, h) => {
    const { TopNav } = await load("/src/components/TopNav.tsx");
    const html = render(h(TopNav, { hash: "#/" }));
    const brand = html.match(/<a class="brand"[^>]*>(.*?)<\/a>/s)?.[1] ?? "";
    assert.match(brand, /<svg[^>]*aria-hidden="true"/);
    assert.equal(brand.replace(/<[^>]*>/g, "").trim(), "Handshake");
  }));

test("progress page: no blur teaser, water stain or ripple", () =>
  withApp(async (load, render, h) => {
    const { ProgressScreen } = await load("/src/screens/Progress.tsx");
    const html = render(h(ProgressScreen));
    assert.doesNotMatch(html, /jr-blur|jr-stain|jr-ripple/);
    assert.doesNotMatch(html, /· next</);
  }));

test("settings: name tiles, switch for reduce motion, grouped rows, camera link", () =>
  withApp(async (load, render, h) => {
    const { Settings } = await load("/src/screens/Settings.tsx");
    const html = render(h(Settings));
    assert.equal((html.match(/<h1/g) ?? []).length, 1);
    assert.match(html, /role="switch"[^>]*aria-checked="(true|false)"/);
    for (const l of ["R", "Y", "A", "N", "L", "I"]) assert.match(html, new RegExp(`>${l}<`));
    assert.match(html, /href="#\/camera-demo"/);
    assert.ok((html.match(/<h2/g) ?? []).length >= 4);
    assert.doesNotMatch(html, /set-group[^>]*>(?:(?!<\/section>).)*<section[^>]*set-group/s);
    assert.match(html, /Right-handed/);
    assert.doesNotMatch(html.replace(/<[^>]*>/g, " "), /!/);
  }));

test("settings: long names are capped with an ellipsis tile, non-letters are ignored", () =>
  withApp(async (load, render, h) => {
    const { NameTiles } = await load("/src/components/settings/NameTiles.tsx");
    const html = render(h(NameTiles, { name: "Jo-Anne Marie Smith", label: "You" }));
    assert.equal((html.match(/set-tile"/g) ?? []).length, 8);
    assert.match(html, /set-tile-more/);
    assert.doesNotMatch(html, />-</);
    const short = render(h(NameTiles, { name: "Al", label: "You" }));
    assert.doesNotMatch(short, /set-tile-more/);
  }));

test("settings: tiles are one labelled image; a name with no A-Z letters shows as plain text", () =>
  withApp(async (load, render, h) => {
    const { NameTiles, nameLetters } = await load("/src/components/settings/NameTiles.tsx");
    assert.deepEqual(nameLetters(""), []);
    assert.deepEqual(nameLetters("李明"), []);
    const { Settings } = await load("/src/screens/Settings.tsx");
    assert.match(render(h(Settings)), /role="img"[^>]*aria-label="You: Ryan"/);
    const html = render(h(NameTiles, { name: "李明", label: "You" }));
    assert.doesNotMatch(html, /set-tile/);
    assert.match(html, /李明/);
    assert.match(html, /You/);
  }));
