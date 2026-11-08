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
