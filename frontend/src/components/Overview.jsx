import React, { useMemo, useState, useEffect } from "react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { geoMercator, geoPath } from "d3-geo";
import { useStore, severityBreakdown, groupSeverity } from "../data/store.jsx";
import { SEVERITY_ORDER, cividis } from "../theme.js";

function Kpi({ label, value, unit, foot }) {
  return (
    <div className="kpi">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}<span className="kpi-unit"> {unit}</span></div>
      <div className="kpi-foot">{foot}</div>
    </div>
  );
}

export default function Overview() {
  const { filtered, sevColor, toggleFilter, isActive } = useStore();

  const sev = useMemo(() => severityBreakdown(filtered), [filtered]);
  const total = filtered.length || 1;
  const fatalPct = ((sev["Fatal injury"] / total) * 100).toFixed(1);
  const seriousPct = ((sev["Serious Injury"] / total) * 100).toFixed(1);
  const avgCas = (filtered.reduce((a, r) => a + (r.Number_of_casualties || 0), 0) / total).toFixed(2);
  const peakHour = useMemo(() => {
    const h = {};
    for (const r of filtered) h[r.Hour] = (h[r.Hour] || 0) + 1;
    const top = Object.entries(h).sort((a, b) => b[1] - a[1])[0];
    return top ? `${String(top[0]).padStart(2, "0")}:00` : "—";
  }, [filtered]);
  const weekendPct = ((filtered.filter((r) => r.Is_weekend).length / total) * 100).toFixed(0);

  const donut = SEVERITY_ORDER.map((s) => ({ name: s, value: sev[s] }));

  const areas = useMemo(() =>
    groupSeverity(filtered, "Area_accident_occured")
      .sort((a, b) => b.total - a.total).slice(0, 8), [filtered]);

  const tod = useMemo(() => {
    const order = ["Night (0-5)", "Morning (6-11)", "Afternoon (12-16)", "Evening (17-20)"];
    const g = groupSeverity(filtered, "Time_of_day");
    return order.map((k) => g.find((x) => x.key === k) || { key: k, total: 0, "Slight Injury": 0, "Serious Injury": 0, "Fatal injury": 0 });
  }, [filtered]);

  return (
    <div className="view" style={{ gridTemplateColumns: "1.9fr 1fr", gridTemplateRows: "auto 1fr 1fr 1fr" }}>
      <div className="kpi-row" style={{ gridColumn: "1 / -1", marginBottom: 0 }}>
        <Kpi label="Total accidents" value={filtered.length.toLocaleString()} foot="in current selection" />
        <Kpi label="Fatal share" value={fatalPct} unit="%" foot={`${sev["Fatal injury"].toLocaleString()} fatal injuries`} />
        <Kpi label="Serious share" value={seriousPct} unit="%" foot={`${sev["Serious Injury"].toLocaleString()} serious injuries`} />
        <Kpi label="Avg casualties" value={avgCas} foot="per accident" />
        <Kpi label="Peak hour" value={peakHour} foot={`${weekendPct}% on weekends`} />
      </div>

      <div className="card" style={{ gridColumn: 2, gridRow: 2 }}>
        <div className="card-head"><span className="card-title">Severity distribution</span></div>
        <div className="fill">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={donut} dataKey="value" nameKey="name" innerRadius="48%" outerRadius="78%" paddingAngle={2}
                   onClick={(d) => toggleFilter("Accident_severity", d.name)} stroke="#0A0E14" strokeWidth={2}>
                {donut.map((d) => (
                  <Cell key={d.name} fill={sevColor(d.name)} cursor="pointer" />
                ))}
              </Pie>
              <Tooltip {...tipProps} formatter={(v, n) => [`${v.toLocaleString()} (${((v / total) * 100).toFixed(1)}%)`, n]} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="legend" style={{ justifyContent: "center", marginTop: 4 }}>
          {SEVERITY_ORDER.map((s) => (
            <span key={s} className="legend-item" onClick={() => toggleFilter("Accident_severity", s)} style={{ cursor: "pointer" }}>
              <span className="legend-dot" style={{ background: sevColor(s) }} /> {s}
            </span>
          ))}
        </div>
      </div>

      <div className="card" style={{ gridColumn: 2, gridRow: 3 }}>
        <div className="card-head">
          <span className="card-title">Severity by accident area</span>
          <span className="card-sub">top 8 · click a bar to filter</span>
        </div>
        <div className="fill">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={areas} layout="vertical" margin={{ left: 10, right: 16 }}>
              <XAxis type="number" {...axisProps} />
              <YAxis type="category" dataKey="key" width={150} {...axisProps} tick={{ fontSize: 11, fill: "#8B98A8" }} />
              <Tooltip {...tipProps} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {SEVERITY_ORDER.map((s) => (
                <Bar key={s} dataKey={s} stackId="a" fill={sevColor(s)}
                     onClick={(d) => toggleFilter("Area_accident_occured", d.key)} cursor="pointer" />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card" style={{ gridColumn: 2, gridRow: 4 }}>
        <div className="card-head">
          <span className="card-title">Severity composition across the day</span>
          <span className="card-sub">click a segment to filter</span>
        </div>
        <div className="fill">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={tod} margin={{ left: 0, right: 10 }}>
              <XAxis dataKey="key" {...axisProps} />
              <YAxis {...axisProps} />
              <Tooltip {...tipProps} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {SEVERITY_ORDER.map((s) => (
                <Bar key={s} dataKey={s} stackId="a" fill={sevColor(s)}
                     onClick={(d) => toggleFilter("Time_of_day", d.key)} cursor="pointer" />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <IndiaMini style={{ gridColumn: 1, gridRow: "2 / 5" }} />
    </div>
  );
}

// Compact India choropleth (MoRTH 2022) — a small map up top on the Overview.
// Hover for a tooltip, click a state to focus the side stats. The full-size
// interactive map lives in the dedicated India view.
function IndiaMini({ style }) {
  const [geo, setGeo] = useState(null);
  const [data, setData] = useState(null);
  const [hover, setHover] = useState(null);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    Promise.all([
      fetch("data/india_states.geojson").then((r) => r.json()),
      fetch("data/india_accidents.json").then((r) => r.json()),
    ]).then(([g, d]) => { setGeo(g); setData(d); }).catch(() => {});
  }, []);

  const W = 300, H = 330;
  const path = useMemo(() => (geo ? geoPath(geoMercator().fitSize([W, H], geo)) : null), [geo]);

  if (!geo || !data || !path) return null;

  const states = data.states;
  const arr = Object.entries(states).map(([name, s]) => ({ name, ...s }));
  const max = Math.max(1, ...arr.map((s) => s.accidents));
  const color = cividis(max);
  const natAcc = arr.reduce((a, s) => a + s.accidents, 0);
  const natKil = arr.reduce((a, s) => a + s.killed, 0);
  const top = [...arr].sort((a, b) => b.accidents - a.accidents).slice(0, 5);

  const f = selected && states[selected] ? { name: selected, ...states[selected] } : null;
  const head = f
    ? { title: f.name, accidents: f.accidents, killed: f.killed, fatalRate: f.accidents ? f.killed / f.accidents : 0 }
    : { title: "All India", accidents: natAcc, killed: natKil, fatalRate: natAcc ? natKil / natAcc : 0 };

  return (
    <div className="card" style={style}>
      <div className="card-head">
        <span className="card-title">India · accidents by state</span>
        <span className="card-sub">{data.source} · full map in the India view</span>
      </div>
      <div className="fill" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 190px", gap: 14 }}>
        <div style={{ position: "relative", minHeight: 0 }}>
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet" style={{ display: "block" }}>
            {geo.features.map((feat) => {
              const name = feat.properties.st_nm;
              const s = states[name];
              const isSel = selected === name;
              const dim = selected && !isSel;
              return (
                <path key={name} d={path(feat)}
                      fill={s ? color(s.accidents) : "#1A222C"}
                      stroke={isSel ? "#E69F00" : "#0A0E14"} strokeWidth={isSel ? 1.6 : 0.4}
                      opacity={dim ? 0.45 : (hover && hover !== name ? 0.8 : 1)}
                      style={{ cursor: "pointer" }}
                      onClick={() => setSelected((c) => (c === name ? null : name))}
                      onMouseEnter={() => setHover(name)} onMouseLeave={() => setHover(null)} />
              );
            })}
          </svg>
          {hover && states[hover] && (
            <div style={{ position: "absolute", top: 6, left: 6, background: "#0A0E14", border: "1px solid #2C3A4A",
                          borderRadius: 7, padding: "7px 10px", fontSize: 11.5, pointerEvents: "none", maxWidth: 200 }}>
              <div style={{ fontWeight: 600 }}>{hover}</div>
              <div style={{ color: "#8B98A8" }}>{states[hover].accidents.toLocaleString()} accidents · {states[hover].killed.toLocaleString()} killed</div>
            </div>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10, minHeight: 0, overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{head.title}</span>
            {selected && <span style={{ fontSize: 11, color: "#E69F00", cursor: "pointer" }} onClick={() => setSelected(null)}>✕ clear</span>}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <MiniStat label="Accidents" value={head.accidents.toLocaleString()} />
            <MiniStat label="Killed" value={head.killed.toLocaleString()} />
            <MiniStat label="Fatal / crash" value={`${(head.fatalRate * 100).toFixed(0)}%`} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <div style={{ fontSize: 10.5, color: "#5A6675", textTransform: "uppercase", letterSpacing: "0.05em" }}>Top 5 states · click the map to focus</div>
            {top.map((s) => (
              <div key={s.name} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12, cursor: "pointer" }}
                   onClick={() => setSelected((c) => (c === s.name ? null : s.name))}>
                <span style={{ width: 104, color: selected === s.name ? "#E6EDF3" : "#8B98A8" }}>{s.name}</span>
                <div style={{ flex: 1, background: "#0F151D", borderRadius: 5, overflow: "hidden", height: 13 }}>
                  <div style={{ width: `${(s.accidents / max) * 100}%`, height: "100%", background: color(s.accidents) }} />
                </div>
                <span style={{ width: 52, textAlign: "right", fontFamily: "JetBrains Mono", color: "#E6EDF3" }}>
                  {(s.accidents / 1000).toFixed(1)}k
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8,
                  background: "#0F151D", borderRadius: 8, padding: "8px 11px", border: "1px solid #1F2935" }}>
      <span style={{ fontSize: 10, color: "#8B98A8", textTransform: "uppercase", letterSpacing: "0.04em", whiteSpace: "nowrap" }}>{label}</span>
      <span style={{ fontFamily: "JetBrains Mono", fontSize: 16, fontWeight: 700, whiteSpace: "nowrap" }}>{value}</span>
    </div>
  );
}

export const axisProps = { stroke: "#2C3A4A", tick: { fontSize: 11, fill: "#8B98A8" }, tickLine: false };
export const tipProps = {
  contentStyle: { background: "#0F151D", border: "1px solid #2C3A4A", borderRadius: 8, fontSize: 12 },
  labelStyle: { color: "#E6EDF3" }, itemStyle: { color: "#E6EDF3" }, cursor: { fill: "#ffffff08" },
};
