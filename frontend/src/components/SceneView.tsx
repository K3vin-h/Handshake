import type { ReactNode } from "react";

export type SceneViewProps = {
  turns: { them: { gloss: string; english: string }; you: { tokens: string[]; english: string } }[];
  turnIndex: number;
  tokenIndex: number;
  camera: ReactNode;
  prompt: string;
  onSelfCheck?: () => void;
};

// STUB (Group 2 replaces in group-2 Task 11).
export function SceneView(p: SceneViewProps) {
  const t = p.turns[p.turnIndex];
  return (
    <div className="page">
      {p.turns.slice(0, p.turnIndex).map((d, i) => (
        <p key={i}>
          {d.them.english} → {d.you.english}
        </p>
      ))}
      {t && (
        <>
          <p><b>{t.them.gloss}</b> “{t.them.english}”</p>
          <p>{t.you.tokens.map((x, i) => (i === p.tokenIndex ? `[${x}]` : x)).join(" ")}</p>
        </>
      )}
      {p.camera}
      <p role="status" aria-live="polite">{p.prompt}</p>
      {p.onSelfCheck && <button onClick={p.onSelfCheck}>I signed it</button>}
    </div>
  );
}
