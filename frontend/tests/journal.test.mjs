import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "vite";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";

test("journal building blocks render accessible markup", async () => {
  const vite = await createServer({ server: { middlewareMode: true }, appType: "custom" });
  try {
    const { Spread, Page, Stamp, Sticker, HandBar, Ink } = await vite.ssrLoadModule("/src/components/journal/Journal.tsx");
    const html = renderToStaticMarkup(
      h(Spread, null,
        h(Page, { side: "left", title: "Hello", number: 1, stain: true }, h(Stamp, { value: 3, label: "day streak" }), h(Sticker, null, "Tip"),
          h(HandBar, { label: "L", value: 11, max: 12, text: "11 of 12" }), h(Ink, { tone: "smudge" }, "Y was hard")),
        h(Page, { side: "right", label: "Alphabet", ribbon: true, number: 2 }, "x")));
    assert.match(html, /<h2[^>]*>Hello<\/h2>/);
    assert.match(html, /jr-ribbon[^>]*aria-hidden="true"|aria-hidden="true"[^>]*jr-ribbon/);
    assert.match(html, /jr-stain[^>]*aria-hidden="true"|aria-hidden="true"[^>]*jr-stain/);
    assert.match(html, /jr-holes[^>]*aria-hidden="true"|aria-hidden="true"[^>]*jr-holes/);
    assert.match(html, /role="progressbar"/);
    assert.match(html, /aria-valuenow="11"/);
    assert.match(html, /aria-valuemax="12"/);
    assert.match(html, /aria-label="L"/);
    assert.match(html, /aria-valuetext="11 of 12"/);
    assert.match(html, /jr-num"? aria-hidden="true"|aria-hidden="true"[^>]*jr-num/);
    assert.match(html, /11 of 12/);
    assert.match(html, /Y was hard/);
    assert.match(html, /day streak/);
  } finally {
    await vite.close();
  }
});
