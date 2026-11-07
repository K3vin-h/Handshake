"""Usage: python -I training/asl_now_report.py <huggingface-dataset-id>
Prints the dataset columns and how many samples each of our letters has."""
import sys
from collections import Counter
from datasets import load_dataset

ds = load_dataset(sys.argv[1], split="train")
print(ds)
label = next(c for c in ds.column_names if c.lower() in ("letter", "label", "sign", "class", "gesture"))
feat = ds.features[label]
names = getattr(feat, "names", None)
counts = Counter(str(names[v] if names else v).upper() for v in ds[label])
for letter in "ABCDFILOVWY":
    print(letter, counts.get(letter, 0))
