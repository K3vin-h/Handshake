import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const SRC = new URL("../src/", import.meta.url).pathname;
const walk = (d) => readdirSync(d).flatMap((n) => (statSync(join(d, n)).isDirectory() ? walk(join(d, n)) : [join(d, n)]));
const files = walk(SRC).filter((p) => p.endsWith(".css")).map((p) => ({ file: p.slice(SRC.length), lines: readFileSync(p, "utf8").split("\n") }));
const EXEMPT = new Set(["components/journal/journal.css"]); // hand-drawn notebook: ruled lines, hatching, irregular radii on purpose
const OK = /(gradient|infinite|glass)-ok/;
const find = (re, { exempt = true } = {}) =>
  files.flatMap(({ file, lines }) => (exempt && EXEMPT.has(file) ? [] : lines.flatMap((l, i) => (re.test(l) && !OK.test(l) ? [`${file}:${i + 1}  ${l.trim().slice(0, 90)}`] : []))));

function hue(hex) {
  const v = hex.length === 4 ? [...hex.slice(1)].map((c) => parseInt(c + c, 16)) : [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const [r, g, b] = v.map((x) => x / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  if (d < 0.04) return null; // grey
  const h = (max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4) * 60;
  return h < 0 ? h + 360 : h;
}

test("no gradients (flat surfaces)", () => assert.deepEqual(find(/(linear|radial|conic)-gradient\(/), []));
test("no violet/indigo colours (hue 245-320)", () => {
  const bad = files.flatMap(({ file, lines }) => lines.flatMap((l, i) => (l.match(/#[0-9a-f]{6}\b|#[0-9a-f]{3}\b/gi) ?? []).filter((h) => { const x = hue(h); return x !== null && x >= 245 && x <= 320; }).map((h) => `${file}:${i + 1}  ${h}`)));
  assert.deepEqual(bad, []);
});
test("no decorative infinite animations", () => assert.deepEqual(find(/animation[^;]*infinite/), []));
test("no transition: all", () => assert.deepEqual(find(/transition(-property)?:\s*all\b/), []));
test("no animated width/height (use transform)", () => assert.deepEqual(find(/transition:[^;]*\b(width|height)\b/), []));
test("glass blur only on the nav (at most one use)", () => assert.ok(find(/backdrop-filter/).length <= 1, find(/backdrop-filter/).join("\n")));
test("radii come from tokens, not raw px", () => assert.deepEqual(find(/border-radius:[^;]*\d+px/), []));
test("no hover lift", () => assert.deepEqual(find(/:hover[^{]*\{[^}]*translateY\(-/), []));
test("font is chosen, not Inter by default", () => {
  const css = files.find((f) => f.file === "styles.css").lines.join("\n");
  assert.match(css, /--font:\s*"?Atkinson Hyperlegible Next/);
});
