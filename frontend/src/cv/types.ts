// Shared CV types. The frontend only needs SignDetection and FingerFeedback.

/** One MediaPipe landmark (normalized image coords, z relative to wrist). */
export type Landmark = { x: number; y: number; z: number };

/** 21 landmarks for one hand, plus which hand MediaPipe thinks it is. */
export type HandFrame = {
  landmarks: Landmark[];
  worldLandmarks?: Landmark[];
  handedness: "Left" | "Right";
  /** The other visible hand (two-handed signs only read this; letters ignore it). */
  other?: HandFrame;
};

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

export type Finger = "thumb" | "index" | "middle" | "ring" | "pinky";
export type ErrorCode = `${Finger}:${"curl" | "direction" | "placement"}`;
/** "What's off", e.g. { finger: "thumb", issue: "is too far from the index finger", code: "thumb:placement" }. */
export type FingerFeedback = { finger: Finger; issue: string; code: ErrorCode };
