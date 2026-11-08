// WCAG 2.x contrast check for the tokens in src/styles.css.
// Run: node src/styles.contrast.mjs   (exit code 1 if any pair is below its minimum)
// Text needs 4.5:1. Non-text UI (borders, focus ring) needs 3:1.
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("./styles.css", import.meta.url), "utf8");
const root = css.match(/:root\s*{([\s\S]*?)\n}/)?.[1] ?? "";
const tokens = {};
for (const m of root.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) tokens[m[1]] = m[2].trim().replace(/\s*\/\*.*$/, "");
const resolve = (v) => {
  const ref = v.match(/^var\(--([\w-]+)\)$/);
  return ref ? resolve(tokens[ref[1]]) : v;
};
const hex = (name) => {
  const v = resolve(tokens[name] ?? name);
  if (!/^#[0-9a-f]{6}$/i.test(v)) throw new Error(`token --${name} is not a 6-digit hex colour: ${v}`);
  return v;
};

const toRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const lin = (c) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const lum = (rgb) => 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2]);
const ratio = (a, b) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const blend = (fg, alpha, bg) => fg.map((c, i) => Math.round(c * alpha + bg[i] * (1 - alpha)));

const rgb = (name) => toRgb(hex(name));
// [label, foreground, background, minimum]
const pairs = [
  // [label, foreground, background, minimum]. Surfaces: bg (page), card, raised, tint, hero gradient ends.
  ["body text on page", rgb("text"), rgb("bg"), 4.5],
  ["body text on card", rgb("text"), rgb("card"), 4.5],
  ["body text on raised", rgb("text"), rgb("raised"), 4.5],
  ["body text on tint (coach, selected choice)", rgb("text"), rgb("tint"), 4.5],
  ["body text on hero start (#f4f0fe)", rgb("text"), toRgb("#f4f0fe"), 4.5],
  ["body text on hero end (#e6f4fe)", rgb("text"), toRgb("#e6f4fe"), 4.5],
  ["muted text on page", rgb("muted"), rgb("bg"), 4.5],
  ["muted text on card", rgb("muted"), rgb("card"), 4.5],
  ["muted text on raised", rgb("muted"), rgb("raised"), 4.5],
  ["muted text on tint", rgb("muted"), rgb("tint"), 4.5],
  ["button text on brand", rgb("brand-ink"), rgb("brand"), 4.5],
  ["white text on start-button gradient end (#5d47b8)", toRgb("#ffffff"), toRgb("#5d47b8"), 4.5],
  ["link / accent (brand-text) on page", rgb("brand-text"), rgb("bg"), 4.5],
  ["link / accent (brand-text) on card", rgb("brand-text"), rgb("card"), 4.5],
  ["accent (brand-text) on tint", rgb("brand-text"), rgb("tint"), 4.5],
  ["accent (brand-text) on hero start (#f4f0fe)", rgb("brand-text"), toRgb("#f4f0fe"), 4.5],
  ["accent (brand-text) on hero end (#e6f4fe)", rgb("brand-text"), toRgb("#e6f4fe"), 4.5],
  ["mastered/blue text on brand-2", rgb("brand-2-ink"), rgb("brand-2"), 4.5],
  ["brand-2 text on card", rgb("brand-2"), rgb("card"), 4.5],
  ["current node glyph (#2f265f) on #c2b5f5", toRgb("#2f265f"), toRgb("#c2b5f5"), 4.5],
  ["current node glyph (#2f265f) on white highlight", toRgb("#2f265f"), toRgb("#ffffff"), 4.5],
  ["done node glyph (#113264) on #5eb1ef", toRgb("#113264"), toRgb("#5eb1ef"), 4.5],
  ["done node glyph (#113264) on #d5efff highlight", toRgb("#113264"), toRgb("#d5efff"), 4.5],
  ["available/locked node glyph on #e8e8ec", rgb("text"), toRgb("#e8e8ec"), 4.5],
  ["white number on unit badge (#8e7ae0), large text", toRgb("#ffffff"), toRgb("#8e7ae0"), 3],
  ["white number on unit badge (#6e56cf)", toRgb("#ffffff"), toRgb("#6e56cf"), 4.5],
  ["status mark: accent fill vs card (3:1)", rgb("brand-2"), rgb("card"), 3],
  ["status mark: check on accent fill", rgb("brand-2-ink"), rgb("brand-2"), 3],
  ["status mark: neutral outline vs card (3:1)", rgb("border-strong"), rgb("card"), 3],
  ["status mark: dashed reference ring vs its tint (3:1)", rgb("reference"), rgb("reference-bg"), 3],
  ["nav: inactive label on card", rgb("muted"), rgb("card"), 4.5],
  ["nav: active label on indicator tint", rgb("brand-text"), rgb("tint"), 4.5],
  ["nav: indicator border vs card (3:1)", rgb("brand-text"), rgb("card"), 3],
  ["step dots / tile border: brand-text on tint (3:1)", rgb("brand-text"), rgb("tint"), 3],
  ["card edge vs page (decorative, 1.3:1 min)", rgb("border"), rgb("bg"), 1.3],
  ["tile text brand-deep on tint", rgb("brand-deep"), rgb("tint"), 4.5],
  ["match text on match tint", rgb("match"), rgb("match-bg"), 4.5],
  ["not-yet text on not-yet tint", rgb("notyet"), rgb("notyet-bg"), 4.5],
  ["reference text on reference tint", rgb("reference"), rgb("reference-bg"), 4.5],
  ["match text on card", rgb("match"), rgb("card"), 4.5],
  ["not-yet text on card (error status, halo error)", rgb("notyet"), rgb("card"), 4.5],
  ["reference text on card", rgb("reference"), rgb("card"), 4.5],
  ["disabled button text", rgb("muted"), rgb("reference-bg"), 4.5],
  ["text on blue 3D panel", rgb("on-panel-light"), rgb("panel-light"), 4.5],
  ["muted text on 3D panel", rgb("muted"), rgb("panel-light"), 4.5],
  ["white text on camera message (#000)", toRgb("#ffffff"), toRgb("#000000"), 4.5],
  ["light-hint: white on 92% #0e0e11 over white (worst case)", toRgb("#ffffff"), blend(toRgb("#0e0e11"), 0.92, toRgb("#ffffff")), 4.5],
  ["shadcn destructive text on --notyet", rgb("notyet-bg"), rgb("notyet"), 4.5],
  // non-text: borders, rings, focus
  ["focus ring on page (non-text)", rgb("focus"), rgb("bg"), 3],
  ["focus ring on card (non-text)", rgb("focus"), rgb("card"), 3],
  ["focus ring on tint (non-text)", rgb("focus"), rgb("tint"), 3],
  ["input / halo border on card (non-text)", rgb("border-strong"), rgb("card"), 3],
  ["input / button border on page (non-text)", rgb("border-strong"), rgb("bg"), 3],
  ["selected outline (brand-text) on page", rgb("brand-text"), rgb("bg"), 3],
  ["progress fill on track (non-text)", rgb("brand-2"), rgb("reference-bg"), 3],
  ["hold ring fill on card (non-text)", rgb("brand-2"), rgb("card"), 3],
  ["hold bar on camera (non-text)", rgb("brand-2"), toRgb("#000000"), 3],
  ["done node ring (brand-2) on page (non-text)", rgb("brand-2"), rgb("bg"), 3],
  ["locked node dashed ring on page (non-text)", rgb("border-strong"), rgb("bg"), 3],
  ["path trail dots on page (non-text)", rgb("border-strong"), rgb("bg"), 3],
];

let failed = 0;
console.log("ratio   min   result  pair");
for (const [label, fg, bg, min] of pairs) {
  const r = ratio(fg, bg);
  const ok = r >= min;
  if (!ok) failed++;
  console.log(`${r.toFixed(2).padStart(5)}  ${String(min).padStart(4)}  ${ok ? "PASS  " : "FAIL  "}  ${label}`);
}
console.log(failed ? `\n${failed} pair(s) below minimum` : "\nAll pairs pass.");
process.exit(failed ? 1 : 0);
