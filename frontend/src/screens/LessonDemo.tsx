import { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import {
  HoldConfirm,
  MAX_DISTANCE,
  Recognizer,
  VoteBuffer,
  candidatesFor,
  extractFeatures,
  getHandFeedback,
  loadTemplates,
  meanPose3D,
  meanTemplate,
  setMaxDistance,
  useHandTracking,
  type HandFrame,
  type Prediction,
} from "../cv";
import { getCoachTip, praise } from "../lib/api";
import type { Praise } from "../lib/praise";
import { Camera } from "../components/Camera";
import { RewardLine } from "../components/RewardLine";

// Three.js is ~200 KB+, so the 3D viewer loads only when a lesson opens.
const HandModel3D = lazy(() => import("../components/HandModel3D"));

// Integration test screen: proves CV → UI → Gemini coach works end to end,
// with a debug panel for tuning at the venue. Teammate A builds the real lesson screen.

const TARGETS = ["L", "I", "L", "Y"];
const LESSON_LETTERS = ["L", "I", "Y"];
const MISS_MS = 4000;
/** Letter picker for the non-recorder test. A single letter competes against ALL of these. */
const TEST_LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "5"];

export function LessonDemo() {
  const templates = useMemo(loadTemplates, []);
  const recognizer = useMemo(() => new Recognizer(templates), [templates]);
  const [source, setSource] = useState<"mlp" | "knn">("knn");
  const [step, setStep] = useState(0);
  const [pred, setPred] = useState<Prediction | null>(null);
  const [progress, setProgress] = useState(0);
  const [xp, setXp] = useState(0);
  const [tip, setTip] = useState("");
  const [reward, setReward] = useState<Praise | undefined>();
  const [holdMs, setHoldMs] = useState(800);
  const [maxDist, setMaxDist] = useState(MAX_DISTANCE);
  const [restrict, setRestrict] = useState(true);
  const [mirror3d, setMirror3d] = useState(false);
  const [mode, setMode] = useState("LILY"); // "LILY" = the demo word, or one letter to test
  const [tally, setTally] = useState({ hits: 0, misses: 0 });
  const targets = mode === "LILY" ? TARGETS : [mode];
  const lessonLetters = mode === "LILY" ? LESSON_LETTERS : TEST_LETTERS;
  const hold = useRef(new HoldConfirm(holdMs));
  const votes = useRef(new VoteBuffer(10));
  const startedAt = useRef(performance.now());
  const misses = useRef(0);
  const asking = useRef(false);
  const lastHand = useRef<HandFrame | null>(null);
  const target = targets[step % targets.length];
  const pose = useMemo(() => meanPose3D(target, templates, mirror3d), [target, templates, mirror3d]);

  useEffect(() => {
    recognizer.ready.then(() => setSource(recognizer.source));
  }, [recognizer]);
  useEffect(() => {
    hold.current = new HoldConfirm(holdMs);
  }, [holdMs]);
  useEffect(() => {
    setMaxDistance(maxDist);
  }, [maxDist]);

  const cam = useHandTracking((hand, now) => {
    lastHand.current = hand;
    if (!hand) {
      setPred(null);
      setProgress(0);
      votes.current.reset();
      return;
    }
    const features = extractFeatures(hand);
    const raw = recognizer.predict(features, restrict ? candidatesFor(target, lessonLetters) : undefined);
    const p = votes.current.push(raw);
    setPred(p);
    const detection = hold.current.update(p, now);
    setProgress(hold.current.progress(now));

    if (detection?.letter === target) {
      setXp((x) => x + 10);
      setTally((t) => ({ ...t, hits: t.hits + 1 }));
      setTip("");
      setReward(undefined);
      void praise("letter", target, { tries: misses.current + 1 }).then(setReward); // after the match; never gates the next letter
      misses.current = 0;
      hold.current.reset();
      votes.current.reset();
      startedAt.current = now;
      setStep((s) => s + 1);
      return;
    }

    // Two misses → ask the Gemini coach what's off, with a cropped snapshot.
    if (now - startedAt.current > MISS_MS) {
      startedAt.current = now;
      misses.current += 1;
      setTally((t) => ({ ...t, misses: t.misses + 1 }));
      const mean = meanTemplate(target, templates);
      if (misses.current >= 2 && mean && !asking.current) {
        asking.current = true;
        const feedback = getHandFeedback(features, mean);
        getCoachTip(target, feedback, misses.current, cam.snapshot(lastHand.current))
          .then((r) => setTip(r.tip))
          .catch(() => setTip("Couldn't reach the coach. Compare your hand to the reference."))
          .finally(() => (asking.current = false));
      }
    }
  });

  const noData = templates.length === 0 && source === "knn";

  return (
    <div className="page">
      <div className="row spread">
        <h1>Sign: {target}</h1>
        <span className="chip ok">XP {xp}</span>
      </div>
      <div className="row">
        <label>
          Practice{" "}
          <select
            value={mode}
            onChange={(e) => {
              setMode(e.target.value);
              setStep(0);
              setTally({ hits: 0, misses: 0 });
              setTip("");
              misses.current = 0;
              hold.current.reset();
              votes.current.reset();
            }}
          >
            <option value="LILY">L-I-L-Y (demo)</option>
            {TEST_LETTERS.map((l) => (
              <option key={l} value={l}>
                {l === "5" ? "5 (open hand)" : l}
              </option>
            ))}
          </select>
        </label>
        <span className="chip" role="status" aria-live="polite">
          Matches {tally.hits} · Misses {tally.misses}
        </span>
        <button className="secondary" onClick={() => setTally({ hits: 0, misses: 0 })}>
          Reset count
        </button>
      </div>
      {noData && (
        <p className="warn">
          No templates or trained model yet. Record letters at <a href="#/record">#/record</a>, or train a model (see
          training/README.md).
        </p>
      )}
      <div className="lesson-grid">
        <section aria-label={`How to sign ${target}`}>
          <Suspense fallback={<div className="hand3d empty">Loading 3D hand…</div>}>
            <HandModel3D pose={pose} letter={target} />
          </Suspense>
          <label className="check muted">
            <input type="checkbox" checked={mirror3d} onChange={(e) => setMirror3d(e.target.checked)} />
            Mirror (left-handed view)
          </label>
        </section>
        <section aria-label="Your camera">
          <Camera {...cam} progress={progress} />
        </section>
      </div>
      <RewardLine reward={reward} />
      {tip && <div className="tip">Coach: {tip}</div>}

      <details className="debug" open>
        <summary>Debug ({source === "mlp" ? "trained model" : "kNN"})</summary>
        <p className="muted">
          Seeing <b>{pred?.letter ?? "—"}</b> · confidence {pred ? Math.round(pred.confidence * 100) : 0}%
          {source === "knn" && pred && isFinite(pred.distance) && <> · distance {pred.distance.toFixed(2)}</>}
          {" "}· hand <b>{lastHand.current?.handedness ?? "—"}</b>
          {" "}· lighting {cam.lighting}
          {cam.enhancing ? " (CLAHE on)" : ""}
        </p>
        <label>
          Hold time {holdMs} ms
          <input type="range" min={300} max={1500} step={50} value={holdMs} onChange={(e) => setHoldMs(+e.target.value)} />
        </label>
        {source === "knn" && (
          <label>
            Max distance {maxDist.toFixed(2)}
            <input type="range" min={0.5} max={4} step={0.05} value={maxDist} onChange={(e) => setMaxDist(+e.target.value)} />
          </label>
        )}
        <label className="check">
          <input type="checkbox" checked={restrict} onChange={(e) => setRestrict(e.target.checked)} />
          Only compare against this lesson's letters + look-alikes
        </label>
        <button
          className="secondary"
          onClick={() => {
            const s = cam.snapshot(lastHand.current);
            if (!s) return;
            const a = document.createElement("a");
            a.href = s;
            a.download = `snap-${target}-${Date.now()}.jpg`;
            a.click();
          }}
        >
          Download snapshot
        </button>
      </details>
    </div>
  );
}
