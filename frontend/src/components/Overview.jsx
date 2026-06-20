import React, { useMemo, useState, useEffect } from "react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
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
    <>
      <div className="kpi-row">
        <Kpi label="Total accidents" value={filtered.length.toLocaleString()} foot="in current selection" />
        <Kpi label="Fatal share" value={fatalPct} unit="%" foot={`${sev["Fatal injury"].toLocaleString()} fatal injuries`} />
        <Kpi label="Serious share" value={seriousPct} unit="%" foot={`${sev["Serious Injury"].toLocaleString()} serious injuries`} />
        <Kpi label="Avg casualties" value={avgCas} foot="per accident" />
        <Kpi label="Peak hour" value={peakHour} foot={`${weekendPct}% on weekends`} />
      </div>

      <div className="grid" style={{ gridTemplateColumns: "minmax(280px, 1fr) 1.6fr" }}>
        <div className="card">
          <div className="card-head"><span className="card-title">Severity distribution</span></div>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={donut} dataKey="value" nameKey="name" innerRadius={62} outerRadius={92} paddingAngle={2}
                   onClick={(d) => toggleFilter("Accident_severity", d.name)} stroke="#0A0E14" strokeWidth={2}>
                {donut.map((d) => (
                  <Cell key={d.name} fill={sevColor(d.name)} cursor="pointer"
                        opacity={isActive("Accident_severity", d.name) || true ? 1 : 0.4} />
                ))}
              </Pie>
              <Tooltip {...tipProps} formatter={(v, n) => [`${v.toLocaleString()} (${((v / total) * 100).toFixed(1)}%)`, n]} />
            </PieChart>
          </ResponsiveContainer>
          <div className="legend" style={{ justifyContent: "center", marginTop: 6 }}>
            {SEVERITY_ORDER.map((s) => (
              <span key={s} className="legend-item" onClick={() => toggleFilter("Accident_severity", s)} style={{ cursor: "pointer" }}>
                <span className="legend-dot" style={{ background: sevColor(s) }} /> {s}
              </span>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <span className="card-title">Severity by accident area</span>
            <span className="card-sub">top 8 · click a bar to filter</span>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={areas} layout="vertical" margin={{ left: 10, right: 16 }}>
              <XAxis type="number" {...axisProps} />
              <YAxis type="category" dataKey="key" width={150} {...axisProps} tick={{ fontSize: 11, fill: "#8B98A8" }} />
              <Tooltip {...tipProps} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {SEVERITY_ORDER.map((s) => (
                <Bar key={s} dataKey={s} stackId="a" fill={sevColor(s)}
                     onClick={(d) => toggleFilter("Area_accident_occured", d.key)} cursor="pointer" />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-head">
          <span className="card-title">Severity composition across the day</span>
          <span className="card-sub">click a segment to filter by time-of-day</span>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={tod} margin={{ left: 0, right: 10 }}>
            <XAxis dataKey="key" {...axisProps} />
            <YAxis {...axisProps} />
            <Tooltip {...tipProps} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {SEVERITY_ORDER.map((s) => (
              <Bar key={s} dataKey={s} stackId="a" fill={sevColor(s)}
                   onClick={(d) => toggleFilter("Time_of_day", d.key)} cursor="pointer" />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      <IndiaMini />
    </>
  );
}

// Compact India summary (MoRTH 2022) — a small strip on the Overview. The full
// interactive choropleth lives in the dedicated India view.
function IndiaMini() {
  const [data, setData] = useState(null);
  useEffect(() => {
    fetch("data/india_accidents.json").then((r) => r.json()).then(setData).catch(() => {});
  }, []);
  if (!data) return null;

  const states = Object.entries(data.states).map(([name, s]) => ({ name, ...s }));
  const accidents = states.reduce((a, s) => a + s.accidents, 0);
  const killed = states.reduce((a, s) => a + s.killed, 0);
  const fatalRate = accidents ? killed / accidents : 0;
  const top = [...states].sort((a, b) => b.accidents - a.accidents).slice(0, 5);
  const max = top[0]?.accidents || 1;
  const color = cividis(max);

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="card-head">
        <span className="card-title">India · state-wise road accidents</span>
        <span className="card-sub">{data.source} · open the India view for the full map</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(220px, 0.8fr) 1.6fr", gap: 18, alignItems: "center" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          <MiniStat label="Accidents" value={accidents.toLocaleString()} />
          <MiniStat label="Killed" value={killed.toLocaleString()} />
          <MiniStat label="Fatal / crash" value={`${(fatalRate * 100).toFixed(0)}%`} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ fontSize: 10.5, color: "#5A6675", textTransform: "uppercase", letterSpacing: "0.05em" }}>Top 5 states by accidents</div>
          {top.map((s) => (
            <div key={s.name} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12 }}>
              <span style={{ width: 110, color: "#8B98A8" }}>{s.name}</span>
              <div style={{ flex: 1, background: "#0F151D", borderRadius: 5, overflow: "hidden", height: 14 }}>
                <div style={{ width: `${(s.accidents / max) * 100}%`, height: "100%", background: color(s.accidents) }} />
              </div>
              <span style={{ width: 56, textAlign: "right", fontFamily: "JetBrains Mono", color: "#E6EDF3" }}>
                {(s.accidents / 1000).toFixed(1)}k
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value }) {
  return (
    <div style={{ background: "#0F151D", borderRadius: 8, padding: "9px 10px", border: "1px solid #1F2935" }}>
      <div style={{ fontSize: 9.5, color: "#8B98A8", textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</div>
      <div style={{ fontFamily: "JetBrains Mono", fontSize: 16, fontWeight: 700, marginTop: 2 }}>{value}</div>
    </div>
  );
}

export const axisProps = { stroke: "#2C3A4A", tick: { fontSize: 11, fill: "#8B98A8" }, tickLine: false };
export const tipProps = {
  contentStyle: { background: "#0F151D", border: "1px solid #2C3A4A", borderRadius: 8, fontSize: 12 },
  labelStyle: { color: "#E6EDF3" }, itemStyle: { color: "#E6EDF3" }, cursor: { fill: "#ffffff08" },
};
