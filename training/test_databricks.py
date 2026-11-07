"""Integration tests with real local MLflow; trainers use controlled artifacts."""
import importlib.util
import json
import sys
from pathlib import Path

import mlflow
import pytest
from mlflow import MlflowClient

sys.path.insert(0, str(Path(__file__).parent))


def sweep():
    path = Path(__file__).parent / "databricks" / "sweep.py"
    assert path.exists(), "Reusable Databricks sweep is not implemented"
    spec = importlib.util.spec_from_file_location("handshake_sweep", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.run_sweep


@pytest.fixture
def store(tmp_path):
    mlflow.set_tracking_uri("sqlite:///" + str(tmp_path / "mlflow.db"))
    experiment = mlflow.create_experiment("handshake-tests", artifact_location=(tmp_path / "artifacts").as_uri())
    mlflow.set_experiment(experiment_id=experiment)
    data = tmp_path / "data"
    (data / "recorded").mkdir(parents=True)
    return data


def trainer(scores, calls):
    def run(argv):
        opts = dict(zip(argv[::2], argv[1::2]))
        calls.append(opts)
        score = scores[len(calls) - 1]
        if isinstance(score, Exception):
            raise score
        out, report = Path(opts["--out"]), Path(opts["--report"])
        out.write_text(json.dumps({"hidden": opts["--hidden"]}))
        report.write_text("report " + opts["--hidden"])
        return {"accuracy": score, "out": str(out), "report": str(report)}
    return run


@pytest.mark.parametrize("scores,winner", [([.8, .95, .9], "128,64"), ([.9, .9, .8], "64")])
def test_sweep_logs_and_publishes_best(store, scores, winner):
    calls = []
    result = sweep()(store, train_main=trainer(scores, calls))
    assert json.loads((store / "model.json").read_text()) == {"hidden": winner}
    assert (store / "report.txt").read_text() == "report " + winner
    assert result["accuracy"] == max(scores)
    assert [c["--hidden"] for c in calls] == ["64", "128,64", "256,128"]
    runs = mlflow.search_runs(output_format="list")
    assert len(runs) == 3
    client = MlflowClient()
    for run in runs:
        assert run.info.status == "FINISHED"
        assert "holdout_accuracy" in run.data.metrics
        assert run.data.params["hidden"] in ("64", "128,64", "256,128")
        assert len(client.list_artifacts(run.info.run_id)) >= 2


@pytest.mark.parametrize("bad", [RuntimeError("training failed"), float("nan"), -0.1, 1.1])
def test_failed_sweep_preserves_published_files(store, bad):
    (store / "model.json").write_text("old model")
    (store / "report.txt").write_text("old report")
    with pytest.raises((RuntimeError, ValueError)):
        sweep()(store, train_main=trainer([.8, bad, .9], []))
    assert (store / "model.json").read_text() == "old model"
    assert (store / "report.txt").read_text() == "old report"


def test_missing_volume_fails_before_training(tmp_path):
    with pytest.raises(ValueError, match="data"):
        sweep()(tmp_path / "absent", train_main=lambda _: pytest.fail("must not train"))


def test_real_training_logs_per_letter_recall(store):
    from test_train_smoke import recording
    recording(store / "recorded" / "one.json")
    recording(store / "recorded" / "two.json", 2)
    result = sweep()(store)
    assert result["accuracy"] >= .9
    for run in mlflow.search_runs(output_format="list"):
        assert run.data.metrics["recall_A"] >= .9
        assert run.data.metrics["recall_B"] >= .9


def test_tracking_failure_preserves_published_files(store, monkeypatch):
    (store / "model.json").write_text("old model")
    (store / "report.txt").write_text("old report")
    def fail(_):
        raise OSError("artifact store unavailable")
    monkeypatch.setattr(mlflow, "log_artifact", fail)
    with pytest.raises(OSError, match="artifact store unavailable"):
        sweep()(store, train_main=trainer([.8, .9, .95], []))
    assert (store / "model.json").read_text() == "old model"
    assert (store / "report.txt").read_text() == "old report"
    assert mlflow.search_runs(output_format="list")[0].info.status == "FAILED"


def test_invalid_report_destination_does_not_replace_model(store):
    (store / "model.json").write_text("old model")
    (store / "report.txt").mkdir()
    with pytest.raises(ValueError, match="destination"):
        sweep()(store, train_main=lambda _: pytest.fail("must not train"))
    assert (store / "model.json").read_text() == "old model"
