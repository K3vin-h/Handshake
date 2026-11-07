import { useEffect, useMemo, useRef, useState } from "react";
import { useHandTracking } from "./useHandTracking";
import { extractFeatures } from "./features";
import { loadTemplates, meanTemplate } from "./classifier";
import { Recognizer, candidatesFor } from "./recognizer";
import { VoteBuffer } from "./temporal";
import { HoldConfirm } from "./holdConfirm";
import { getHandFeedback } from "./feedback";
import type { FingerFeedback, HandFrame, Prediction, SignDetection, Template } from "./types";

const MISS_MS = 4000;
const NONE: Prediction = { letter: null, confidence: 0, distance: Infinity };

export type LetterCheckOptions = {
  leftHanded?: boolean;
  holdMs?: number;
  enabled?: boolean;
  onMatch?: (d: SignDetection) => void;
  onMiss?: (feedback: FingerFeedback[], missCount: number) => void;
  onFrame?: (hand: HandFrame | null, pred: Prediction, now: number) => void;
};

/** A hand touching the frame edge gives bad landmarks: treat it as no hand. */
export const inFrame = (h: HandFrame) => h.landmarks.length === 21 && h.landmarks.every((p) => p.x > 0.01 && p.x < 0.99 && p.y > 0.01 && p.y < 0.99);

// One recognizer for the whole app, so the MLP loads once.
let engine: { templates: Template[]; recognizer: Recognizer } | null = null;
function getEngine() {
  if (!engine) {
    const templates = loadTemplates();
    engine = { templates, recognizer: new Recognizer(templates) };
  }
  engine.templates = loadTemplates();
  engine.recognizer.setTemplates(engine.templates);
  return engine;
}

export function useLetterCheck(target: string, lessonLetters: string[], opts: LetterCheckOptions = {}) {
  const { templates, recognizer } = useMemo(getEngine, []);
  const [progress, setProgress] = useState(0);
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [missCount, setMissCount] = useState(0);
  const [hint, setHint] = useState("");
  const hold = useRef(new HoldConfirm(opts.holdMs ?? 800));
  const votes = useRef(new VoteBuffer(10));
  const since = useRef(performance.now());
  const misses = useRef(0);
  const lastHand = useRef<HandFrame | null>(null);
  const o = useRef(opts);
  o.current = opts;
  const lettersKey = lessonLetters.join("");
  const candidates = useMemo(() => candidatesFor(target, lessonLetters), [target, lettersKey]); // eslint-disable-line react-hooks/exhaustive-deps

  function reset() {
    hold.current.reset();
    votes.current.reset();
    since.current = performance.now();
    misses.current = 0;
    setMissCount(0);
    setProgress(0);
  }
  useEffect(reset, [target]);

  const cam = useHandTracking(
    (raw, now) => {
      const hand = raw && inFrame(raw) ? raw : null;
      lastHand.current = hand;
      setHint(raw && !hand ? "Move your whole hand into the frame" : "");
      if (o.current.enabled === false || !target) {
        hold.current.reset();
        votes.current.reset();
        setProgress(0);
        since.current = now;
        return;
      }
      if (!hand) {
        // No hand = start over: a fresh full hold is needed, and time without a hand isn't a miss.
        setPrediction(null);
        setProgress(0);
        votes.current.reset();
        hold.current.reset();
        since.current = now;
        o.current.onFrame?.(null, NONE, now);
        return;
      }
      const features = extractFeatures(hand);
      const p = votes.current.push(recognizer.predict(features, candidates));
      setPrediction(p);
      o.current.onFrame?.(hand, p, now);
      const d = hold.current.update(p.letter === target ? p : NONE, now);
      setProgress(hold.current.progress(now));
      if (d?.letter === target) {
        reset();
        o.current.onMatch?.(d);
        return;
      }
      if (now - since.current > MISS_MS) {
        since.current = now;
        misses.current += 1;
        setMissCount(misses.current);
        const mean = meanTemplate(target, templates);
        o.current.onMiss?.(mean ? getHandFeedback(features, mean) : [], misses.current);
      }
    },
    { dominant: opts.leftHanded ? "left" : "right" },
  );

  return { cam, progress, prediction, missCount, hint, templates, reset, snapshot: () => cam.snapshot(lastHand.current) };
}
