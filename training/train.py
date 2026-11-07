"""Step 2: train a neural network on landmark features and export it for the browser.

Combines:
  - training/data/kaggle_features.npz      (from extract_landmarks.py)
  - training/data/recorded/*.json          (exports from the app's #/record page, one file per person)

Evaluation is honest: one recorded person is held out entirely (never seen in training),
because judges' hands won't be in your training data either.

Exports public/model/model.json, which src/cv/mlpModel.ts loads with TensorFlow.js.
If the file is absent the app uses kNN, so a bad model can just be deleted.

Usage:
  python training/train.py
  python training/train.py --holdout ryan.json --letters ABCDFILOVWY
"""
import argparse
import json
import sys
from pathlib import Path

import numpy as np
from sklearn.metrics import classification_report, confusion_matrix
from sklearn.model_selection import train_test_split
from sklearn.neural_network import MLPClassifier
from sklearn.preprocessing import StandardScaler

sys.path.insert(0, str(Path(__file__).parent))
from features import FEATURE_LENGTH, FEATURE_VERSION  # noqa: E402

HERE = Path(__file__).parent
ROOT = HERE.parent


def load_recorded(folder):
    people = {}
    for f in sorted(Path(folder).glob("*.json")):
        rows = [r for r in json.loads(f.read_text()) if len(r["features"]) == FEATURE_LENGTH and r.get("v", FEATURE_VERSION) == FEATURE_VERSION]
        if rows:
            people[f.name] = (np.array([r["features"] for r in rows], dtype=np.float32), np.array([r["letter"] for r in rows]))
    return people


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--kaggle", default=str(HERE / "data" / "kaggle_features.npz"))
    ap.add_argument("--recorded", default=str(HERE / "data" / "recorded"))
    ap.add_argument("--holdout", help="recorded file held out as the test person (default: the last one)")
    ap.add_argument("--letters", help="restrict to these letters, e.g. ABCDFILOVWY")
    ap.add_argument("--recorded-weight", type=int, default=3, help="repeat recorded samples N times (they match real webcam conditions)")
    ap.add_argument("--hidden", default="128,64")
    ap.add_argument("--out", default=str(ROOT / "public" / "model" / "model.json"))
    args = ap.parse_args()

    parts_X, parts_y = [], []
    if Path(args.kaggle).exists():
        d = np.load(args.kaggle)
        if int(d["version"]) != FEATURE_VERSION:
            raise SystemExit("kaggle_features.npz is from an old feature version; rerun extract_landmarks.py")
        parts_X.append(d["X"])
        parts_y.append(d["y"])
        print(f"Kaggle: {len(d['y'])} samples")
    else:
        print("No Kaggle features found (run extract_landmarks.py). Training on recorded data only.")

    people = load_recorded(args.recorded)
    holdout = args.holdout or (list(people)[-1] if len(people) >= 2 else None)
    test_X = test_y = None
    for name, (X, y) in people.items():
        if name == holdout:
            test_X, test_y = X, y
            print(f"Held-out test person: {name} ({len(y)} samples)")
        else:
            parts_X.extend([X] * args.recorded_weight)
            parts_y.extend([y] * args.recorded_weight)
            print(f"Recorded: {name} ({len(y)} samples, x{args.recorded_weight})")

    if not parts_X:
        raise SystemExit("No training data. Run extract_landmarks.py and/or export recordings from #/record.")
    X = np.concatenate(parts_X)
    y = np.concatenate(parts_y)

    if args.letters:
        keep = set(args.letters.upper())
        m = np.isin(y, list(keep))
        X, y = X[m], y[m]
        if test_y is not None:
            tm = np.isin(test_y, list(keep))
            test_X, test_y = test_X[tm], test_y[tm]

    # No held-out person available → fall back to a random split (optimistic; say so).
    if test_y is None or len(test_y) == 0:
        print("WARNING: no held-out person, using a random 20% split. Accuracy will look better than reality.")
        X, test_X, y, test_y = train_test_split(X, y, test_size=0.2, stratify=y, random_state=0)

    scaler = StandardScaler().fit(X)
    scaler.scale_[scaler.scale_ < 1e-6] = 1.0
    hidden = tuple(int(h) for h in args.hidden.split(","))
    clf = MLPClassifier(
        hidden_layer_sizes=hidden,
        activation="relu",
        alpha=1e-3,
        batch_size=256,
        learning_rate_init=1e-3,
        max_iter=300,
        early_stopping=True,
        n_iter_no_change=15,
        random_state=0,
    )
    clf.fit(scaler.transform(X), y)

    pred = clf.predict(scaler.transform(test_X))
    acc = float((pred == test_y).mean())
    labels = list(clf.classes_)
    report = classification_report(test_y, pred, labels=labels, zero_division=0)
    cm = confusion_matrix(test_y, pred, labels=labels)

    lines = [f"Test accuracy: {acc:.3f} on {len(test_y)} samples", "", report, "Confusion matrix (rows = true, cols = predicted):"]
    lines.append("     " + " ".join(f"{l:>3}" for l in labels))
    for l, row in zip(labels, cm):
        lines.append(f"{l:>3}  " + " ".join(f"{v:>3}" for v in row))
    # Biggest confusions: tell the team which letters to keep out of the demo.
    pairs = sorted(((cm[i, j], labels[i], labels[j]) for i in range(len(labels)) for j in range(len(labels)) if i != j and cm[i, j]), reverse=True)[:8]
    lines += ["", "Most confused (true -> predicted):"] + [f"  {a} -> {b}: {n}" for n, a, b in pairs]
    text = "\n".join(lines)
    print(text)
    (HERE / "report.txt").write_text(text)

    model = {
        "featureVersion": FEATURE_VERSION,
        "labels": labels,
        "mean": scaler.mean_.tolist(),
        "scale": scaler.scale_.tolist(),
        "activation": "relu",
        "layers": [{"W": W.tolist(), "b": b.tolist()} for W, b in zip(clf.coefs_, clf.intercepts_)],
        "testAccuracy": acc,
    }
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(model))
    print(f"\nExported {out} ({out.stat().st_size // 1024} KB). Reload the app: the debug panel should say 'trained model'.")


if __name__ == "__main__":
    main()
