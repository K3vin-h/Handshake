import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ReduceMotionSetting } from "../components/motion/MotionProvider";
import { requireProfile } from "../lib/requireProfile";

// Settings: names and hand (edited on the welcome screen), motion, and the privacy note.
// Reads the profile from localStorage only. Nothing here calls /api.

export function Settings() {
  const profile = requireProfile();
  return (
    <div className="page">
      <header className="hero">
        <p className="eyebrow">Settings</p>
        <h1>Settings</h1>
      </header>

      <Card className="mb-4 rounded-3xl border-2" aria-labelledby="set-names">
        <CardHeader>
          <CardTitle id="set-names" className="text-xl">Names and hand</CardTitle>
          <CardDescription>Stored in this browser only.</CardDescription>
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
          <p className="muted">Your names and progress stay in this browser. The coach receives letters and finger codes only, never names or video.</p>
        </CardContent>
      </Card>
    </div>
  );
}
