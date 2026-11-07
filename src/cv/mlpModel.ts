import type { FeatureVector } from "./types";
import { FEATURE_LENGTH, FEATURE_VERSION } from "./features";

// Loads the neural network trained by training/train.py (scikit-learn MLP,
// exported to public/model/model.json) and runs it with TensorFlow.js.
// If no model file exists, recognizer.ts falls back to kNN automatically.

type Layer = { W: number[][]; b: number[] };
type ModelFile = {
  featureVersion: number;
  labels: string[];
  mean: number[];
  scale: number[];
  layers: Layer[];
  activation: "relu" | "tanh" | "logistic";
  testAccuracy?: number;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TF = any;

export type MlpModel = {
  labels: string[];
  testAccuracy?: number;
  predict(features: FeatureVector): number[]; // probabilities, same order as labels
};

let loading: Promise<MlpModel | null> | null = null;

export function loadMlp(url = "/model/model.json"): Promise<MlpModel | null> {
  if (loading) return loading;
  loading = (async () => {
    let file: ModelFile;
    try {
      const res = await fetch(url, { cache: "no-cache" });
      if (!res.ok) return null;
      file = await res.json();
    } catch {
      return null;
    }
    if (file.featureVersion !== FEATURE_VERSION || file.mean.length !== FEATURE_LENGTH) {
      console.warn("[handshake] model.json was trained on a different feature version; using kNN instead.");
      return null;
    }

    const tf: TF = await import("@tensorflow/tfjs");
    await tf.ready();
    const mean = tf.tensor1d(file.mean);
    const scale = tf.tensor1d(file.scale);
    const layers = file.layers.map((l) => ({ W: tf.tensor2d(l.W), b: tf.tensor1d(l.b) }));
    const act = (x: TF) => (file.activation === "tanh" ? tf.tanh(x) : file.activation === "logistic" ? tf.sigmoid(x) : tf.relu(x));

    return {
      labels: file.labels,
      testAccuracy: file.testAccuracy,
      predict(features: FeatureVector) {
        return tf.tidy(() => {
          let h = tf.tensor2d([features]).sub(mean).div(scale);
          layers.forEach((l, i) => {
            h = h.matMul(l.W).add(l.b);
            if (i < layers.length - 1) h = act(h);
          });
          return Array.from(tf.softmax(h).dataSync() as Float32Array);
        });
      },
    };
  })();
  return loading;
}
