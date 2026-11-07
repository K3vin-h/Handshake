"""Behavioral tests for training; run with pytest training/test_train_smoke.py."""
import json
import sys
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).parent))
import train
from features import FEATURE_LENGTH, FEATURE_VERSION


def recording(path, seed=1, letters="AB"):
    rng = np.random.default_rng(seed)
    rows = [{"letter": letter, "v": FEATURE_VERSION,
             "features": rng.normal(i * 3, .1, FEATURE_LENGTH).tolist()}
            for i, letter in enumerate(letters) for _ in range(40)]
    path.write_text(json.dumps(rows))
    return rows


@pytest.fixture
def dataset(tmp_path):
    rec = tmp_path / "recorded"
    rec.mkdir()
    recording(rec / "one.json")
    recording(rec / "two.json", 2)
    return tmp_path, rec


def args(dataset):
    root, rec = dataset
    return ["--kaggle", str(root / "missing.npz"), "--recorded", str(rec),
            "--hidden", "16", "--out", str(root / "out/model.json"),
            "--report", str(root / "reports/report.txt")]


def test_train_exports_binary_softmax_and_report(dataset):
    result = train.main(args(dataset))
    assert set(result) == {"accuracy", "out", "report"}
    assert .9 <= result["accuracy"] <= 1
    model = json.loads(Path(result["out"]).read_text())
    assert model["labels"] == ["A", "B"]
    assert len(model["layers"][-1]["b"]) == 2
    # Execute the browser's standardize -> ReLU -> softmax contract.
    rows = json.loads((dataset[1] / "two.json").read_text())
    h = (np.array([r["features"] for r in rows]) - model["mean"]) / model["scale"]
    for i, layer in enumerate(model["layers"]):
        h = h @ layer["W"] + layer["b"]
        if i < len(model["layers"]) - 1:
            h = np.maximum(h, 0)
    predicted = np.array(model["labels"])[h.argmax(axis=1)]
    assert np.mean(predicted == [r["letter"] for r in rows]) == result["accuracy"]
    text = Path(result["report"]).read_text()
    assert "person: two.json" in text and "recall" in text
    first = Path(result["out"]).read_bytes()
    train.main(args(dataset))
    assert Path(result["out"]).read_bytes() == first


@pytest.mark.parametrize("extra", [
    ["--hidden", "0"], ["--hidden", "-1"], ["--hidden", "a"],
    ["--hidden", "16,"], ["--recorded-weight", "0"],
    ["--recorded-weight", "-2"], ["--holdout", "absent.json"],
    ["--letters", "Z"],
])
def test_rejects_invalid_training_requests(dataset, extra):
    with pytest.raises(SystemExit):
        train.main(args(dataset) + extra)
    assert not (dataset[0] / "out/model.json").exists()


def test_missing_data(dataset):
    for path in dataset[1].glob("*.json"):
        path.unlink()
    with pytest.raises(SystemExit, match="No training data"):
        train.main(args(dataset))


@pytest.mark.parametrize("change", ["nan", "shape", "version", "missing", "string"])
def test_rejects_bad_recordings(dataset, change):
    path = dataset[1] / "one.json"
    rows = json.loads(path.read_text())
    if change == "nan": rows[0]["features"][0] = float("nan")
    if change == "shape": rows[0]["features"] = [1]
    if change == "version": rows[0]["v"] = -1
    if change == "missing": del rows[0]["letter"]
    if change == "string": rows[0]["features"][0] = "oops"
    path.write_text(json.dumps(rows))
    with pytest.raises(SystemExit, match="one.json"):
        train.main(args(dataset))


def test_unseen_holdout_class(dataset):
    recording(dataset[1] / "two.json", letters="AC")
    with pytest.raises(SystemExit, match="class"):
        train.main(args(dataset))


def test_empty_filtered_holdout_is_not_random_split(dataset):
    recording(dataset[1] / "two.json", letters="CD")
    with pytest.raises(SystemExit, match="holdout"):
        train.main(args(dataset) + ["--letters", "AB"])


def test_one_training_class(dataset):
    with pytest.raises(SystemExit, match="two"):
        train.main(args(dataset) + ["--letters", "A"])


def test_random_split_precedes_weighting(dataset):
    (dataset[1] / "two.json").unlink()
    result = train.main(args(dataset) + ["--recorded-weight", "5"])
    text = Path(result["report"]).read_text()
    assert "on 16 samples" in text  # 20% of 80 originals, not 400 duplicates
    assert "random split" in text


@pytest.mark.parametrize("bad", ["version", "shape", "nan", "labels"])
def test_invalid_kaggle_archive(dataset, bad):
    root, _ = dataset
    X = np.zeros((20, FEATURE_LENGTH))
    y = np.array(["A", "B"] * 10)
    version = FEATURE_VERSION
    if bad == "version": version = -1
    if bad == "shape": X = X[:, :2]
    if bad == "nan": X[0, 0] = np.nan
    if bad == "labels": y = y[:2]
    archive = root / "bad.npz"
    np.savez(archive, X=X, y=y, version=version)
    with pytest.raises(SystemExit):
        train.main(args(dataset) + ["--kaggle", str(archive)])


def test_multiclass_export(dataset):
    recording(dataset[1] / "one.json", letters="ABC")
    recording(dataset[1] / "two.json", 2, letters="ABC")
    result = train.main(args(dataset))
    model = json.loads(Path(result["out"]).read_text())
    assert model["labels"] == ["A", "B", "C"]
    assert len(model["layers"][-1]["b"]) == 3
    assert set(model["perLetterRecall"]) == {"A", "B", "C"}
    rows = json.loads((dataset[1] / "two.json").read_text())
    h = (np.array([r["features"] for r in rows]) - model["mean"]) / model["scale"]
    for i, layer in enumerate(model["layers"]):
        h = h @ layer["W"] + layer["b"]
        if i < len(model["layers"]) - 1:
            h = np.maximum(h, 0)
    predicted = np.array(model["labels"])[h.argmax(axis=1)]
    assert np.mean(predicted == [r["letter"] for r in rows]) == result["accuracy"]


def test_tiny_random_split_fails_clearly(dataset):
    (dataset[1] / "two.json").unlink()
    path = dataset[1] / "one.json"
    rows = json.loads(path.read_text())
    path.write_text(json.dumps([rows[0], rows[40]]))
    with pytest.raises(SystemExit, match="Insufficient samples"):
        train.main(args(dataset))


def test_sparse_multiclass_reports_insufficient_training_data(dataset):
    for name in ("one.json", "two.json"):
        path = dataset[1] / name
        rows = recording(path, letters="ABC")
        path.write_text(json.dumps([rows[0], rows[40], rows[80]]))
    with pytest.raises(SystemExit, match="Insufficient training samples"):
        train.main(args(dataset))
