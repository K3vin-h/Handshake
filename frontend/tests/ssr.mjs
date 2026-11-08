import { createServer } from "vite";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

/** Run `fn(load, render, h)` against a vite SSR server with a stubbed localStorage (same approach as tests/progress.test.mjs). */
export async function withApp(fn, store = {}) {
  const vite = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "silent" });
  const saved = new Map(Object.entries({ "handshake.profile.v1": JSON.stringify({ userName: "Ryan", theirName: "Lily", leftHanded: false }), ...store }));
  const prev = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: (k) => saved.get(k) ?? null, setItem: (k, v) => saved.set(k, v), removeItem: (k) => saved.delete(k) } });
  try {
    return await fn((p) => vite.ssrLoadModule(p), (el) => renderToStaticMarkup(el), createElement);
  } finally {
    if (prev) Object.defineProperty(globalThis, "localStorage", prev); else delete globalThis.localStorage;
    await vite.close();
  }
}
