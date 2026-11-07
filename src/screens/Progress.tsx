import { PRACTICEABLE, isPracticeable } from "../cv";
import { StatusBadge, type BadgeKind } from "../components/StatusBadge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { loadMistakes, weakFingers } from "../lib/mistakes";
import { loadProgress } from "../lib/progress";

// Progress by letter and by finger. Every chart-like element has the numbers as text.
// Reads localStorage only.

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const FINGERS = ["thumb", "index", "middle", "ring", "pinky"];

export function ProgressScreen() {
  const progress = loadProgress();
  const fingerCounts = new Map(weakFingers(loadMistakes(), FINGERS.length).map((f) => [f.finger, f.count]));
  const liveLetters = LETTERS.filter((l) => PRACTICEABLE.includes(l));
  const mastered = liveLetters.filter((l) => progress.items[l]?.mastered).length;
  const maxMiss = Math.max(1, ...FINGERS.map((f) => fingerCounts.get(f) ?? 0));

  const statusOf = (l: string): { kind: BadgeKind; text: string } => {
    if (!isPracticeable(l)) return { kind: "reference", text: "Reference only" };
    const it = progress.items[l];
    if (!it) return { kind: "live", text: "Not started" };
    return it.mastered ? { kind: "mastered", text: "Mastered" } : { kind: "live", text: `Practising: ${Math.min(it.streak, 3)} of 3 in a row` };
  };

  return (
    <div className="page">
      <header className="hero">
        <p className="eyebrow">Progress</p>
        <h1>Your progress</h1>
        <p className="lead">
          {liveLetters.length === 0 ? (
            <strong>No letters are live yet. Every letter is reference only for now.</strong>
          ) : (
            <>
              <strong>{mastered} of {liveLetters.length}</strong> live letters mastered
            </>
          )}
        </p>
        <Progress className="mt-3" value={liveLetters.length ? (mastered / liveLetters.length) * 100 : 0} aria-label="Live letters mastered" />
      </header>

      <Card className="mb-4 rounded-3xl border-2" aria-labelledby="by-letter">
        <CardHeader>
          <CardTitle id="by-letter" className="text-xl">By letter</CardTitle>
          <CardDescription>Mastered means matching the reference 3 times in a row. Reference-only letters have no pass or fail.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Letter</th>
                  <th scope="col">Status</th>
                  <th scope="col">Attempts</th>
                  <th scope="col">Misses</th>
                </tr>
              </thead>
              <tbody>
                {LETTERS.map((l) => {
                  const it = progress.items[l];
                  const st = statusOf(l);
                  return (
                    <tr key={l}>
                      <th scope="row">{l}</th>
                      <td>
                        <StatusBadge kind={st.kind}>{st.text}</StatusBadge>
                      </td>
                      <td>{it?.attempts ?? 0}</td>
                      <td>{it?.misses ?? 0}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-3xl border-2" aria-labelledby="by-finger">
        <CardHeader>
          <CardTitle id="by-finger" className="text-xl">By finger</CardTitle>
          <CardDescription>How often the camera measured each finger away from the reference. Fewer is better.</CardDescription>
        </CardHeader>
        <CardContent>
          {fingerCounts.size === 0 && <p className="muted">No finger differences recorded yet. Practise a lesson and they will appear here.</p>}
          <ul className="finger-list">
            {FINGERS.map((f) => {
              const n = fingerCounts.get(f) ?? 0;
              return (
                <li key={f}>
                  <span className="finger-name">{f[0].toUpperCase() + f.slice(1)}</span>
                  <Progress className="min-w-20 flex-1" value={(n / maxMiss) * 100} aria-label={`${f}: ${n} differences`} />
                  <span className="finger-count">{n} {n === 1 ? "difference" : "differences"}</span>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
