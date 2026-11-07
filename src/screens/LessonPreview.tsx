import { useEffect, useState } from "react";
import { LessonView } from "../components/LessonView";
import { celebrate } from "../components/celebrate";

// #/lesson-preview: LessonView on FAKE data, no camera and no API.
// Keyboard: press D for a detection (target held), M for a miss. Same as the real player's two outcomes.
// Used to check the layout, the status announcements and the reduced-motion behaviour on their own.

const WORD = ["L", "I", "L", "Y"];

export function LessonPreview() {
  const [index, setIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("Press D for a detection or M for a miss.");
  const [tip, setTip] = useState("");
  const [misses, setMisses] = useState(0);
  const target = WORD[index] ?? WORD[WORD.length - 1];

  function detect() {
    setProgress(1);
    setTip("");
    setStatus(`Matches the reference: ${target}`);
    celebrate();
    setTimeout(() => {
      setProgress(0);
      setIndex((i) => Math.min(i + 1, WORD.length - 1));
    }, 600);
  }
  function miss() {
    setMisses((m) => m + 1);
    setProgress(0.3);
    setStatus(`Not matching ${target} yet`);
    setTip("Your index finger is bent. Straighten it and hold still.");
  }

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.target instanceof Element && e.target.closest("input, textarea, select")) return;
      if (e.key.toLowerCase() === "d") detect();
      if (e.key.toLowerCase() === "m") miss();
    };
    addEventListener("keydown", down);
    return () => removeEventListener("keydown", down);
  });

  return (
    <LessonView
      title="Spell LILY (preview)"
      target={target}
      word={{ letters: WORD, index }}
      reference={<div className="hand3d empty">3D reference hand goes here (fake data)</div>}
      showReference
      camera={
        <div className="camera">
          <div className="camera-msg">Camera placeholder (fake data)</div>
        </div>
      }
      progress={progress}
      landmarkTip={tip}
      coachTip={misses >= 2 ? "Think of an L: only your thumb and index finger point out." : ""}
      coachCached={misses >= 2}
      sideBySide={misses >= 3}
      status={status}
      stepLabel={`Step ${index + 1} of ${WORD.length}`}
      actionLabel="Skip"
      onAction={() => setIndex((i) => Math.min(i + 1, WORD.length - 1))}
    />
  );
}

