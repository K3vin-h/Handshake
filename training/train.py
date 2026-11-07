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


def validate_samples(X, y, source):
    try:
        X = np.asarray(X, dtype=np.float32)
        y = np.asarray(y)
        valid = (X.ndim == 2 and X.shape[1] == FEATURE_LENGTH
                 and y.ndim == 1 and len(X) == len(y) and len(y) > 0
                 and np.isfinite(X).all()
                 and all(isinstance(v, str) and v.strip() for v in y))
    except (TypeError, ValueError, OverflowError) as exc:
        raise SystemExit(f"{source}: invalid features or labels") from exc
    if not valid:
        raise SystemExit(f"{source}: invalid features or labels")
    return X, y


def load_recorded(folder):
    people = {}
    for f in sorted(Path(folder).glob("*.json")):
        try:
            rows = json.loads(f.read_text())
            if not isinstance(rows, list):
                raise ValueError("expected an array")
            if not rows:
                continue
            if any(r.get("v", FEATURE_VERSION) != FEATURE_VERSION for r in rows):
                raise ValueError("feature version mismatch; re-record")
            people[f.name] = validate_samples(
                [r["features"] for r in rows], [r["letter"] for r in rows], f.name)
        except (ValueError, KeyError, TypeError, AttributeError) as exc:
            raise SystemExit(f"{f.name}: invalid recording: {exc}") from exc
    return people


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--kaggle", default=str(HERE / "data" / "kaggle_features.npz"))
    ap.add_argument("--recorded", default=str(HERE / "data" / "recorded"))
    ap.add_argument("--holdout", help="recorded file held out as the test person (default: the last one)")
    ap.add_argument("--letters", help="restrict to these letters, e.g. ABCDFILOVWY")
    ap.add_argument("--recorded-weight", type=int, default=3, help="repeat recorded samples N times (they match real webcam conditions)")
    ap.add_argument("--hidden", default="128,64")
    ap.add_argument("--out", default=str(ROOT / "public" / "model" / "model.json"))
    ap.add_argument("--report", default=str(HERE / "report.txt"))
    args = ap.parse_args(argv)
    try:
        hidden = tuple(int(h) for h in args.hidden.split(","))
        if not hidden or any(h <= 0 for h in hidden) or args.recorded_weight <= 0:
            raise ValueError()
    except ValueError:
        ap.error("hidden widths and recorded-weight must be positive integers")

    parts_X, parts_y, weights = [], [], []
    if Path(args.kaggle).exists():
        try:
            with np.load(args.kaggle, allow_pickle=False) as d:
                if int(d["version"]) != FEATURE_VERSION:
                    raise SystemExit("kaggle_features.npz feature version mismatch; rerun extract_landmarks.py")
                Xk, yk = validate_samples(d["X"], d["y"], "kaggle_features.npz")
                parts_X.append(Xk)
                parts_y.append(yk)
                weights.append(np.ones(len(yk), dtype=int))
                print(f"Kaggle: {len(yk)} samples")
        except (ValueError, KeyError, OSError) as exc:
            raise SystemExit(f"Invalid Kaggle features: {exc}") from exc
    else:
        print("No Kaggle features found (run extract_landmarks.py). Training on recorded data only.")

    people = load_recorded(args.recorded)
    holdout = args.holdout or (list(people)[-1] if len(people) >= 2 else None)
    if args.holdout and args.holdout not in people:
        raise SystemExit(f"Unknown or empty holdout: {args.holdout}")
    test_X = test_y = None
    for name, (X, y) in people.items():
        if name == holdout:
            test_X, test_y = X, y
            print(f"Held-out test person: {name} ({len(y)} samples)")
        else:
            parts_X.append(X)
            parts_y.append(y)
            weights.append(np.full(len(y), args.recorded_weight, dtype=int))
            print(f"Recorded: {name} ({len(y)} samples, x{args.recorded_weight})")

    if not parts_X:
        raise SystemExit("No training data. Run extract_landmarks.py and/or export recordings from #/record.")
    X = np.concatenate(parts_X)
    y = np.concatenate(parts_y)
    weights = np.concatenate(weights)

    if args.letters:
        keep = set(args.letters.upper())
        m = np.isin(y, list(keep))
        X, y, weights = X[m], y[m], weights[m]
        if test_y is not None:
            tm = np.isin(test_y, list(keep))
            test_X, test_y = test_X[tm], test_y[tm]

    if len(set(y)) < 2:
        raise SystemExit("Training requires at least two classes after filtering")
    evaluation = f"held-out person: {holdout}"
    if holdout and (test_y is None or len(test_y) == 0):
        raise SystemExit("Empty holdout after letter filtering")
    if test_y is None:
        evaluation = "random split (optimistic; no held-out person)"
        print(f"WARNING: {evaluation}")
        try:
            X, test_X, y, test_y, weights, _ = train_test_split(
                X, y, weights, test_size=0.2, stratify=y, random_state=0)
        except ValueError as exc:
            raise SystemExit(f"Insufficient samples for stratified split: {exc}") from exc
    if not set(test_y).issubset(set(y)):
        raise SystemExit("Holdout contains a class absent from training")
    # Duplicate only training samples; evaluation contains originals exactly once.
    X, y = np.repeat(X, weights, axis=0), np.repeat(y, weights)

    scaler = StandardScaler().fit(X)
    scaler.scale_[scaler.scale_ < 1e-6] = 1.0
    clf = MLPClassifier(
        hidden_layer_sizes=hidden,
        activation="relu",
        alpha=1e-3,
        batch_size=min(256, max(1, int(len(y) * .9))),
        learning_rate_init=1e-3,
        max_iter=300,
        early_stopping=True,
        n_iter_no_change=15,
        random_state=0,
    )
    try:
        clf.fit(scaler.transform(X), y)
    except ValueError as exc:
        raise SystemExit(f"Insufficient training samples or invalid class distribution: {exc}") from exc

    pred = clf.predict(scaler.transform(test_X))
    acc = float((pred == test_y).mean())
    labels = list(clf.classes_)
    report = classification_report(test_y, pred, labels=labels, zero_division=0)
    metrics = classification_report(test_y, pred, labels=labels, zero_division=0, output_dict=True)
    cm = confusion_matrix(test_y, pred, labels=labels)

    lines = [f"Evaluation: {evaluation}", f"Test accuracy: {acc:.3f} on {len(test_y)} samples", "", report, "Confusion matrix (rows = true, cols = predicted):"]
    lines.append("     " + " ".join(f"{l:>3}" for l in labels))
    for l, row in zip(labels, cm):
        lines.append(f"{l:>3}  " + " ".join(f"{v:>3}" for v in row))
    # Biggest confusions: tell the team which letters to keep out of the demo.
    pairs = sorted(((cm[i, j], labels[i], labels[j]) for i in range(len(labels)) for j in range(len(labels)) if i != j and cm[i, j]), reverse=True)[:8]
    lines += ["", "Most confused (true -> predicted):"] + [f"  {a} -> {b}: {n}" for n, a, b in pairs]
    text = "\n".join(lines)
    print(text)
    report_path = Path(args.report)
    if report_path.resolve() == Path(args.out).resolve():
        raise SystemExit("Model and report paths must differ")
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(text)

    layers = [{"W": W.tolist(), "b": b.tolist()} for W, b in zip(clf.coefs_, clf.intercepts_)]
    if len(labels) == 2:
        # softmax([0, z]) equals [1-sigmoid(z), sigmoid(z)].
        W, bias = clf.coefs_[-1], clf.intercepts_[-1]
        layers[-1] = {"W": np.column_stack([np.zeros(W.shape[0]), W[:, 0]]).tolist(),
                      "b": [0.0, float(bias[0])] }

    model = {
        "featureVersion": FEATURE_VERSION,
        "labels": labels,
        "mean": scaler.mean_.tolist(),
        "scale": scaler.scale_.tolist(),
        "activation": "relu",
        "layers": layers,
        "evaluation": evaluation,
        "perLetterRecall": {label: metrics[label]["recall"] for label in labels},
        "testAccuracy": acc,
    }
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(model))
    print(f"\nExported {out} ({out.stat().st_size // 1024} KB). Reload the app: the debug panel should say 'trained model'.")

    return {"accuracy": acc, "out": str(out), "report": str(report_path)}


if __name__ == "__main__":
    main()
