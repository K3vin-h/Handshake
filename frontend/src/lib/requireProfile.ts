import { loadProfile, type Profile } from "./profile";

/**
 * The saved onboarding profile, for screens that only open after onboarding (App sends everyone else to #/welcome).
 * There is no built-in default name: if the profile is somehow missing, go to the welcome steps.
 */
export function requireProfile(): Profile {
  const p = loadProfile();
  if (!p) {
    if (typeof location !== "undefined") location.hash = "#/welcome";
    return { userName: "", theirName: "", leftHanded: false };
  }
  return p;
}
