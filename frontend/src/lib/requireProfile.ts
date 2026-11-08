import { loadProfile, type Profile } from "./profile";

/**
 * The saved onboarding profile, for screens that only open after onboarding (App sends everyone else to #/welcome).
 * There is no built-in default name: if the profile is somehow missing, go to the welcome steps.
 */
export function requireProfile(): Profile {
  const p = loadProfile();
  if (!p) {
    // Not during render (a render must not navigate): do it right after. App already sends a profile-less visitor to the
    // welcome steps, so this is only a safety net.
    if (typeof location !== "undefined") queueMicrotask(() => { location.hash = "#/welcome"; });
    return { userName: "", theirName: "", leftHanded: false };
  }
  return p;
}
