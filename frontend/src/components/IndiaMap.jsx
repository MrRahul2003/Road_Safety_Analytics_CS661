import React, { useEffect, useMemo, useState } from "react";
import { geoMercator, geoPath } from "d3-geo";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { cividis } from "../theme.js";
import { axisProps, tipProps } from "./Overview.jsx";

const METRICS = {
  accidents: { label: "Total accidents", short: "Accidents", get: (s) => s.accidents, fmt: (v) => v.toLocaleString() },
  killed: { label: "Persons killed", short: "Killed", get: (s) => s.killed, fmt: (v) => v.toLocaleString() },
  fatalRate: { label: "Fatality rate", short: "Fatal/crash", get: (s) => (s.accidents ? s.killed / s.accidents : 0), fmt: (v) => `${(v * 100).toFixed(0)}%` },
};

const W = 540, H = 600;

export default function IndiaMap() {
  const [geo, setGeo] = useState(null);
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [metric, setMetric] = useState("accidents");
  const [selected, setSelected] = useState(null);
  const [hover, setHover] = useState(null);

  useEffect(() => {
    Promise.all([
      fetch("data/india_states.geojson").then((r) => r.json()),
      fetch("data/india_accidents.json").then((r) => r.json()),
    ]).then(([g, d]) => { setGeo(g); setData(d); }).catch((e) => setErr(String(e)));
  }, []);

  const path = useMemo(() => {
    if (!geo) return null;
    const proj = geoMercator().fitSize([W, H], geo);
    return geoPath(proj);
  }, [geo]);

  const M = METRICS[metric];
  const states = data?.states || {};

  const maxVal = useMemo(() => {
    const vals = Object.values(states).map(M.get);
    return Math.max(0.0001, ...vals);
  }, [states, metric]);
  const color = useMemo(() => cividis(maxVal), [maxVal]);

  const ranking = useMemo(() =>
    Object.entries(states)
      .map(([name, s]) => ({ name, value: M.get(s), accidents: s.accidents, killed: s.killed }))
      .sort((a, b) => b.value - a.value), [states, metric]);

  const national = useMemo(() => {
    const acc = Object.values(states).reduce((a, s) => a + s.accidents, 0);
    const kil = Object.values(states).reduce((a, s) => a + s.killed, 0);
    return { accidents: acc, killed: kil, fatalRate: acc ? kil / acc : 0 };
  }, [states]);

  if (err) return <div className="card">Failed to load India data: {err}</div>;
  if (!geo || !data || !path) return <div className="card">Loading India map…</div>;

  const sel = selected ? { name: selected, ...states[selected] } : null;
  const rank = selected ? ranking.findIndex((r) => r.name === selected) + 1 : null;

  const headStats = sel
    ? { title: sel.name, accidents: sel.accidents, killed: sel.killed, fatalRate: sel.accidents ? sel.killed / sel.accidents : 0 }
    : { title: "All India", ...national };

  return (
    <div className="view" style={{ gridTemplateRows: "auto 1fr" }}>
      <div className="card flat" style={{ borderColor: "#2C3A4A", background: "#0F151D" }}>
        <span style={{ fontSize: 12, color: "#8B98A8" }}>
          <b style={{ color: "#E6EDF3" }}>Separate dataset · </b>
          India state-wise road accidents from <b style={{ color: "#E6EDF3" }}>{data.source}</b>. This is independent
          of the Addis Ababa records used in the other views. <b style={{ color: "#E6EDF3" }}>Click a state</b> to drive the
          panels on the right; click it again (or “Clear”) to return to the all-India totals.
        </span>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1.4fr 1fr", minHeight: 0 }}>
        <div className="card">
          <div className="card-head">
            <span className="card-title">Accidents by state · {data.year}</span>
            <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
              {Object.entries(METRICS).map(([k, m]) => (
                <button key={k} className="btn ghost" style={btn(metric === k)} onClick={() => setMetric(k)}>{m.short}</button>
              ))}
            </div>
          </div>
          <div className="fill" style={{ position: "relative" }}>
            <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet" style={{ display: "block" }}>
              {geo.features.map((f) => {
                const name = f.properties.st_nm;
                const s = states[name];
                const v = s ? M.get(s) : null;
                const isSel = selected === name;
                const dim = selected && !isSel;
                return (
                  <path key={name} d={path(f)}
                        fill={v == null ? "#1A222C" : color(v)}
                        stroke={isSel ? "#E69F00" : "#0A0E14"}
                        strokeWidth={isSel ? 1.8 : 0.4}
                        opacity={dim ? 0.45 : (hover && hover !== name ? 0.8 : 1)}
                        style={{ cursor: "pointer" }}
                        onClick={() => setSelected((cur) => (cur === name ? null : name))}
                        onMouseEnter={() => setHover(name)} onMouseLeave={() => setHover(null)} />
                );
              })}
            </svg>
            {hover && states[hover] && (
              <div style={{ position: "absolute", top: 10, left: 10, background: "#0A0E14", border: "1px solid #2C3A4A",
                            borderRadius: 8, padding: "9px 12px", fontSize: 12, pointerEvents: "none", maxWidth: 220 }}>
                <div style={{ fontWeight: 600, marginBottom: 3 }}>{hover}</div>
                <div style={{ color: "#8B98A8" }}>{states[hover].accidents.toLocaleString()} accidents · {states[hover].killed.toLocaleString()} killed</div>
                <div style={{ color: "#E69F00", fontFamily: "JetBrains Mono" }}>
                  {METRICS.fatalRate.fmt(METRICS.fatalRate.get(states[hover]))} fatal per crash
                </div>
              </div>
            )}
          </div>
          <div style={{ flex: "none" }}><CividisBar max={maxVal} fmt={M.fmt} label={M.label} /></div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12, minHeight: 0 }}>
          <div className="card" style={{ flex: "none" }}>
            <div className="card-head">
              <span className="card-title">{headStats.title}</span>
              {selected
                ? <span className="card-sub" style={{ cursor: "pointer", color: "#E69F00" }} onClick={() => setSelected(null)}>✕ clear</span>
                : <span className="card-sub">click a state to drill in</span>}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              <Stat label="Accidents" value={headStats.accidents.toLocaleString()} />
              <Stat label="Killed" value={headStats.killed.toLocaleString()} />
              <Stat label="Fatal / crash" value={`${(headStats.fatalRate * 100).toFixed(0)}%`} />
            </div>
            {sel && (
              <div style={{ marginTop: 14, padding: "10px 12px", background: "#0F151D", borderRadius: 8, border: "1px solid #2C3A4A", fontSize: 12, color: "#8B98A8" }}>
                <b style={{ color: "#E6EDF3" }}>{sel.name}</b> ranks <b style={{ color: "#E69F00" }}>#{rank}</b> of {ranking.length} by {M.label.toLowerCase()}.
                Its fatality rate is {sel.accidents && sel.killed / sel.accidents > national.fatalRate
                  ? <span style={{ color: "#D55E00" }}>above</span>
                  : <span style={{ color: "#56B4E9" }}>below</span>} the national {(national.fatalRate * 100).toFixed(0)}%.
              </div>
            )}
          </div>

          <div className="card">
            <div className="card-head">
              <span className="card-title">State ranking</span>
              <span className="card-sub">top 12 by {M.short.toLowerCase()} · click to select</span>
            </div>
            <div className="fill">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ranking.slice(0, 12)} layout="vertical" margin={{ left: 6, right: 34 }} barCategoryGap={4}>
                <XAxis type="number" {...axisProps} tickFormatter={(v) => metric === "fatalRate" ? `${Math.round(v * 100)}%` : (v >= 1000 ? `${Math.round(v / 1000)}k` : v)} />
                <YAxis type="category" dataKey="name" width={120} {...axisProps} tick={{ fontSize: 10.5, fill: "#8B98A8" }} />
                <Tooltip {...tipProps} formatter={(v) => [M.fmt(v), M.label]} cursor={{ fill: "#ffffff08" }} />
                <Bar dataKey="value" radius={[0, 3, 3, 0]}
                     onClick={(d) => setSelected((cur) => (cur === d.name ? null : d.name))} cursor="pointer">
                  {ranking.slice(0, 12).map((r) => (
                    <Cell key={r.name} fill={color(r.value)}
                          stroke={selected === r.name ? "#E69F00" : "none"} strokeWidth={selected === r.name ? 2 : 0} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div style={{ background: "#0F151D", borderRadius: 8, padding: "10px 12px", border: "1px solid #1F2935" }}>
      <div style={{ fontSize: 10, color: "#8B98A8", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
      <div style={{ fontFamily: "JetBrains Mono", fontSize: 18, fontWeight: 700, marginTop: 3 }}>{value}</div>
    </div>
  );
}

function CividisBar({ max, fmt, label }) {
  const scale = cividis(max);
  const stops = Array.from({ length: 24 }, (_, i) => (i / 23) * max);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12, fontSize: 11, color: "#8B98A8" }}>
      <span>{label}: low</span>
      <div style={{ display: "flex", flex: 1, height: 9, borderRadius: 5, overflow: "hidden" }}>
        {stops.map((s, i) => <div key={i} style={{ flex: 1, background: scale(s) }} />)}
      </div>
      <span>high ({fmt(max)})</span>
      <span className="tag">cividis · CVD-safe</span>
    </div>
  );
}

const btn = (active) => active
  ? { background: "#E69F00", color: "#0A0E14", borderColor: "#E69F00", padding: "6px 12px", fontSize: 12 }
  : { padding: "6px 12px", fontSize: 12 };
