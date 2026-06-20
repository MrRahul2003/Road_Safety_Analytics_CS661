import React, { useMemo, useState, useEffect } from "react";
import { useStore } from "../data/store.jsx";

function softmax(logits) {
  const m = Math.max(...logits);
  const ex = logits.map((l) => Math.exp(l - m));
  const s = ex.reduce((a, b) => a + b, 0);
  return ex.map((e) => e / s);
}

function prettify(s) { return s.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase()); }

export default function Predictor() {
  const { model, sevColor } = useStore();
  if (!model) return null;

  const catFields = Object.keys(model.cat_levels);
  const numFields = model.num_features || [];

  // default selection = first level / rounded mean
  const [sel, setSel] = useState(() => {
    const s = {};
    catFields.forEach((f) => { s[f] = model.cat_levels[f][0]; });
    numFields.forEach((f) => { s[f] = Math.round(model.num_means[f]); });
    return s;
  });

  // Build feature vector aligned to model.feature_names
  const { probs, ordered, contributions } = useMemo(() => {
    const idx = {};
    model.feature_names.forEach((fn, i) => { idx[fn] = i; });
    const x = new Array(model.feature_names.length).fill(0);
    catFields.forEach((f) => {
      const key = `${f}=${sel[f]}`;
      if (idx[key] !== undefined) x[idx[key]] = 1;
    });
    numFields.forEach((f) => {
      const key = `NUM::${f}`;
      if (idx[key] !== undefined) x[idx[key]] = (sel[f] - model.num_means[f]) / (model.num_stds[f] || 1);
    });

    const logits = model.classes.map((_, c) =>
      model.intercept[c] + model.coef[c].reduce((a, w, i) => a + w * x[i], 0));
    const p = softmax(logits);

    // order classes by the canonical severity order for display
    const order = model.severity_order.filter((s) => model.classes.includes(s));
    const ordered = order.map((s) => ({ cls: s, p: p[model.classes.indexOf(s)] }));

    // top contributions toward the predicted class
    const predIdx = p.indexOf(Math.max(...p));
    const contrib = model.feature_names
      .map((fn, i) => ({ fn, v: model.coef[predIdx][i] * x[i] }))
      .filter((d) => d.v !== 0)
      .sort((a, b) => Math.abs(b.v) - Math.abs(a.v)).slice(0, 6);

    return { probs: p, ordered, contributions: contrib, predClass: model.classes[predIdx] };
  }, [sel, model]);

  const pred = ordered.reduce((a, b) => (b.p > a.p ? b : a), ordered[0]);
  const m = model.metrics;

  return (
    <div className="grid" style={{ gridTemplateColumns: "1.4fr 1fr" }}>
      <div className="card">
        <div className="card-head">
          <span className="card-title">Severity predictor · scenario input</span>
          <span className="card-sub">multinomial logistic regression · updates live</span>
        </div>
        <div className="form-grid">
          {catFields.map((f) => (
            <div className="field" key={f}>
              <label>{prettify(f)}</label>
              <select value={sel[f]} onChange={(e) => setSel({ ...sel, [f]: e.target.value })}>
                {model.cat_levels[f].map((lv) => <option key={lv} value={lv}>{lv}</option>)}
              </select>
            </div>
          ))}
          {numFields.map((f) => (
            <div className="field" key={f}>
              <label>{prettify(f)}</label>
              <input type="number" min="1" max="20" value={sel[f]}
                     onChange={(e) => setSel({ ...sel, [f]: +e.target.value })} />
            </div>
          ))}
        </div>

        <div style={{ marginTop: 20 }}>
          <div className="card-head"><span className="card-title">Predicted severity</span></div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {ordered.map((o) => (
              <div key={o.cls} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ width: 110, fontSize: 12.5, color: "#8B98A8" }}>{o.cls}</span>
                <div style={{ flex: 1, background: "#0F151D", borderRadius: 6, overflow: "hidden" }}>
                  <div className="prob-bar" style={{ width: `${Math.max(o.p * 100, 4)}%`, background: sevColor(o.cls) }}>
                    {(o.p * 100).toFixed(1)}%
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 14, padding: "12px 14px", background: "#0F151D", borderRadius: 8, border: "1px solid #2C3A4A" }}>
            Most likely outcome: <b style={{ color: sevColor(pred.cls) }}>{pred.cls}</b> ({(pred.p * 100).toFixed(1)}% confidence)
          </div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div className="card">
          <div className="card-head"><span className="card-title">Model performance</span><span className="card-sub">held-out 20% test</span></div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
            <Metric label="Accuracy" value={(m.accuracy * 100).toFixed(1) + "%"} />
            <Metric label="Macro F1" value={m.macro_f1.toFixed(3)} />
            <Metric label="Weighted F1" value={m.weighted_f1.toFixed(3)} />
            <Metric label="Test rows" value={m.n_test.toLocaleString()} />
          </div>
          <table className="tbl">
            <thead><tr><th>Class</th><th className="num">Prec</th><th className="num">Recall</th><th className="num">F1</th><th className="num">N</th></tr></thead>
            <tbody>
              {model.severity_order.filter((s) => model.per_class[s]).map((s) => {
                const r = model.per_class[s];
                return (
                  <tr key={s}>
                    <td><span className="legend-dot" style={{ background: sevColor(s), display: "inline-block", marginRight: 6 }} />{s}</td>
                    <td className="num">{r.precision.toFixed(2)}</td>
                    <td className="num">{r.recall.toFixed(2)}</td>
                    <td className="num">{r.f1.toFixed(2)}</td>
                    <td className="num">{r.support}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div style={{ fontSize: 11, color: "#5A6675", marginTop: 10 }}>
            Trained with class-balanced weights to counter the heavy Slight-Injury majority — recall on rare Fatal/Serious classes matters more than raw accuracy here.
          </div>
        </div>

        <div className="card">
          <div className="card-head"><span className="card-title">Why this prediction</span><span className="card-sub">top drivers · {pred.cls}</span></div>
          {contributions.map((c) => (
            <div key={c.fn} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <span style={{ flex: 1, fontSize: 11.5, color: "#8B98A8" }}>{c.fn.replace("NUM::", "").replace(/_/g, " ").replace("=", " = ")}</span>
              <div style={{ width: 120, display: "flex", justifyContent: "center" }}>
                <div style={{ width: "100%", height: 8, background: "#0F151D", borderRadius: 4, position: "relative" }}>
                  <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 1, background: "#2C3A4A" }} />
                  <div style={{ position: "absolute", height: 8, borderRadius: 4,
                                background: c.v > 0 ? "#D55E00" : "#56B4E9",
                                left: c.v > 0 ? "50%" : `${50 - Math.min(Math.abs(c.v) * 18, 48)}%`,
                                width: `${Math.min(Math.abs(c.v) * 18, 48)}%` }} />
                </div>
              </div>
            </div>
          ))}
          <div style={{ fontSize: 11, color: "#5A6675", marginTop: 4 }}>
            <span style={{ color: "#D55E00" }}>■</span> pushes toward this outcome ·
            <span style={{ color: "#56B4E9" }}> ■</span> pushes away
          </div>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div style={{ background: "#0F151D", borderRadius: 8, padding: "10px 12px", border: "1px solid #1F2935" }}>
      <div style={{ fontSize: 10.5, color: "#8B98A8", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
      <div style={{ fontFamily: "JetBrains Mono", fontSize: 20, fontWeight: 700, marginTop: 3 }}>{value}</div>
    </div>
  );
}
