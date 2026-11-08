import { useEffect, useMemo, useState, type ReactNode } from "react";
import { SIGNS, SignChecker, isPracticeable, useLetterCheck, zoneOf } from "../cv";
import { Camera } from "../components/Camera";

/** Cut rule (H14): false → every sign is self-checked with "I signed it". */
export const SIGNS_AUTO = true;

/** `token` = index of the original token, so "fs:RYAN" letters all highlight the same chip. */
export type RunUnit = ({ kind: "sign"; id: string } | { kind: "letter"; letter: string }) & { token: number };

/** "fs:LILY" → fingerspelled letters (practiceable only); anything else is a SIGNS id. */
export const unitsOf = (tokens: string[]): RunUnit[] =>
  tokens.flatMap((t, token): RunUnit[] =>
    t.startsWith("fs:") ? [...t.slice(3)].filter(isPracticeable).map((letter) => ({ kind: "letter", letter, token })) : [{ kind: "sign", id: t, token }],
  );

type RenderArgs = { camera: ReactNode; prompt: string; index: number; token: number; units: RunUnit[]; selfCheck?: () => void };

/**
 * Walks a list of tokens (signs and fingerspelled words) one part at a time on ONE camera.
 * Letters use the same recognizer as lessons; assisted signs use SignChecker (handshape → place → movement);
 * self-graded signs (or all signs when SIGNS_AUTO is false) wait for "I signed it".
 */
export function TokenRunner(props: { tokens: string[]; leftHanded: boolean; onDone: () => void; render: (a: RenderArgs) => ReactNode }) {
  const tokensKey = props.tokens.join(" ");
  const units = useMemo(() => unitsOf(props.tokens), [tokensKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const [k, setK] = useState(0);
  const [msg, setMsg] = useState("");
  const [zone, setZone] = useState("");
  useEffect(() => setK(0), [tokensKey]); // the same runner (and camera) is reused for the next step
  const u = units[k];
  const def = u?.kind === "sign" ? SIGNS[u.id] : undefined;
  const auto = u?.kind === "letter" || (SIGNS_AUTO && def?.grading === "assisted");
  const checker = useMemo(() => (def ? new SignChecker(def) : null), [def]);
  const advance = () => {
    setMsg("");
    checker?.reset(); // the same sign can come up again (e.g. YOU in consecutive scene turns)
    if (k + 1 < units.length) setK(k + 1);
    else {
      setK(0);
      props.onDone();
    }
  };

  const check = useLetterCheck(u?.kind === "letter" ? u.letter : def?.handshape ?? "", [], {
    leftHanded: props.leftHanded,
    enabled: !!u && auto,
    onMatch: () => u?.kind === "letter" && advance(),
    onFrame: (hand, pred, now) => {
      if (!checker || !auto) return;
      if (hand) setZone(zoneOf(hand));
      const r = checker.update(hand, pred, now);
      setMsg(r.message);
      if (r.stage === "done") advance();
    },
  });

  if (!u) return null;
  const prompt =
    u.kind === "letter" ? `Fingerspell ${u.letter}` : !def ? `Sign ${u.id}` : auto ? msg || def.howTo : `${def.howTo} Then press "I signed it".`;
  const camera = (
    <>
      <Camera {...check.cam} progress={check.progress} />
      <p className="muted">debug: zone {zone || "–"} · seeing {check.prediction?.letter ?? "–"}</p>
    </>
  );
  return <>{props.render({ camera, prompt, index: k, token: u.token, units, selfCheck: auto ? undefined : advance })}</>;
}
