"""Checks that features.py and frontend/src/cv/features.ts produce identical numbers.
Run from the repo root:  python training/test_parity.py
(needs `npx tsx`, which npm downloads on first use)
"""
import json
import random
import shutil
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from features import extract_features  # noqa: E402

ROOT = Path(__file__).parent.parent
random.seed(1)
cases = []
for i in range(20):
    lms = [(random.random(), random.random(), random.uniform(-0.1, 0.1)) for _ in range(21)]
    cases.append({"landmarks": lms, "handedness": "Left" if i % 2 else "Right"})

script = """
import { extractFeatures } from '../frontend/src/cv/features.ts';
import { readFileSync } from 'node:fs';
const cases = JSON.parse(readFileSync(0, 'utf8'));
console.log(JSON.stringify(cases.map(c => extractFeatures({
  handedness: c.handedness,
  landmarks: c.landmarks.map(([x, y, z]) => ({ x, y, z })),
}))));
"""
tmp = ROOT / "training" / ".parity.ts"
tmp.write_text(script)
try:
    proc = subprocess.run([shutil.which("npx") or "npx", "--yes", "tsx", str(tmp)], cwd=ROOT, input=json.dumps(cases), capture_output=True, text=True)
    if proc.returncode != 0:
        raise SystemExit(f"tsx failed:\n{proc.stderr}")
    out = proc.stdout
finally:
    tmp.unlink(missing_ok=True)
ts = json.loads(out)
worst = 0.0
for c, t in zip(cases, ts):
    p = extract_features(c["landmarks"], c["handedness"])
    assert len(p) == len(t), (len(p), len(t))
    worst = max(worst, max(abs(a - b) for a, b in zip(p, t)))
print(f"max difference: {worst:.2e}")
assert worst < 1e-9, "features.py and features.ts disagree"
print("PARITY OK")
