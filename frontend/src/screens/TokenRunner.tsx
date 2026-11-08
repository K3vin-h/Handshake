import { useEffect, useMemo, useState, type ReactNode } from "react";
import { SIGNS, SequenceChecker, SignChecker, getSignTemplate, isPracticeable, useLetterCheck, zoneOf } from "../cv";
import { Camera } from "../components/Camera";
import { SignGuide } from "./SignGuide";

/** Cut rule (H14): false → every sign is self-checked with "I signed it". */
export const SIGNS_AUTO = true;

/** `token` = index of the original token, so "fs:RYAN" letters all highlight the same chip. */
export type RunUnit = ({ kind: "sign"; id: string } | { kind: "letter"; letter: string }) & { token: number };

/** "fs:LILY" → fingerspelled letters (practiceable only); anything else is a SIGNS id. */
export const unitsOf = (tokens: string[]): RunUnit[] =>
  tokens.flatMap((t, token): RunUnit[] =>
    t.startsWith("fs:") ? [...t.slice(3)].filter(isPracticeable).map((letter) => ({ kind: "letter", letter, token })) : [{ kind: "sign", id: t, token }],
  );

type RenderArgs = { camera: ReactNode; prompt: string; index: number; token: number; units: RunUnit[]; guide: ReactNode; selfCheck?: () => void };

/**
 * Walks a list of tokens (signs and fingerspelled words) one part at a time on ONE camera.
 * Letters use the same recognizer as lessons; assisted signs use SignChecker (handshape → place → movement);
 * self-graded signs (or all signs when SIGNS_AUTO is false) wait for "I signed it".
 */
/** Letters the camera cannot check (J and Z move), so they are skipped by unitsOf. Named so the learner is told, not left guessing. */
const unchecked = (tokens: string[]) => tokens.flatMap((t) => (t.startsWith("fs:") ? [...t.slice(3)].filter((l) => !isPracticeable(l)) : []));

export function TokenRunner(props: {
  tokens: string[];
  leftHanded: boolean;
  onDone: () => void;
  /** Called by "Continue" when NOTHING in these tokens can be camera-checked (e.g. a name of only J and Z). Required, so a
   *  caller must decide what that means; it must NOT count as a pass (the player treats it as a skip). */
  onEmpty: () => void;
  render: (a: RenderArgs) => ReactNode;
}) {
  const tokensKey = props.tokens.join(" ");
  const units = useMemo(() => unitsOf(props.tokens), [tokensKey]); // eslint-disable-line react-hooks/exhaustive-deps
  // Moving letters the camera cannot check, each named once ("JJ" says "J"). Computed once per step, not on every render.
  const movers = useMemo(() => [...new Set(unchecked(props.tokens))], [tokensKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const [k, setK] = useState(0);
  const [msg, setMsg] = useState("");
  const [zone, setZone] = useState("");
  useEffect(() => setK(0), [tokensKey]); // the same runner (and camera) is reused for the next step
  const u = units[k];
  const def = u?.kind === "sign" ? SIGNS[u.id] : undefined;
  // A sign with recorded takes (#/record-signs) is checked against them; otherwise the handshape + place + movement rules.
  const tpl = useMemo(() => (def ? getSignTemplate(def.id) : null), [def]);
  const auto = u?.kind === "letter" || !!tpl || (SIGNS_AUTO && def?.grading === "assisted");
  const checker = useMemo(() => (def && !tpl ? new SignChecker(def) : null), [def, tpl]);
  const seqChecker = useMemo(() => (tpl ? new SequenceChecker(tpl) : null), [tpl]);
  const advance = () => {
    setMsg("");
    checker?.reset();
    seqChecker?.reset(); // the same sign can come up again (e.g. YOU in consecutive scene turns)
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
      if (seqChecker && auto) {
        const r = seqChecker.update(hand, now);
        setMsg(r.message);
        if (r.done) advance();
        return;
      }
      if (!checker || !auto) return;
      if (hand) setZone(zoneOf(hand));
      const r = checker.update(hand, pred, now);
      setMsg(r.message);
      if (r.stage === "done") advance();
    },
  });

  if (!u) {
    // Nothing to check here. Never a blank page: say why and give a way on (it is not counted as a pass).
    return (
      <div className="page">
        <p role="status">
          {movers.length ? `${movers.join(" and ")} move${movers.length === 1 ? "s" : ""}, so the camera can't check ${movers.length === 1 ? "it" : "them"}. Practise by watching and copying.` : "There is nothing for the camera to check in this step."}
        </p>
        <button type="button" onClick={props.onEmpty}>Continue</button>
      </div>
    );
  }
  const prompt =
    u.kind === "letter" ? `Fingerspell ${u.letter}` : !def ? `Sign ${u.id}` : auto ? msg || def.howTo : `${def.howTo} Then press "I signed it".`;
  const camera = (
    <>
      <Camera {...check.cam} progress={check.progress} />
      {import.meta.env.DEV && <p className="muted">debug: zone {zone || "–"} · seeing {check.prediction?.letter ?? "–"}</p>}
      {movers.length > 0 && (
        <p className="muted">
          Not checked by the camera: {movers.join(", ")} (moving letters). Sign {movers.length === 1 ? "it" : "them"} yourself.
        </p>
      )}
    </>
  );
  // Whole signs get a picture guide (handshape + place + movement); fingerspelled letters already have the 3D hand.
  const guide = def ? <SignGuide def={def} templates={check.templates} leftHanded={props.leftHanded} /> : null;
  return <>{props.render({ camera, prompt, index: k, token: u.token, units, guide, selfCheck: auto ? undefined : advance })}</>;
}
