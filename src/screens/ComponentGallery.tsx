import { useState } from "react";
import { isPracticeable } from "../cv";
import { CoachTip } from "../components/CoachTip";
import { HoldRing } from "../components/HoldRing";
import { LetterBadge, type LetterStatus } from "../components/LetterBadge";
import { LiveCoverage } from "../components/LiveCoverage";
import { LockedUnit } from "../components/LockedUnit";
import { PathNode } from "../components/PathNode";
import { StatusMessage, type StatusKind } from "../components/StatusMessage";
import { StreakXpChip } from "../components/StreakXpChip";

// Dev screen (#/components): every presentational component with fake data. No camera, no API.
// Use it to check keyboard behaviour: Tab to move, Enter/Space to activate, focus ring always visible.

const STATUSES: { kind: StatusKind; message: string }[] = [
  { kind: "match", message: "your L handshape. Hold it steady for a moment." },
  { kind: "notyet", message: "your index finger is bent. Straighten it and try again." },
  { kind: "info", message: "J and Z are reference only. Practise them from the picture and the steps." },
  { kind: "error", message: "the camera is blocked. Allow camera access in your browser settings." },
];
const LETTER_STATES: LetterStatus[] = ["mastered", "practising", "not-started", "reference-only"];

export function ComponentGallery() {
  const [progress, setProgress] = useState(0.6);
  const [statusIdx, setStatusIdx] = useState(-1);
  const [asked, setAsked] = useState(false);
  const [picked, setPicked] = useState("A");
  const [opened, setOpened] = useState("none");
  const [name, setName] = useState("Lily");
  const s = statusIdx >= 0 ? STATUSES[statusIdx] : undefined;

  return (
    <div className="page">
      <h1>Components (fake data)</h1>

      <h2>LetterBadge</h2>
      <div className="chip-row">
        {LETTER_STATES.map((st) => (
          <LetterBadge key={st} letter={st === "mastered" ? "L" : st === "practising" ? "I" : st === "not-started" ? "A" : "J"} status={st} />
        ))}
      </div>
      <p className="muted">Selectable (buttons): {picked} selected. Locked letters stay focusable but do nothing.</p>
      <div className="chip-row">
        {["A", "B", "J", "Z"].map((l) => (
          <LetterBadge key={l} letter={l} status={isPracticeable(l) ? "not-started" : "reference-only"} selected={picked === l} onSelect={setPicked} />
        ))}
      </div>

      <h2>LiveCoverage</h2>
      <label className="check">
        Name <input value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <LiveCoverage name={name} isLive={isPracticeable} />

      <h2>HoldRing</h2>
      <div className="row">
        <HoldRing progress={progress} label="Hold the L handshape" />
        <label className="check">
          Progress
          <input type="range" min={0} max={100} value={Math.round(progress * 100)} onChange={(e) => setProgress(Number(e.target.value) / 100)} />
        </label>
      </div>

      <h2>StatusMessage</h2>
      <div className="row">
        <button type="button" onClick={() => setStatusIdx((statusIdx + 1) % STATUSES.length)}>
          Next message
        </button>
        <button type="button" className="secondary" onClick={() => setStatusIdx(-1)}>
          Clear
        </button>
      </div>
      <StatusMessage kind={s?.kind ?? "info"} message={s?.message} />

      <h2>CoachTip</h2>
      <CoachTip
        instantTip="Curl your ring and pinky fingers into your palm."
        coachText={asked ? "Your thumb is tucked under, which makes the shape read as an A. Bring it out to the side." : undefined}
        coachCached={asked}
        onAskCoach={() => setAsked(true)}
      />

      <h2>StreakXpChip</h2>
      <div className="row">
        <StreakXpChip streakDays={1} xp={30} />
        <StreakXpChip streakDays={4} xp={240} />
      </div>

      <h2>PathNode</h2>
      <p className="muted">Last opened: {opened}</p>
      <div className="chip-row" style={{ flexDirection: "column" }}>
        <PathNode id="1.1" title="Learn the letters of your name" state="done" xp={30} onOpen={setOpened} />
        <PathNode id="1.2" title="Spell your name" state="current" xp={40} onOpen={setOpened} />
        <PathNode id="1.3" title="Checkpoint" state="available" onOpen={setOpened} />
        <PathNode id="2.1" title="Flat-hand letters" state="locked" onOpen={setOpened} />
      </div>

      <h2>LockedUnit</h2>
      <div className="chip-row" style={{ flexDirection: "column" }}>
        <LockedUnit title="Unit 3 · Greetings and sentences" />
        <LockedUnit title="Unit 4 · Conversation" note="Planned for a later release." />
      </div>
    </div>
  );
}
