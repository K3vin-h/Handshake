import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ReduceMotionSetting } from "../components/motion/MotionProvider";
import { DEMO_PROFILE, loadProfile } from "../lib/profile";
import { useEffect, useState } from "react";
import { HaloField } from "../components/HaloField";
import { StatusMessage } from "../components/StatusMessage";
import { deleteAccount, getUser, logOut, subscribe, type User } from "../lib/auth";
import { authMessage } from "../lib/authErrors";

// ponytail: keys mirror profile.ts / progress.ts / mistakes.ts (not exported there). The reload below also clears
// their in-memory fallbacks, which would otherwise keep serving the old profile.
const LOCAL_KEYS = ["handshake.profile.v1", "handshake.progress.v1", "handshake.mistakes.v1"];

/** Account section: shown only when signed in. Delete needs the exact word DELETE typed in a labelled field. */
function AccountSettings({ user }: { user: User | null }) {
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  if (!user) return null;

  async function out() {
    setErr("");
    const r = await logOut();
    if (!r.ok) setErr(authMessage(r.error));
  }
  async function del() {
    if (busy || confirm !== "DELETE") return;
    setBusy(true);
    setErr("");
    const r = await deleteAccount();
    if (!r.ok) {
      setBusy(false);
      return setErr(authMessage(r.error));
    }
    for (const k of LOCAL_KEYS) try { localStorage.removeItem(k); } catch { /* storage blocked: the reload clears memory */ }
    location.hash = "#/welcome";
    location.reload();
  }

  return (
    <Card className="mb-4 rounded-3xl border-2" aria-labelledby="set-account">
      <CardHeader>
        <CardTitle id="set-account" className="text-xl">Account</CardTitle>
        <CardDescription>Your names and progress are saved to this account.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="setting-row">
          <p className="setting-title">{user.email}</p>
          <button type="button" className="secondary" onClick={() => void out()}>Log out</button>
        </div>
        <form className="stack" onSubmit={(e) => { e.preventDefault(); void del(); }} noValidate>
          <HaloField
            id="delete-confirm"
            label="Type DELETE to delete your account"
            description="This removes your account and its saved names and progress from our server, and clears this browser. It cannot be undone."
            value={confirm}
            autoComplete="off"
            onChange={(e) => setConfirm(e.target.value)}
          />
          <button type="submit" className="secondary" disabled={busy || confirm !== "DELETE"}>
            {busy ? "Deleting..." : "Delete account"}
          </button>
        </form>
        <StatusMessage kind="error" label={false} message={err} />
      </CardContent>
    </Card>
  );
}

// Settings: names and hand (edited on the welcome screen), motion, and the privacy note.
// Reads the profile from localStorage. Only the Account section (signed in) calls /api (log out, delete).

export function Settings() {
  const profile = loadProfile() ?? DEMO_PROFILE;
  const [user, setUser] = useState<User | null>(getUser());
  useEffect(() => subscribe(setUser), []);
  return (
    <div className="page">
      <header className="hero">
        <p className="eyebrow">Settings</p>
        <h1>Settings</h1>
      </header>

      <Card className="mb-4 rounded-3xl border-2" aria-labelledby="set-names">
        <CardHeader>
          <CardTitle id="set-names" className="text-xl">Names and hand</CardTitle>
          <CardDescription>{user ? "Stored in this browser and saved to your account." : "Stored in this browser only."}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="setting-row">
            <p className="setting-title">
              {profile.userName}{profile.theirName ? ` → ${profile.theirName}` : " (learning for yourself)"} · {profile.leftHanded ? "Left" : "Right"}-handed
            </p>
            <a className="button-link secondary" href="#/welcome">Change names or hand</a>
          </div>
        </CardContent>
      </Card>

      <AccountSettings user={user} />

      <Card className="mb-4 rounded-3xl border-2" aria-labelledby="set-motion">
        <CardHeader>
          <CardTitle id="set-motion" className="text-xl">Motion</CardTitle>
        </CardHeader>
        <CardContent>
          <ReduceMotionSetting />
        </CardContent>
      </Card>

      <Card className="rounded-3xl border-2" aria-labelledby="set-privacy">
        <CardHeader>
          <CardTitle id="set-privacy" className="text-xl">Privacy</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="muted">{user ? "Your names and progress are saved to your account and deleted when you delete it." : "Your names and progress stay in this browser."} The coach receives letters and finger codes only, never names or video.</p>
        </CardContent>
      </Card>
    </div>
  );
}
