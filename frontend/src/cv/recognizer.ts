import { classify } from "./classifier";
import { loadMlp, type MlpModel } from "./mlpModel";
import type { FeatureVector, Prediction, Template } from "./types";

// One entry point for recognition: the trained neural network when
// public/model/model.json exists, otherwise kNN over recorded templates.

/** Letters a webcam easily confuses. Lessons always include these as competitors. */
export const CONFUSABLE: Record<string, string[]> = {
  A: ["S", "E", "T", "M", "N"],
  S: ["A", "E", "T", "M", "N"],
  E: ["A", "S", "O"],
  M: ["N", "A", "S", "T"],
  N: ["M", "A", "S", "T"],
  T: ["A", "S", "M", "N"],
  O: ["C", "E"],
  C: ["O"],
  U: ["V", "R"],
  V: ["U", "K", "W"],
  K: ["V", "P"],
  P: ["K", "Q"],
  Q: ["P", "G"],
  G: ["H", "Q"],
  H: ["G", "U"],
  R: ["U"],
  W: ["V", "F"],
  F: ["W", "B"],
  B: ["F"],
  D: ["I", "L"],
  I: ["D", "Y"],
  Y: ["I"],
  L: ["D"],
};

/** Candidate set for a lesson step: the target, its look-alikes, and the lesson's other letters. */
export function candidatesFor(target: string, lessonLetters: string[] = []): string[] {
  return [...new Set([target, ...(CONFUSABLE[target] ?? []), ...lessonLetters])];
}

export class Recognizer {
  mlp: MlpModel | null = null;
  ready: Promise<void>;
  minMlpConfidence = 0.55;

  constructor(private templates: Template[]) {
    this.ready = loadMlp().then((m) => {
      this.mlp = m;
    });
  }

  get source(): "mlp" | "knn" {
    return this.mlp ? "mlp" : "knn";
  }

  setTemplates(t: Template[]) {
    this.templates = t;
  }

  predict(features: FeatureVector, allowed?: string[]): Prediction {
    if (this.mlp) {
      const probs = this.mlp.predict(features);
      const labels = this.mlp.labels;
      let best = -1;
      for (let i = 0; i < labels.length; i++) {
        if (allowed && !allowed.includes(labels[i])) continue;
        if (best < 0 || probs[i] > probs[best]) best = i;
      }
      // Confidence is the RAW probability: if the model thinks it's a letter outside
      // the lesson, the allowed letters all score low and we report "not sure".
      if (best < 0 || probs[best] < this.minMlpConfidence) {
        return { letter: null, confidence: best < 0 ? 0 : probs[best], distance: NaN, source: "mlp" };
      }
      return { letter: labels[best], confidence: probs[best], distance: NaN, source: "mlp" };
    }
    return { ...classify(features, this.templates, allowed), source: "knn" };
  }
}
