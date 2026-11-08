// Public API of the CV engine. Frontend code imports from "src/cv" only.
export { useHandTracking } from "./useHandTracking";
export { normalize } from "./normalize";
export { extractFeatures, FEATURE_VERSION } from "./features";
export { classify, loadTemplates, meanTemplate, MAX_DISTANCE, setMaxDistance } from "./classifier";
export { Recognizer, candidatesFor, CONFUSABLE } from "./recognizer";
export { HoldConfirm } from "./holdConfirm";
export { VoteBuffer } from "./temporal";
export { getHandFeedback } from "./feedback";
export { meanPose3D, worldPose, HAND_BONES, type Vec3 } from "./pose3d";
export type { LightingStatus } from "./lighting";
export type { SignDetection, FingerFeedback, HandFrame, Prediction } from "./types";
export { PRACTICEABLE, isPracticeable } from "./practiceable";
export { useLetterCheck, inFrame, type LetterCheckOptions } from "./useLetterCheck";
export type { ErrorCode, Finger } from "./types";
export { SIGNS, SignChecker, zoneOf, classifyMovement, ZONES, shapeTip, type SignDef, type SignStage } from "./signs";
export type { FaceAnchors } from "./faceTracker";
