import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { meanPose3D, useLetterCheck, type FingerFeedback } from "../cv";
import { Camera } from "../components/Camera";
import { LessonView } from "../components/LessonView";
import { getCoachTip } from "../lib/api";
import { DEMO_PROFILE, loadProfile } from "../lib/profile";

// #/camera-demo: the real webcam + the coach side panel, on one letter at a time.
// DEMO ONLY: nothing here is scored, counted towards mastery, or saved. It does not touch progress,
// mistakes or XP. The coach request sends only the letter, the finger codes and a repeat count (never names or images).

const HandModel3D = lazy(() => import("../components/HandModel3D"));
const LETTERS = ["L", "I", "Y", "A", "B", "C", "D", "E", "F", "G", "H", "K", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "5"]; // every handshape with recorded templates
const INTRO = "Demo: show the letter to the camera. Nothing here is scored or saved.";

export function CameraDemo() {
  const profile = loadProfile() ?? DEMO_PROFILE;
  const [target, setTarget] = useState(LETTERS[0]);
  const [status, setStatus] = useState(INTRO);
  const [landmarkTip, setLandmarkTip] = useState("");
  const [coach, setCoach] = useState({ tip: "", cached: false });
  const [repeat, setRepeat] = useState(0);
  const [matched, setMatched] = useState(false);
  const asking = useRef(false);
  const gen = useRef(0);

  // Candidates are the target + its look-alikes only (like a lesson), not all 25 letters, so the demo is as fair as a lesson.
  const check = useLetterCheck(target, [], {
    leftHanded: profile.leftHanded,
    enabled: !matched, // stop checking once matched; "Try again" restarts (same as the lesson player)
    onMatch: (d) => {
      setMatched(true);
      setStatus(`Matches our recording: ${d.letter} (demo, not scored)`);
      setLandmarkTip("");
    },
    onMiss: (feedback: FingerFeedback[]) => {
      const first = feedback[0];
      setStatus(`Not matching ${target} yet (demo, not scored)`);
      setLandmarkTip(first ? `Your ${first.finger} ${first.issue}.` : "Compare your hand with the reference and hold it still.");
      if (!first || asking.current) return;
      asking.current = true;
      const g = gen.current;
      const n = repeat + 1;
      setRepeat(n);
      getCoachTip(target, feedback, n)
        .then((r) => g === gen.current && setCoach({ tip: r.tip, cached: !!r.cached }))
        .catch(() => {}) // the landmark tip is already on screen
        .finally(() => {
          asking.current = false;
        });
    },
  });

  // Changing the letter clears everything from the previous one.
  useEffect(() => {
    gen.current++;
    asking.current = false;
    setStatus(INTRO);
    setLandmarkTip("");
    setCoach({ tip: "", cached: false });
    setRepeat(0);
    setMatched(false);
    check.reset();
  }, [target]); // eslint-disable-line react-hooks/exhaustive-deps

  // useLetterCheck resets its progress the instant a match fires, so hold the ring and bar full until "Try again".
  const shownProgress = matched ? 1 : check.progress;
  function retry() {
    setMatched(false);
    setStatus(INTRO);
    setLandmarkTip("");
    setCoach({ tip: "", cached: false });
    check.reset();
  }

  const camera = (
    <>
      <Camera {...check.cam} progress={shownProgress} />
      {check.hint && <p role="status">{check.hint}</p>}
      <fieldset className="field demo-letters">
        <legend>Letter to try</legend>
        <div className="choices">
          {LETTERS.map((l) => (
            <label key={l} className="choice">
              <input type="radio" name="demo-letter" checked={target === l} onChange={() => setTarget(l)} />
              <span>{l}</span>
            </label>
          ))}
        </div>
      </fieldset>
    </>
  );

  const reference = (
    <Suspense fallback={<div className="hand3d empty">Loading 3D hand…</div>}>
      <HandModel3D pose={meanPose3D(target, check.templates, profile.leftHanded)} letter={target} />
    </Suspense>
  );

  return (
    <LessonView
      title={`Camera demo: ${target}`}
      target={target}
      reference={reference}
      showReference
      camera={camera}
      progress={shownProgress}
      feedback={matched ? "match" : undefined}
      onRetry={matched ? retry : undefined}
      landmarkTip={landmarkTip}
      coachTip={coach.tip}
      coachCached={coach.cached}
      sideBySide={false}
      status={status}
      stepLabel="Demo · not scored"
      actionLabel="Back to Home"
      onAction={() => {
        location.hash = "#/";
      }}
    />
  );
}
