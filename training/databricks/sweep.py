"""Reusable three-network sweep; MLflow tracking URI is configured by the caller."""
import json
import math
import shutil
import tempfile
from pathlib import Path

import mlflow


def run_sweep(data_dir, *, train_main=None):
    """Train and log all candidates before publishing the winner to data_dir.

    Ties keep the first, smaller network. Exceptions propagate so a failed job
    cannot replace the published model with a partial-sweep winner.
    """
    data = Path(data_dir)
    if not data.is_dir() or not ((data / "kaggle_features.npz").is_file()
                                 or (data / "recorded").is_dir()):
        raise ValueError("data_dir must contain kaggle_features.npz or recorded/")
    for name in ("model.json", "report.txt"):
        destination = data / name
        if destination.exists() and not destination.is_file():
            raise ValueError(f"Invalid publication destination: {destination}")
    if train_main is None:
        from train import main
        train_main = main

    best = None
    with tempfile.TemporaryDirectory(prefix="handshake-") as work:
        for hidden in ("64", "128,64", "256,128"):
            tag = hidden.replace(",", "-")
            with mlflow.start_run(run_name=f"mlp-{tag}"):
                mlflow.log_param("hidden", hidden)
                result = train_main([
                    "--kaggle", str(data / "kaggle_features.npz"),
                    "--recorded", str(data / "recorded"),
                    "--hidden", hidden,
                    "--out", str(Path(work) / f"model-{tag}.json"),
                    "--report", str(Path(work) / f"report-{tag}.txt"),
                ])
                accuracy = float(result["accuracy"])
                if not math.isfinite(accuracy) or not 0 <= accuracy <= 1:
                    raise ValueError("Invalid training accuracy")
                model = json.loads(Path(result["out"]).read_text())
                mlflow.log_metric("holdout_accuracy", accuracy)
                for letter, recall in model.get("perLetterRecall", {}).items():
                    mlflow.log_metric(f"recall_{letter}", recall)
                mlflow.log_param("evaluation", model.get("evaluation", "unspecified"))
                mlflow.log_artifact(result["report"])
                mlflow.log_artifact(result["out"])
                if best is None or accuracy > best["accuracy"]:
                    best = {**result, "accuracy": accuracy}
        # Stage both complete files on the target filesystem before replacing.
        # These are two file operations, not a transactional pair across crashes.
        with tempfile.TemporaryDirectory(prefix=".handshake-publish-", dir=data) as stage:
            for key, name in (("out", "model.json"), ("report", "report.txt")):
                shutil.copyfile(best[key], Path(stage) / name)
            for name in ("model.json", "report.txt"):
                (Path(stage) / name).replace(data / name)
    return {"accuracy": best["accuracy"], "out": str(data / "model.json"),
            "report": str(data / "report.txt")}
