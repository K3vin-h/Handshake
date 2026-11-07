import type { Personalization } from "./curriculum";

// The learner profile lives ONLY in this browser. Names never go to the server.
// Onboarding asks names + signing hand only; everyone starts at lesson 1.1.
export type Profile = Personalization & { leftHanded: boolean };

/** Home welcome line, same for everyone; names are filled in on the device with fillNames(). */
export const WELCOME = "Let's start with your name, {you}. In a few lessons you'll be saying hello to {them}.";

const KEY = "handshake.profile.v1";
let memory: Profile | null = null; // fallback when localStorage is blocked

export const DEMO_PROFILE: Profile = {
  userName: "Ryan",
  theirName: "Lily",
  leftHanded: false,
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

/** Fills {you}/{them} on the device. */
export const fillNames = (text: string, p: Pick<Profile, "userName" | "theirName">) =>
  text.replaceAll("{you}", p.userName).replaceAll("{them}", p.theirName);
