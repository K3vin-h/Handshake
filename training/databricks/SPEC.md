# Databricks recognizer training

Implements sponsor spec U10 and sponsor plan Task 10. No frontend, server,
feature extraction, or production model changes are in scope.

## Contract

- `train.main(argv=None)` retains CLI defaults and returns exactly `accuracy`,
  `out`, `report`. `--report` controls the report path; parent folders are created.
- Validate feature shape/version, finite numeric values, positive recorded weight
  and hidden-layer widths. Reject empty data, fewer than two training classes,
  unknown explicit holdouts, empty filtered holdouts, and unseen test classes.
- Hold out a whole recorded person before weighting training samples. If no person
  is available, split original samples BEFORE weighting to prevent duplicates
  leaking into evaluation. Report the evaluation method and per-letter recall.
- Browser export preserves the feature/scaler/layer contract. Binary sklearn's
  single sigmoid output must become two softmax logits `[0, z]` so both labels
  remain predictable by the existing browser loader.
- Sweep `64`, `128,64`, `256,128` with identical input/split settings. Each gets
  an MLflow run with hidden sizes, accuracy, per-letter recall, model and report.
  Highest accuracy wins; ties keep the first (smaller) configuration.
- Only publish model.json/report.txt after every run and artifact log succeeds.
  Errors propagate; never silently select a partial sweep. Use isolated temporary
  work folders. Missing data paths and invalid metrics fail clearly.
- Notebook source uses training_dir/data_dir widgets, imports the reusable sweep,
  and writes winners to the Unity Catalog volume. Local tests use a local MLflow
  store; a cloud run and screenshot require the user's Databricks workspace.

## Tests written before implementation

Real synthetic recordings: successful export/report, nested directories, binary
softmax parity, deterministic reruns, no data, filtered empty data, invalid hidden
sizes/weights, malformed/nonfinite/wrong-version features, unknown/empty holdout,
unseen classes, random split before duplication. Real local MLflow: three runs,
params/metrics/artifacts, winner bytes, ties, invalid score and failed run leaving
existing published artifacts unchanged. No personal recordings are committed.

## Execution

1. Write tests and observe missing-contract failures.
2. Implement train API/validation/evaluation/export.
3. Implement reusable sweep and thin Databricks notebook.
4. Run Python tests/parity, app suite/build, and independent code review.

References: https://mlflow.org/docs/latest/api_reference/python_api/mlflow.html
and https://docs.databricks.com/aws/en/files/workspace .

Publication stages both files on the destination filesystem before replacement.
The final two replacements are not a transactional pair: interrupted storage or
process failure during replacement requires rerunning the job. Concurrent jobs
must use separate output volumes/directories. Invalid destination directories
are rejected before training. Sparse early-stopping failures are actionable errors.
