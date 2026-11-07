import type { Personalization } from "./curriculum";

// The learner profile lives ONLY in this browser. Names never go to the server.
export type Profile = Personalization & { leftHanded: boolean; goal: string; welcome: string };

const KEY = "handshake.profile.v1";
let memory: Profile | null = null; // fallback when localStorage is blocked

export const DEMO_PROFILE: Profile = {
  userName: "Ryan",
  theirName: "Lily",
  relationship: "coworker",
  leftHanded: false,
  goal: "Introduce myself to Lily",
  welcome: "Let's start with your name, {you}. In a few lessons you'll be saying hello to {them}.",
};

export function loadProfile(): Profile | null {
  try {
    const s = localStorage.getItem(KEY);
    return s ? JSON.parse(s) : memory;
  } catch {
    return memory;
  }
}

export function saveProfile(p: Profile) {
  memory = p;
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* session only */
  }
}

/** Gemini writes {you}/{them}; the names are filled in here, on the device. */
export const fillNames = (text: string, p: Pick<Profile, "userName" | "theirName">) =>
  text.replaceAll("{you}", p.userName).replaceAll("{them}", p.theirName);
