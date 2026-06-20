"""
Road Accident Severity — Data Cleaning & Preparation Pipeline
=============================================================
CS661 Big Data Visual Analytics

This single file does the full offline pipeline:

  1.  LOAD       raw RTA dataset  (data/raw/RTA Dataset.csv)
  2.  CLEAN      11 documented cleaning techniques
  3.  DERIVE     new analytical features (Hour, Time_of_day, Is_weekend, ...)
  4.  ANALYSE    >=5 analytical tasks -> aggregated tables
  5.  MODEL      multinomial logistic regression severity predictor
  6.  EXPORT     cleaned CSV + frontend JSON (records / meta / model)

Run:
    python clean_and_prepare.py

If the raw CSV is missing, a schema-accurate SYNTHETIC sample is generated so the
whole pipeline + frontend run end-to-end. Replace data/raw/RTA Dataset.csv with the
real Kaggle "RTA Dataset" (Addis Ababa road traffic accidents, ~12.3k rows) for real
insights — the synthetic numbers are placeholders only.
"""

import json
import os
import warnings
from pathlib import Path

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

# ----------------------------------------------------------------------------
# Paths
# ----------------------------------------------------------------------------
ROOT = Path(__file__).resolve().parents[1]
RAW_DIR = ROOT / "data" / "raw"
# Preferred filename, but we auto-detect any CSV in data/raw/ so the real
# Kaggle export (often shipped as "Road.csv" or "RTA Dataset.csv") is used
# without renaming. See find_raw_csv().
RAW_CSV = RAW_DIR / "RTA Dataset.csv"
CLEAN_DIR = ROOT / "data" / "cleaned"
FRONTEND_DATA = ROOT / "frontend" / "public" / "data"
CLEAN_DIR.mkdir(parents=True, exist_ok=True)
FRONTEND_DATA.mkdir(parents=True, exist_ok=True)

SEVERITY_ORDER = ["Slight Injury", "Serious Injury", "Fatal injury"]

# Columns the frontend actually consumes (keeps records.json lean)
FRONTEND_COLS = [
    "Hour", "Time_of_day", "Day_of_week", "Is_weekend",
    "Age_band_of_driver", "Sex_of_driver", "Driving_experience", "Educational_level",
    "Area_accident_occured", "Lanes_or_Medians", "Road_surface_type",
    "Road_surface_conditions", "Light_conditions", "Weather_conditions",
    "Type_of_collision", "Vehicle_movement", "Type_of_vehicle",
    "Cause_of_accident", "Number_of_vehicles_involved", "Number_of_casualties",
    "Accident_severity",
]

# Categorical features fed to the predictive model
MODEL_CAT = [
    "Time_of_day", "Day_of_week", "Age_band_of_driver", "Sex_of_driver",
    "Driving_experience", "Area_accident_occured", "Light_conditions",
    "Weather_conditions", "Road_surface_conditions", "Type_of_collision",
    "Cause_of_accident",
]
MODEL_NUM = ["Number_of_vehicles_involved", "Number_of_casualties"]


# ============================================================================
# 0. SYNTHETIC FALLBACK  (only used if the real CSV is absent)
# ============================================================================
def make_synthetic(n=12000, seed=42):
    print("  ! Raw CSV not found -> generating SYNTHETIC sample (placeholder).")
    rng = np.random.default_rng(seed)

    def pick(opts, p=None):
        return rng.choice(opts, size=n, p=p)

    days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    hours = rng.integers(0, 24, n)
    times = [f"{h:02d}:{rng.integers(0,60):02d}:00" for h in hours]

    df = pd.DataFrame({
        "Time": times,
        "Day_of_week": pick(days),
        "Age_band_of_driver": pick(["Under 18", "18-30", "31-50", "Over 51", "Unknown"],
                                    [0.05, 0.42, 0.33, 0.12, 0.08]),
        "Sex_of_driver": pick(["Male", "Female", "Unknown"], [0.80, 0.17, 0.03]),
        "Educational_level": pick(["Elementary school", "Junior high school",
                                    "High school", "Above high school", "Unknown"]),
        "Vehicle_driver_relation": pick(["Employee", "Owner", "Other", "Unknown"]),
        "Driving_experience": pick(["No Licence", "Below 1yr", "1-2yr", "2-5yr",
                                     "5-10yr", "Above 10yr", "Unknown"],
                                    [0.05, 0.12, 0.18, 0.27, 0.20, 0.13, 0.05]),
        "Type_of_vehicle": pick(["Automobile", "Public (>45 seats)", "Lorry (41-100Q)",
                                 "Taxi", "Motorcycle", "Bajaj", "Other"]),
        "Owner_of_vehicle": pick(["Owner", "Governmental", "Organization", "Other"]),
        "Service_year_of_vehicle": pick(["Below 1yr", "1-2yr", "2-5yrs", "5-10yrs",
                                         "Above 10yr", "Unknown"]),
        "Defect_of_vehicle": pick(["No defect", "defect", "Unknown"], [0.85, 0.05, 0.10]),
        "Area_accident_occured": pick(["Residential areas", "Office areas",
                                       "Recreational areas", "Industrial areas",
                                       "Church areas", "Market areas", "School areas",
                                       "Outside rural areas", "Hospital areas", "Other"]),
        "Lanes_or_Medians": pick(["Two-way (divided with broken lines road marking)",
                                  "Undivided Two way", "other", "Double carriageway (median)",
                                  "One way", "Unknown"]),
        "Road_allignment": pick(["Tangent road with flat terrain",
                                  "Tangent road with mild grade and flat terrain",
                                  "Escarpments", "Steep grade downward with mountainous terrain",
                                  "Gentle horizontal curve"]),
        "Types_of_Junction": pick(["No junction", "Y Shape", "Crossing", "O Shape",
                                    "T Shape", "X Shape", "Other", "Unknown"]),
        "Road_surface_type": pick(["Asphalt roads", "Earth roads", "Gravel roads",
                                   "Asphalt roads with some distress", "Other"]),
        "Road_surface_conditions": pick(["Dry", "Wet or damp", "Snow", "Flood over 3cm. deep"],
                                         [0.78, 0.18, 0.01, 0.03]),
        "Light_conditions": pick(["Daylight", "Darkness - lights lit",
                                  "Darkness - no lighting", "Darkness - lights unlit"],
                                 [0.62, 0.22, 0.13, 0.03]),
        "Weather_conditions": pick(["Normal", "Raining", "Raining and Windy", "Cloudy",
                                    "Windy", "Snow", "Fog or mist", "Other"],
                                   [0.70, 0.12, 0.03, 0.08, 0.02, 0.005, 0.015, 0.03]),
        "Type_of_collision": pick(["Collision with roadside-parked vehicles",
                                   "Vehicle with vehicle collision",
                                   "Collision with roadside objects",
                                   "Collision with animals", "Rollover",
                                   "Collision with pedestrians", "With Train", "Other"]),
        "Number_of_vehicles_involved": rng.choice([1, 2, 3, 4, 5, 6, 7],
                                                  n, p=[0.18, 0.55, 0.15, 0.07, 0.03, 0.01, 0.01]),
        "Number_of_casualties": rng.choice([1, 2, 3, 4, 5, 6, 7, 8],
                                          n, p=[0.55, 0.25, 0.10, 0.05, 0.02, 0.01, 0.01, 0.01]),
        "Vehicle_movement": pick(["Going straight", "U-Turn", "Moving Backward",
                                  "Turnover", "Waiting to go", "Getting off",
                                  "Reversing", "Overtaking", "Other"]),
        "Casualty_class": pick(["Driver or rider", "Pedestrian", "Passenger", "na"]),
        "Sex_of_casualty": pick(["Male", "Female", "na"]),
        "Age_band_of_casualty": pick(["Under 18", "18-30", "31-50", "Over 51", "5", "na"]),
        "Casualty_severity": pick(["1", "2", "3", "na"]),
        "Work_of_casuality": pick(["Driver", "Student", "Employee", "Self-employed",
                                   "Unemployed", "na", "Other"]),
        "Fitness_of_casuality": pick(["Normal", "Deaf", "Blind", "Other", "na"]),
        "Pedestrian_movement": pick(["Not a Pedestrian",
                                     "Crossing from driver's nearside",
                                     "Walking along in carriageway", "Other"]),
        "Cause_of_accident": pick(["Moving Backward", "Overtaking", "Changing lane to the left",
                                   "Changing lane to the right", "No distancing",
                                   "No priority to vehicle", "No priority to pedestrian",
                                   "Driving carelessly", "Driving at high speed",
                                   "Driving under the influence of drugs", "Overloading",
                                   "Other"]),
    })

    # Inject a realistic, imbalanced severity that depends on a few features
    base = np.full(n, 0.0)
    base += np.where(df["Light_conditions"].str.startswith("Darkness"), 0.9, 0)
    base += np.where(df["Weather_conditions"].isin(["Raining", "Fog or mist"]), 0.7, 0)
    base += np.where(df["Cause_of_accident"].isin(
        ["Driving at high speed", "Driving under the influence of drugs"]), 1.2, 0)
    base += (df["Number_of_casualties"] - 1) * 0.25
    base += rng.normal(0, 1.0, n)
    sev = np.full(n, "Slight Injury", dtype=object)
    sev[base > 1.4] = "Serious Injury"
    sev[base > 2.6] = "Fatal injury"
    df["Accident_severity"] = sev
    return df


# ============================================================================
# 1. LOAD
# ============================================================================
def find_raw_csv():
    """Return the real raw CSV to use, or None to trigger the synthetic fallback.

    Prefers the canonical 'RTA Dataset.csv'; otherwise picks any other .csv
    found in data/raw/ (the Kaggle export is commonly named 'Road.csv')."""
    if RAW_CSV.exists():
        return RAW_CSV
    candidates = sorted(p for p in RAW_DIR.glob("*.csv") if p.is_file())
    return candidates[0] if candidates else None


def load_raw():
    path = find_raw_csv()
    if path is not None:
        print(f"  Loading {path}")
        return pd.read_csv(path)
    return make_synthetic()


# ============================================================================
# 2. CLEAN  — 11 documented techniques
# ============================================================================
NULL_TOKENS = {"na", "nan", "unknown", "n/a", "none", "null", "", "?", "other"}


def clean(df):
    report = {}
    n0 = len(df)

    # T1 — Normalise column names (strip stray whitespace)
    df.columns = [c.strip() for c in df.columns]

    # T2 — Strip whitespace + collapse internal spaces on every string cell
    obj_cols = df.select_dtypes(include="object").columns
    for c in obj_cols:
        df[c] = df[c].astype(str).str.strip().str.replace(r"\s+", " ", regex=True)

    # T3 — Standardise missing tokens -> real NaN (keeps "Other" as a valid category)
    def to_nan(v):
        return np.nan if isinstance(v, str) and v.strip().lower() in (NULL_TOKENS - {"other"}) else v
    for c in obj_cols:
        df[c] = df[c].map(to_nan)

    # T4 — Drop exact duplicate rows
    dup = df.duplicated().sum()
    df = df.drop_duplicates().reset_index(drop=True)
    report["duplicates_removed"] = int(dup)

    # T5 — Coerce count columns to numeric, clip non-positive to 1
    for c in ["Number_of_vehicles_involved", "Number_of_casualties"]:
        if c in df:
            df[c] = pd.to_numeric(df[c], errors="coerce")
            df[c] = df[c].fillna(df[c].median()).clip(lower=1)
            df[c] = df[c].round().astype(int)

    # T6 — Outlier capping on counts (99th percentile, keeps tail readable)
    for c in ["Number_of_vehicles_involved", "Number_of_casualties"]:
        if c in df:
            cap = int(np.nanpercentile(df[c], 99))
            df[c] = df[c].clip(upper=cap)

    # T7 — Impute remaining categorical NaNs with explicit "Unknown" category
    #       (preserves rows instead of dropping; missingness becomes analysable)
    miss_before = int(df[obj_cols].isna().sum().sum())
    for c in obj_cols:
        if c in df:
            df[c] = df[c].fillna("Unknown")
    report["categorical_cells_imputed"] = miss_before

    # T8 — Canonicalise the target; drop rows with an unmappable target
    sev_map = {
        "slight injury": "Slight Injury", "slight": "Slight Injury",
        "serious injury": "Serious Injury", "serious": "Serious Injury",
        "fatal injury": "Fatal injury", "fatal": "Fatal injury",
    }
    df["Accident_severity"] = (df["Accident_severity"].astype(str).str.strip()
                               .str.lower().map(sev_map))
    bad = df["Accident_severity"].isna().sum()
    df = df.dropna(subset=["Accident_severity"]).reset_index(drop=True)
    report["unmappable_target_rows_dropped"] = int(bad)

    # T9 — Consolidate rare categories (<0.5%) into "Other" to stabilise encodings.
    # Skip the target and any high-cardinality raw fields (e.g. Time) that are NOT
    # true categoricals — Time holds HH:MM:SS values that are individually rare and
    # must survive intact for derive() to parse Hour / Time_of_day downstream.
    T9_SKIP = {"Accident_severity", "Time"}
    for c in obj_cols:
        if c in df and c not in T9_SKIP:
            freq = df[c].value_counts(normalize=True)
            rare = freq[freq < 0.005].index
            if len(rare):
                df[c] = df[c].where(~df[c].isin(rare), "Other")

    # T10 — Trim casualty-only leakage columns not used for accident-level analysis
    #        (kept out of FRONTEND_COLS; documented, not deleted, for transparency)
    report["rows_in"] = n0
    report["rows_out"] = len(df)
    return df, report


# ============================================================================
# 3. DERIVE  — new analytical features
# ============================================================================
def derive(df):
    # Parse Time -> Hour (robust: try datetime, fall back to leading HH regex)
    t = pd.to_datetime(df["Time"].astype(str), errors="coerce")
    hour = t.dt.hour
    if hour.isna().all():
        hour = pd.to_numeric(
            df["Time"].astype(str).str.extract(r"^\s*(\d{1,2})")[0], errors="coerce")
    med = hour.median()
    df["Hour"] = hour.fillna(12 if pd.isna(med) else med).round().astype(int).clip(0, 23)

    # Time-of-day bucket
    bins = [-1, 5, 11, 16, 20, 24]
    labels = ["Night (0-5)", "Morning (6-11)", "Afternoon (12-16)",
              "Evening (17-20)", "Night (21-23)"]
    df["Time_of_day"] = pd.cut(df["Hour"], bins=bins, labels=labels).astype(str)
    df["Time_of_day"] = df["Time_of_day"].replace("Night (21-23)", "Night (0-5)")

    # Weekend flag
    df["Is_weekend"] = df["Day_of_week"].isin(["Saturday", "Sunday"])

    # Ordinal severity (for modelling / sorting)
    df["Severity_rank"] = df["Accident_severity"].map(
        {s: i for i, s in enumerate(SEVERITY_ORDER)})
    return df


# ============================================================================
# 4. ANALYSE  — >=5 analytical tasks -> aggregate tables
# ============================================================================
def severity_rate(df, by):
    """Share of each severity class within each group + a weighted risk score."""
    g = (df.groupby(by)["Accident_severity"]
         .value_counts(normalize=True).unstack(fill_value=0))
    for s in SEVERITY_ORDER:
        if s not in g:
            g[s] = 0.0
    g = g[SEVERITY_ORDER]
    g["count"] = df.groupby(by).size()
    # risk score: weight serious=1, fatal=3 -> emphasise lethal outcomes
    g["risk"] = g["Serious Injury"] * 1 + g["Fatal injury"] * 3
    return g.reset_index()


# ============================================================================
# 5. MODEL  — multinomial logistic regression (exported for in-browser inference)
# ============================================================================
def train_model(df):
    from sklearn.linear_model import LogisticRegression
    from sklearn.model_selection import train_test_split
    from sklearn.metrics import f1_score, accuracy_score, classification_report

    cats = [c for c in MODEL_CAT if c in df]
    nums = [c for c in MODEL_NUM if c in df]

    # Manual one-hot so the frontend can rebuild the exact feature vector
    cat_levels = {c: sorted(df[c].astype(str).unique().tolist()) for c in cats}
    X_parts, feat_names = [], []
    for c in cats:
        for lv in cat_levels[c]:
            feat_names.append(f"{c}={lv}")
            X_parts.append((df[c].astype(str) == lv).astype(float).values)
    num_means, num_stds = {}, {}
    for c in nums:
        m, s = float(df[c].mean()), float(df[c].std() or 1.0)
        num_means[c], num_stds[c] = m, s
        feat_names.append(f"NUM::{c}")
        X_parts.append(((df[c] - m) / s).values)
    X = np.column_stack(X_parts)
    y = df["Accident_severity"].values

    Xtr, Xte, ytr, yte = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y)

    clf = LogisticRegression(
        max_iter=2000, class_weight="balanced", C=0.5, solver="lbfgs")
    clf.fit(Xtr, ytr)

    pred = clf.predict(Xte)
    metrics = {
        "accuracy": round(float(accuracy_score(yte, pred)), 4),
        "macro_f1": round(float(f1_score(yte, pred, average="macro")), 4),
        "weighted_f1": round(float(f1_score(yte, pred, average="weighted")), 4),
        "n_train": int(len(ytr)), "n_test": int(len(yte)),
        "report": classification_report(yte, pred, output_dict=True, zero_division=0),
    }
    print(f"  Model: acc={metrics['accuracy']}  macroF1={metrics['macro_f1']}")

    # sklearn orders classes alphabetically -> remap to a stable severity order
    classes = clf.classes_.tolist()
    coef = clf.coef_.tolist()          # [n_classes][n_features]
    intercept = clf.intercept_.tolist()

    model_json = {
        "classes": classes,
        "severity_order": SEVERITY_ORDER,
        "feature_names": feat_names,
        "coef": coef,
        "intercept": intercept,
        "cat_levels": cat_levels,
        "num_features": nums,
        "num_means": num_means,
        "num_stds": num_stds,
        "metrics": {k: v for k, v in metrics.items() if k != "report"},
        "per_class": {
            c: {
                "precision": round(metrics["report"][c]["precision"], 3),
                "recall": round(metrics["report"][c]["recall"], 3),
                "f1": round(metrics["report"][c]["f1-score"], 3),
                "support": int(metrics["report"][c]["support"]),
            } for c in classes if c in metrics["report"]
        },
    }
    return model_json


# ============================================================================
# 6. EXPORT
# ============================================================================
def export(df, report, model_json):
    # 6a — canonical cleaned CSV
    clean_csv = CLEAN_DIR / "rta_cleaned.csv"
    df.to_csv(clean_csv, index=False)
    print(f"  Saved cleaned CSV -> {clean_csv}  ({len(df):,} rows)")

    # 6b — lean records for client-side cross-filtering
    keep = [c for c in FRONTEND_COLS if c in df]
    records = df[keep].copy()
    records["Is_weekend"] = records["Is_weekend"].astype(bool)
    (FRONTEND_DATA / "records.json").write_text(
        records.to_json(orient="records"))
    print(f"  Saved records.json   -> {len(records):,} rows, {len(keep)} cols")

    # 6c — meta: distinct values, KPIs, precomputed aggregations
    cat_for_filter = [
        "Day_of_week", "Time_of_day", "Age_band_of_driver", "Sex_of_driver",
        "Driving_experience", "Area_accident_occured", "Light_conditions",
        "Weather_conditions", "Road_surface_conditions", "Type_of_collision",
        "Cause_of_accident", "Accident_severity",
    ]
    distinct = {c: sorted(df[c].astype(str).unique().tolist())
                for c in cat_for_filter if c in df}

    meta = {
        "n_records": int(len(df)),
        "severity_order": SEVERITY_ORDER,
        "severity_counts": df["Accident_severity"].value_counts().to_dict(),
        "distinct": distinct,
        "kpis": {
            "total": int(len(df)),
            "fatal_pct": round(float((df["Accident_severity"] == "Fatal injury").mean()) * 100, 2),
            "serious_pct": round(float((df["Accident_severity"] == "Serious Injury").mean()) * 100, 2),
            "avg_casualties": round(float(df["Number_of_casualties"].mean()), 2),
            "peak_hour": int(df["Hour"].value_counts().idxmax()),
            "weekend_pct": round(float(df["Is_weekend"].mean()) * 100, 2),
        },
        "cleaning_report": report,
        "agg": {
            "by_area": severity_rate(df, "Area_accident_occured").to_dict(orient="records"),
            "by_cause": severity_rate(df, "Cause_of_accident").to_dict(orient="records"),
            "by_weather": severity_rate(df, "Weather_conditions").to_dict(orient="records"),
            "by_light": severity_rate(df, "Light_conditions").to_dict(orient="records"),
            "by_age": severity_rate(df, "Age_band_of_driver").to_dict(orient="records"),
            "by_experience": severity_rate(df, "Driving_experience").to_dict(orient="records"),
        },
    }
    (FRONTEND_DATA / "meta.json").write_text(json.dumps(meta))
    print(f"  Saved meta.json")

    # 6d — model
    (FRONTEND_DATA / "model.json").write_text(json.dumps(model_json))
    print(f"  Saved model.json")


# ============================================================================
# Orchestrate
# ============================================================================
def main():
    print("=" * 64)
    print("ROAD ACCIDENT SEVERITY — cleaning & preparation pipeline")
    print("=" * 64)

    df = load_raw()
    print(f"[1] Loaded {len(df):,} raw rows, {df.shape[1]} columns")

    df, report = clean(df)
    print(f"[2] Cleaned -> {report['rows_out']:,} rows "
          f"({report['duplicates_removed']} dups, "
          f"{report['unmappable_target_rows_dropped']} bad-target dropped)")

    df = derive(df)
    print(f"[3] Derived features: Hour, Time_of_day, Is_weekend, Severity_rank")

    model_json = train_model(df)
    print(f"[5] Trained severity predictor")

    export(df, report, model_json)
    print("=" * 64)
    print("DONE. Cleaned data in data/cleaned/, frontend feed in "
          "frontend/public/data/")
    print("=" * 64)


if __name__ == "__main__":
    main()
