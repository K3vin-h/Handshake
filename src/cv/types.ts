// Shared CV types. The frontend only needs SignDetection and FingerFeedback.

/** One MediaPipe landmark (normalized image coords, z relative to wrist). */
export type Landmark = { x: number; y: number; z: number };

/** 21 landmarks for one hand, plus which hand MediaPipe thinks it is. */
export type HandFrame = { landmarks: Landmark[]; worldLandmarks?: Landmark[]; handedness: "Left" | "Right" };

/** 88 numbers from features.ts (coords + curl + direction + tip distances). */
export type FeatureVector = number[];

/** A recorded example of one letter. `v` = FEATURE_VERSION it was recorded with. */
export type Template = {
  letter: string;
  features: FeatureVector;
  v?: number;
  /** 21 × (x, y, z) world landmarks in metres, wrist-centred, mirrored to a right hand. Drives the 3D viewer. */
  world?: number[];
};

export type Prediction = {
  letter: string | null; // null = no confident match
  confidence: number; // 0..1
  distance: number; // kNN: distance to nearest example; MLP: NaN
  source?: "mlp" | "knn";
};

/** Emitted once a sign has been held steadily (see holdConfirm.ts). */
export type SignDetection = { letter: string; confidence: number };

/** "What's off" for the Gemini coach, e.g. { finger: "thumb", issue: "too open" }. */
export type FingerFeedback = { finger: string; issue: string };
