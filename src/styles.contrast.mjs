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
  ["body text on page", rgb("text"), rgb("bg"), 4.5],
  ["body text on card", rgb("text"), rgb("card"), 4.5],
  ["muted text on page", rgb("muted"), rgb("bg"), 4.5],
  ["muted text on card", rgb("muted"), rgb("card"), 4.5],
  ["button text on brand", rgb("brand-ink"), rgb("brand"), 4.5],
  ["text on brand-2", rgb("brand-2-ink"), rgb("brand-2"), 4.5],
  ["brand link on page", rgb("brand"), rgb("bg"), 4.5],
  ["brand link on card", rgb("brand"), rgb("card"), 4.5],
  ["brand-2 text on card", rgb("brand-2"), rgb("card"), 4.5],
  ["match text on match tint", rgb("match"), rgb("match-bg"), 4.5],
  ["not-yet text on not-yet tint", rgb("notyet"), rgb("notyet-bg"), 4.5],
  ["reference text on reference tint", rgb("reference"), rgb("reference-bg"), 4.5],
  ["match text on card", rgb("match"), rgb("card"), 4.5],
  ["not-yet text on card", rgb("notyet"), rgb("card"), 4.5],
  ["reference text on card", rgb("reference"), rgb("card"), 4.5],
  ["disabled button text", rgb("muted"), rgb("reference-bg"), 4.5],
  ["muted text on hand3d panel (#EEF2F6)", rgb("muted"), toRgb("#EEF2F6"), 4.5],
  ["tip text on tip tint (#eef2ff)", rgb("text"), toRgb("#eef2ff"), 4.5],
  ["white text on camera message (#000)", toRgb("#ffffff"), toRgb("#000000"), 4.5],
  ["light-hint: white on 92% ink, worst case over white", toRgb("#ffffff"), blend(toRgb("#0f172a"), 0.92, toRgb("#ffffff")), 4.5],
  ["live badge: match on match tint", rgb("match"), rgb("match-bg"), 4.5],
  ["mastered badge text", rgb("brand-2-ink"), rgb("brand-2"), 4.5],
  ["locked badge: muted on card", rgb("muted"), rgb("card"), 4.5],
  ["locked node/unit: muted on page", rgb("muted"), rgb("bg"), 4.5],
  ["coach text on #eef2ff", rgb("text"), toRgb("#eef2ff"), 4.5],
  ["error status: not-yet on card", rgb("notyet"), rgb("card"), 4.5],
  ["selected ring (brand) on page (non-text)", rgb("brand"), rgb("bg"), 3],
  ["hold ring fill on card (non-text)", rgb("brand-2"), rgb("card"), 3],
  ["hold ring track vs fill (non-text)", rgb("brand-2"), rgb("reference-bg"), 3],
  ["hero text on gradient start (#e0e7ff)", rgb("text"), toRgb("#e0e7ff"), 4.5],
  ["hero text on gradient end (#ccfbf1)", rgb("text"), toRgb("#ccfbf1"), 4.5],
  ["eyebrow (reference) on gradient start", rgb("reference"), toRgb("#e0e7ff"), 4.5],
  ["eyebrow (reference) on gradient end", rgb("reference"), toRgb("#ccfbf1"), 4.5],
  ["selected choice text on #eef2ff", rgb("text"), toRgb("#eef2ff"), 4.5],
  ["mastered pill text", rgb("brand-2-ink"), rgb("brand-2"), 4.5],
  ["muted text on hero gradient end", rgb("muted"), toRgb("#ccfbf1"), 4.5],
  ["page-background tint behind text (#e0e7ff)", rgb("muted"), toRgb("#e0e7ff"), 4.5],
  ["table header muted on card", rgb("muted"), rgb("card"), 4.5],
  ["focus ring on page (non-text)", rgb("focus"), rgb("bg"), 3],
  ["focus ring on card (non-text)", rgb("focus"), rgb("card"), 3],
  ["input border on card (non-text)", rgb("border-strong"), rgb("card"), 3],
  ["input border on page (non-text)", rgb("border-strong"), rgb("bg"), 3],
  ["hold bar on camera (non-text)", rgb("brand-2"), toRgb("#000000"), 3],
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
