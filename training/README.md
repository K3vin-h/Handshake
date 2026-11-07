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
