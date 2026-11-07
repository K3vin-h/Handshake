import { useRef, useState } from "react";
import { FEATURE_VERSION, extractFeatures, useHandTracking, type HandFrame } from "../cv";
import { getLocalTemplates, saveLocalTemplates } from "../cv/classifier";
import { worldPose } from "../cv/pose3d";
import type { Template } from "../cv/types";
import { Camera } from "../components/Camera";

// Dev tool: hold a letter, press Record, and it captures ~30 frames.
// Exported JSON is used two ways:
//   1. commit as src/cv/templates.json → kNN uses it directly
//   2. copy to training/data/recorded/ → train.py mixes it with the Kaggle data

const LETTERS = [..."ABCDEFGHIKLMNOPQRSTUVWXY".split(""), "5"]; // no J/Z (they move); "5" = open hand, used by signs
const SAMPLES = 30;

export function RecordPage() {
  const [letter, setLetter] = useState("A");
  const [person, setPerson] = useState("ryan");
  const [templates, setTemplates] = useState<Template[]>(getLocalTemplates());
  const [recording, setRecording] = useState(0); // samples left
  const latest = useRef<HandFrame | null>(null);
  const lastCapture = useRef(0);
  const buffer = useRef<Template[]>([]);

  const cam = useHandTracking((hand, now) => {
    latest.current = hand;
    if (recording > 0 && hand && now - lastCapture.current > 60) {
      lastCapture.current = now;
      buffer.current.push({ letter, features: extractFeatures(hand), v: FEATURE_VERSION, world: worldPose(hand) });
      const left = SAMPLES - buffer.current.length;
      setRecording(left);
      if (left <= 0) {
        const next = [...templates, ...buffer.current];
        buffer.current = [];
        setTemplates(next);
        saveLocalTemplates(next);
      }
    }
  });

  const counts = LETTERS.map((l) => [l, templates.filter((t) => t.letter === l).length] as const);

  function exportJson() {
    const blob = new Blob([JSON.stringify(templates)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `templates-${person || "anon"}.json`;
    a.click();
  }

  function clearLetter() {
    const next = templates.filter((t) => t.letter !== letter);
    setTemplates(next);
    saveLocalTemplates(next);
  }

  return (
    <div className="page">
      <h1>Record templates</h1>
      <p className="muted">
        Hold the sign, then press Record. Move your hand a little while it records (angle, distance, slight rotation) so
        examples vary. Record once in good light and once in dim light. One person per export.
      </p>
      <Camera {...cam} />
      <div className="row">
        <input aria-label="Person" value={person} onChange={(e) => setPerson(e.target.value)} placeholder="name" />
        <select aria-label="Letter" value={letter} onChange={(e) => setLetter(e.target.value)}>
          {LETTERS.map((l) => (
            <option key={l}>{l}</option>
          ))}
        </select>
        <button
          disabled={recording > 0 || cam.status !== "ready"}
          onClick={() => {
            buffer.current = [];
            setRecording(SAMPLES);
          }}
        >
          {recording > 0 ? `Recording… ${recording}` : `Record ${letter}`}
        </button>
        <button className="secondary" onClick={clearLetter}>Clear {letter}</button>
        <button className="secondary" onClick={exportJson}>Export JSON ({templates.length})</button>
      </div>
      <div className="grid">
        {counts.map(([l, n]) => (
          <span key={l} className={n >= SAMPLES ? "chip ok" : "chip"}>
            {l}: {n}
          </span>
        ))}
      </div>
    </div>
  );
}
