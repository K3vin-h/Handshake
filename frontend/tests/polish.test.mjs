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
