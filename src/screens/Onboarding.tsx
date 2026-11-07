import { DEMO_PROFILE, saveProfile } from "../lib/profile";

// STUB (Group 3, group-3 Task 4). The demo-profile button stays in the real screen too.
export function Onboarding() {
  return (
    <div className="page">
      <h1>Who are you learning for?</h1>
      <button onClick={() => { saveProfile(DEMO_PROFILE); location.hash = "#/"; }}>Use demo profile (Ryan → Lily)</button>
    </div>
  );
}
