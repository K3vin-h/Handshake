# Training the recognizer

Optional upgrade from kNN to a neural network trained on thousands of hands.
The app works without it: if `public/model/model.json` is missing, it uses kNN.

## Pipeline

```
Kaggle ASL Alphabet photos ──► Albumentations (dark, bright, warm, cool, blur, noise, angle)
                           ──► MediaPipe hand landmarks (same model as the browser)
                           ──► features.py (88 numbers, identical to src/cv/features.ts)
your #/record exports     ──┘
                           ──► scikit-learn MLP ──► public/model/model.json ──► TensorFlow.js in the app
```

## Run it

```bash
python3 -m venv .venv && source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r training/requirements.txt

python training/test_parity.py           # confirms Python and browser features match
python training/extract_landmarks.py     # ~20–40 min; downloads the dataset via kagglehub
python training/train.py                 # ~1–3 min; prints accuracy + confusion matrix
```

Then reload the app. The lesson debug panel says **trained model** instead of kNN.

### Kaggle download
`kagglehub` downloads the public `grassknoted/asl-alphabet` dataset. If it asks for credentials,
create a Kaggle API token (kaggle.com → Settings → API) or download the zip manually and run
`python training/extract_landmarks.py --dataset path/to/asl_alphabet_train`.
Check the dataset's license on its Kaggle page and credit it on Devpost.

### Add your own recordings (important)
1. Each person records letters on `#/record` and clicks **Export JSON** (file is named after them).
2. Put the files in `training/data/recorded/` (e.g. `ryan.json`, `teammate-a.json`, `venue-friend.json`).
3. Rerun `train.py`. The **last** file (or `--holdout name.json`) is kept out of training and used as the
   test set, so the accuracy you see is for a person the model has never seen.

Recordings are repeated 3× in training (`--recorded-weight`) because they match your real webcam.

## Reading the results
`training/report.txt` has per-letter precision/recall and the most-confused pairs.
- Letters below ~85% recall: keep them out of the demo.
- Compare with kNN on the same held-out person before switching. If kNN wins, delete `model.json`.

Useful flags: `--letters ABCDFILOVWY` (train only demo letters, usually more accurate),
`--per-class 600 --augment 3` (more data, slower), `--hidden 256,128`.

## Databricks + MLflow (sponsor U10)

Contract and edge cases: [databricks/SPEC.md](databricks/SPEC.md).
The job compares `64`, `128,64`, and `256,128` on the same evaluation split,
logs each model/report and per-letter recall to MLflow, and publishes the highest
accuracy model (ties keep the smaller network). A failed training/logging run
leaves previously published files unchanged. Random-split evaluation is explicitly
labelled optimistic; use at least two people's recordings for a held-out person.

1. Add this repository as a Databricks Git folder. Use compute with Unity Catalog
   volume access and permission to create MLflow runs.
2. Upload `kaggle_features.npz` and/or `recorded/*.json` to a volume such as
   `/Volumes/main/default/handshake`. Keep one JSON per recorded person.
3. Open `training/databricks/train_job.py` as a source notebook. Set `training_dir`
   to the Git folder's absolute `training/` path and `data_dir` to the volume path.
4. Run all cells. Confirm **three finished runs** in the notebook experiment, with
   `hidden`, `evaluation`, `holdout_accuracy`, `recall_<letter>`, and both artifacts.
5. Review `report.txt` and `model.json` in the volume. Download the model to
   `public/model/model.json` only when the evaluation is acceptable. Keep the
   MLflow experiment screenshot and report for the submission. A local synthetic
   test is not evidence of real-hand accuracy or a completed Databricks run.

Local regression tests (no Databricks credentials or personal recordings needed):

```bash
python3 -m venv .venv
.venv/bin/pip install -r training/databricks/requirements-test.txt
.venv/bin/python -m pytest training/test_train_smoke.py training/test_databricks.py -q
.venv/bin/python training/test_parity.py
```

`train.main(argv=None)` returns `{accuracy, out, report}`; `--report` supports a
custom report path. Malformed/stale/nonfinite recordings fail with the filename
instead of being silently omitted. Filtering must leave at least two training
classes and a nonempty holdout containing only classes present in training.

MLflow API: https://mlflow.org/docs/latest/api_reference/python_api/mlflow.html
Databricks workspace files: https://docs.databricks.com/aws/en/files/workspace

Publication stages both files first, but the two final replacements are not a
transactional pair. Rerun after a storage interruption during publication; run
only one job per output directory at a time.
