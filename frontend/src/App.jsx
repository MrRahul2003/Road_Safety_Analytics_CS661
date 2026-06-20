import React, { useState } from "react";
import { useStore } from "./data/store.jsx";
import { PALETTES } from "./theme.js";
import Overview from "./components/Overview.jsx";
import Geospatial from "./components/Geospatial.jsx";
import Temporal from "./components/Temporal.jsx";
import Insights from "./components/Insights.jsx";
import Causal from "./components/Causal.jsx";
import Patterns from "./components/Patterns.jsx";
import IndiaMap from "./components/IndiaMap.jsx";
import Predictor from "./components/Predictor.jsx";

const VIEWS = [
  { id: "overview", label: "Overview", num: "00", el: Overview, crumb: "Severity at a glance" },
  { id: "geo", label: "Geospatial", num: "01", el: Geospatial, crumb: "Where accidents concentrate" },
  { id: "temporal", label: "Temporal", num: "02", el: Temporal, crumb: "When risk peaks" },
  { id: "insights", label: "Insights", num: "03", el: Insights, crumb: "Who & under what conditions" },
  { id: "causal", label: "Causal", num: "04", el: Causal, crumb: "Why accidents turn severe" },
  { id: "patterns", label: "Patterns", num: "05", el: Patterns, crumb: "What relates to what" },
  { id: "india", label: "India", num: "06", el: IndiaMap, crumb: "State-wise accidents (MoRTH)" },
  { id: "predict", label: "Predictor", num: "07", el: Predictor, crumb: "Forecast severity" },
];

export default function App() {
  const store = useStore();
  const [view, setView] = useState("overview");

  if (store.error)
    return <div className="loading">Failed to load data: {store.error}<br/>Run the Python pipeline first, then restart the dev server.</div>;
  if (!store.records) return <div className="loading">Loading accident records…</div>;

  const active = VIEWS.find((v) => v.id === view);
  const ViewEl = active.el;
  const { activeChips, clearField, clearAll, filtered, records } = store;

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark" />
          <div>
            <div className="brand-name">Road Safety<br/>Analytics</div>
            <div className="brand-sub">Accident Severity</div>
          </div>
        </div>

        {VIEWS.map((v) => (
          <div key={v.id} className={"nav-item" + (v.id === view ? " active" : "")} onClick={() => setView(v.id)}>
            <span className="nav-dot" />
            {v.label}
            <span className="nav-num">{v.num}</span>
          </div>
        ))}

        <div className="sidebar-foot">
          <div className="palette-label">Colour scheme · CVD-safe</div>
          {Object.entries(PALETTES).map(([key, p]) => (
            <div key={key}
                 className={"palette-opt" + (key === store.paletteKey ? " active" : "")}
                 onClick={() => store.setPaletteKey(key)}>
              {p.label}
              <span className="swatches">
                {Object.values(p.severity).map((c) => <span key={c} className="swatch" style={{ background: c }} />)}
              </span>
            </div>
          ))}
        </div>
      </aside>

      <main className="main">
        <div className="topbar">
          <h1>{active.label}</h1>
          <span className="crumb">{active.crumb}</span>
          <span className="spacer" />
          <span className="record-count">
            <b>{filtered.length.toLocaleString()}</b> / {records.length.toLocaleString()} records
          </span>
        </div>

        <div className="filterbar">
          {activeChips.length === 0 ? (
            <span className="filter-hint">Click any bar, cell, or area to cross-filter every view ↓</span>
          ) : (
            <>
              {activeChips.map((c, i) => (
                <span key={i} className="filter-chip">
                  <span className="k">{c.field.replace(/_/g, " ")}:</span> {c.value}
                  <span className="x" onClick={() => clearField(c.field)}>✕</span>
                </span>
              ))}
              <span className="clear-all" onClick={clearAll}>clear all</span>
            </>
          )}
        </div>

        <div className="content">
          <ViewEl />
        </div>
      </main>
    </div>
  );
}
