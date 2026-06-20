# How to run — Road Safety Analytics

Two parts: a **one-time Python pipeline** that cleans the data + trains the model, then the
**React frontend** that visualises it. The frontend needs the pipeline's JSON output, so run
the pipeline first (the generated feeds are already committed, so you *can* skip straight to
the frontend if you just want to view it).

Prerequisites: **Python ≥ 3.9** and **Node ≥ 18**.

> ⚠️ When copying a command below, **do not copy the trailing `# …` comments**. Some shells
> pass `#` as an argument instead of treating it as a comment — that is what makes Vite serve
> a blank page (see Troubleshooting).

---

## 1 · Data pipeline (Python)

```bash
cd data_cleaning

# create an isolated environment (recommended, required on Python 3.13+)
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate

pip install -r requirements.txt
python clean_and_prepare.py
```

What it does:

- Reads the real raw CSV from `data/raw/` (auto-detects `Road.csv` or `RTA Dataset.csv`).
  If none is present it generates a clearly-flagged synthetic placeholder.
- Writes `data/cleaned/rta_cleaned.csv` and three feeds the app reads:
  `frontend/public/data/records.json`, `meta.json`, `model.json`.

You should see a summary ending in `DONE.` with the real row count (≈12,316).

---

## 2 · Frontend (React + Vite)

```bash
cd frontend
npm install
npm run dev
```

Then open the URL Vite prints — **http://localhost:5173/**.

To build a production bundle instead:

```bash
npm run build
npm run preview
```

---

## The eight views

| # | View | What it shows |
|---|------|---------------|
| 00 | Overview | Severity distribution, by area, across the day |
| 01 | Geospatial | Area-category crash-density bubble map + risk ranking |
| 02 | Temporal | Day × hour heatmap (volume/risk toggle) + hourly bars |
| 03 | Insights | Severity composition by driver & environment factors |
| 04 | Causal | Top causes/collisions + frequency-vs-lethality scatter |
| 05 | Patterns | Factor-association ranking, treemap, radar fingerprint, casualty histogram |
| 06 | India | State choropleth of MoRTH 2022 accidents — click a state to drill in |
| 07 | Predictor | In-browser severity forecaster (logistic regression) |

Every chart in views 00–05 is a **cross-filter**: click a bar / cell / bubble / segment and
the selection propagates to all other views. The **India** view (06) uses a separate MoRTH
dataset and cross-filters within itself only.

---

## Troubleshooting

**Blank page at localhost:5173.** You almost certainly pasted `npm run dev` *with* a trailing
`# comment`, so Vite received `#` as its root directory and served nothing. Run it clean:

```bash
npm run dev
```

If a stale server is stuck on the port, find and stop it, then restart:

```bash
lsof -nP -iTCP:5173 -sTCP:LISTEN     # shows the PID
kill <PID>
npm run dev
```

**`Failed to load data` in the app.** The JSON feeds are missing — run the Python pipeline
(step 1), which writes them into `frontend/public/data/`, then refresh.

**Port 5173 already in use.** Vite will start on the next free port (5174, …). Use whatever URL
it prints, not a hard-coded 5173.

**Python install fails on a very new Python.** Use the venv shown above; `requirements.txt`
pins `pandas`, `numpy`, `scikit-learn`, which resolve to current wheels inside a clean venv.
