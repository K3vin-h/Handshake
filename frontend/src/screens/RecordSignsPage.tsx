import { useRef, useState } from "react";
import { SIGNS, inFrame, useHandTracking, type HandFrame } from "../cv";
import { frameVector } from "../cv/signSequence";
import { MIN_TAKES, exportTemplates, loadLocalTakes, saveLocalTakes, storeTake } from "../cv/signStore";
import { Camera } from "../components/Camera";

// Dev tool: record a few takes of a whole sign (HELLO, MY, NAME, ...). Each take is the hand's landmarks over ~2.5 s.
// Export JSON → commit as src/cv/signTemplates.json. The lesson then checks signs against these takes (SequenceChecker).
const COUNTDOWN_MS = 3000;
const TAKE_MS = 2500;

export function RecordSignsPage() {
  const [sign, setSign] = useState("HELLO");
  const [takes, setTakes] = useState(loadLocalTakes);
  const [phase, setPhase] = useState<"idle" | "countdown" | "recording">("idle");
  const [msg, setMsg] = useState("");
  const startedAt = useRef(0);
  const buf = useRef<number[][]>([]);
  const signRef = useRef(sign);
  signRef.current = sign;

  const cam = useHandTracking((hand: HandFrame | null, now) => {
    if (phase === "idle") return;
    const t = now - startedAt.current;
    if (phase === "countdown") {
      setMsg(`Get ready… ${Math.ceil((COUNTDOWN_MS - t) / 1000)}`);
      if (t >= COUNTDOWN_MS) { startedAt.current = now; buf.current = []; setPhase("recording"); }
      return;
    }
    const two = SIGNS[signRef.current]?.hands === 2;
    // Same rule as the live check: a hand partly out of the frame is not seen there, so it is not recorded here either.
    if (hand && (!two || hand.other) && inFrame(hand) && (!two || inFrame(hand.other!))) buf.current.push(frameVector(hand, two));
    setMsg(`Recording… ${((TAKE_MS - t) / 1000).toFixed(1)}s`);
    if (t >= TAKE_MS) {
      setPhase("idle");
      if (buf.current.length < 20) { setMsg("Too few frames in view: keep the WHOLE hand (wrist included) inside the picture, sit further back if you need to, and try again."); return; }
      const next = { ...takes, [signRef.current]: [...(takes[signRef.current] ?? []), storeTake(buf.current)] };
      setTakes(next);
      saveLocalTakes(next);
      setMsg(`Saved take ${next[signRef.current].length} of ${signRef.current}.`);
    }
  });

  const start = () => { startedAt.current = performance.now(); setPhase("countdown"); };
  const clear = () => { const next = { ...takes }; delete next[sign]; setTakes(next); saveLocalTakes(next); setMsg(`Cleared ${sign}.`); };
  const exportJson = () => {
    const blob = new Blob([JSON.stringify(exportTemplates())], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "signTemplates.json";
    a.click();
  };
  const n = takes[sign]?.length ?? 0;

  return (
    <div className="page">
      <h1>Record signs</h1>
      <p className="muted">
        Pick a sign, press Record, and sign it once after the countdown (about 2.5 s). Record {MIN_TAKES}+ takes (8–10 is better),
        varying distance and speed a little. The sign must stay in view. Export, then commit the file as <code>src/cv/signTemplates.json</code>.
        Takes recorded here are used in this browser straight away. This follows one hand and checks "matches our recording".
      </p>
      <Camera {...cam} />
      <div className="row">
        <select aria-label="Sign" value={sign} onChange={(e) => setSign(e.target.value)}>
          {Object.keys(SIGNS).map((id) => <option key={id}>{id}</option>)}
        </select>
        <button disabled={phase !== "idle" || cam.status !== "ready"} onClick={start}>Record {sign}</button>
        <button className="secondary" onClick={clear}>Clear {sign}</button>
        <button className="secondary" onClick={exportJson}>Export JSON</button>
      </div>
      <p role="status" aria-live="polite">{msg || SIGNS[sign]?.howTo}{SIGNS[sign]?.hands === 2 ? " Keep BOTH hands in view." : ""}</p>
      <div className="grid">
        {Object.keys(SIGNS).map((id) => {
          const c = takes[id]?.length ?? 0;
          return <span key={id} className={c >= MIN_TAKES ? "chip ok" : "chip"}>{id}: {c}</span>;
        })}
      </div>
      <p className="muted">{sign}: {n} take{n === 1 ? "" : "s"} here.</p>
    </div>
  );
}
