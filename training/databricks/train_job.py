# Databricks notebook source
# Import this source notebook into a Git folder alongside the training modules.
# COMMAND ----------
dbutils.widgets.text("training_dir", "", "Absolute path to repo training/ in the Git folder")
dbutils.widgets.text("data_dir", "/Volumes/main/default/handshake", "Unity Catalog volume containing training data")

# COMMAND ----------
# MAGIC %pip install numpy scikit-learn mlflow

# COMMAND ----------
import sys
from pathlib import Path

training_dir = dbutils.widgets.get("training_dir").strip()
data_dir = dbutils.widgets.get("data_dir").strip()
if not training_dir or not data_dir:
    raise ValueError("Fill in training_dir and data_dir widgets")
if not (Path(training_dir) / "train.py").is_file():
    raise ValueError("training_dir must point to the repo's training/ folder")
sys.path.insert(0, training_dir)
sys.path.insert(0, str(Path(training_dir) / "databricks"))
from sweep import run_sweep

# COMMAND ----------
result = run_sweep(data_dir)
print(f"Best evaluation accuracy: {result['accuracy']:.3f}")
print(f"Model: {result['out']}\nReport: {result['report']}")
print("Download model.json from the volume to frontend/public/model/model.json only after reviewing the report.")
