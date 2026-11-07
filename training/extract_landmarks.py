"""Step 1: images -> MediaPipe landmarks -> feature vectors, with lighting augmentation.

Downloads the public Kaggle "ASL Alphabet" dataset (folders A..Z of hand photos),
makes several lighting-augmented copies of each image with Albumentations,
runs the same MediaPipe hand model the browser uses, and saves features to
training/data/kaggle_features.npz.

Usage:
  python training/extract_landmarks.py                    # downloads via kagglehub
  python training/extract_landmarks.py --dataset /path/to/asl_alphabet_train
  python training/extract_landmarks.py --per-class 300 --augment 3
"""
import argparse
import os
import random
import sys
import urllib.request
from pathlib import Path

import albumentations as A
import cv2
import numpy as np
import mediapipe as mp
from mediapipe.tasks.python import BaseOptions, vision

sys.path.insert(0, str(Path(__file__).parent))
from features import FEATURE_VERSION, extract_features  # noqa: E402

HERE = Path(__file__).parent
MODEL_URL = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task"
MODEL_PATH = HERE / "data" / "hand_landmarker.task"
KAGGLE_DATASET = "grassknoted/asl-alphabet"

# Static letters only (J and Z involve motion).
LETTERS = list("ABCDEFGHIKLMNOPQRSTUVWXY")

# Lighting + camera robustness: dark rooms, bright windows, warm/cool bulbs,
# webcam noise and blur, JPEG artefacts, slight angle and distance changes.
AUGMENT = A.Compose(
    [
        A.OneOf(
            [
                A.RandomBrightnessContrast(brightness_limit=(-0.5, 0.3), contrast_limit=(-0.4, 0.3), p=1),
                A.RandomGamma(gamma_limit=(50, 180), p=1),
            ],
            p=0.9,
        ),
        A.HueSaturationValue(hue_shift_limit=10, sat_shift_limit=30, val_shift_limit=30, p=0.5),
        A.RandomShadow(p=0.25),
        A.OneOf([A.MotionBlur(blur_limit=(3, 7), p=1), A.GaussianBlur(blur_limit=(3, 5), p=1)], p=0.3),
        A.GaussNoise(std_range=(0.02, 0.08), p=0.35),
        A.ImageCompression(quality_range=(40, 90), p=0.3),
        A.Affine(rotate=(-12, 12), scale=(0.85, 1.15), translate_percent=(-0.05, 0.05), p=0.6),
    ]
)


def ensure_model():
    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    if not MODEL_PATH.exists():
        print(f"Downloading MediaPipe hand model to {MODEL_PATH}")
        urllib.request.urlretrieve(MODEL_URL, MODEL_PATH)


def find_dataset(arg):
    if arg:
        return Path(arg)
    import kagglehub

    root = Path(kagglehub.dataset_download(KAGGLE_DATASET))
    # The archive nests folders; find the directory that contains A/, B/, ...
    for d in [root, *root.rglob("*")]:
        if d.is_dir() and (d / "A").is_dir() and (d / "B").is_dir() and "test" not in d.name.lower():
            return d
    raise SystemExit(f"Couldn't find letter folders under {root}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dataset", help="folder containing A/, B/, ... (skip to download from Kaggle)")
    ap.add_argument("--per-class", type=int, default=400, help="images sampled per letter")
    ap.add_argument("--augment", type=int, default=2, help="augmented copies per image (plus the original)")
    ap.add_argument("--out", default=str(HERE / "data" / "kaggle_features.npz"))
    ap.add_argument("--seed", type=int, default=7)
    args = ap.parse_args()

    random.seed(args.seed)
    np.random.seed(args.seed)
    ensure_model()
    root = find_dataset(args.dataset)
    print(f"Dataset: {root}")

    detector = vision.HandLandmarker.create_from_options(
        vision.HandLandmarkerOptions(
            base_options=BaseOptions(model_asset_path=str(MODEL_PATH)),
            running_mode=vision.RunningMode.IMAGE,
            num_hands=1,
            min_hand_detection_confidence=0.5,
        )
    )

    X, y = [], []
    for letter in LETTERS:
        folder = root / letter
        if not folder.is_dir():
            print(f"  {letter}: folder missing, skipped")
            continue
        files = sorted(p for p in folder.iterdir() if p.suffix.lower() in {".jpg", ".jpeg", ".png"})
        random.shuffle(files)
        kept = tried = 0
        for path in files[: args.per_class]:
            bgr = cv2.imread(str(path))
            if bgr is None:
                continue
            rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
            variants = [rgb] + [AUGMENT(image=rgb)["image"] for _ in range(args.augment)]
            for img in variants:
                tried += 1
                res = detector.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=np.ascontiguousarray(img)))
                if not res.hand_landmarks:
                    continue
                lms = [(p.x, p.y, p.z) for p in res.hand_landmarks[0]]
                hand = res.handedness[0][0].category_name if res.handedness else "Right"
                X.append(extract_features(lms, "Left" if hand == "Left" else "Right"))
                y.append(letter)
                kept += 1
        print(f"  {letter}: {kept}/{tried} frames had a detectable hand")

    if not X:
        raise SystemExit("No hands detected; check the dataset path.")
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    np.savez_compressed(out, X=np.array(X, dtype=np.float32), y=np.array(y), version=FEATURE_VERSION)
    print(f"Saved {len(X)} samples to {out}")


if __name__ == "__main__":
    main()
