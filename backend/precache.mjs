import { readFileSync } from "node:fs";

export function loadPrecache(file = new URL("./precache.json", import.meta.url), warn = console.warn) {
  try {
    const value = JSON.parse(readFileSync(file, "utf8"));
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid precache shape");
    return value;
  } catch (error) {
    if (error.code !== "ENOENT") warn("Precache could not be loaded; starting with live generation and local fallbacks.");
    return {};
  }
}
