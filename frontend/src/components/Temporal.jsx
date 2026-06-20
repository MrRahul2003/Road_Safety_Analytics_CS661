import React, { useMemo, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, ReferenceArea } from "recharts";
import { useStore, groupSeverity } from "../data/store.jsx";
import { cividis, SEVERITY_ORDER } from "../theme.js";
import { axisProps, tipProps } from "./Overview.jsx";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function Temporal() {
  const { filtered, records, toggleFilter, isActive, setFieldValues, setHourRange, hourRange, sevColor } = useStore();
  const [metric, setMetric] = useState("volume"); // volume | risk
  const [hover, setHover] = useState(null);

  // Build day x hour matrix from the *unfiltered* records so the grid is stable,
  // but values reflect filters via a second pass.
  const matrix = useMemo(() => {
    const m = {};
    for (const d of DAYS) m[d] = Array.from({ length: 24 }, () => ({ total: 0, fatal: 0, serious: 0 }));
    for (const r of filtered) {
      const cell = m[r.Day_of_week]?.[r.Hour];
      if (!cell) continue;
      cell.total += 1;
      if (r.Accident_severity === "Fatal injury") cell.fatal += 1;
      if (r.Accident_severity === "Serious Injury") cell.serious += 1;
    }
    return m;
  }, [filtered]);

  const cellVal = (c) => metric === "volume" ? c.total : (c.total ? (c.serious + 3 * c.fatal) / c.total : 0);
  const maxVal = useMemo(() => {
    let mx = 0;
    for (const d of DAYS) for (const c of matrix[d]) mx = Math.max(mx, cellVal(c));
    return mx || 1;
  }, [matrix, metric]);
  const color = cividis(maxVal);

  // hourly severity composition (stacked)
  const hourly = useMemo(() => {
    const g = groupSeverity(filtered, "Hour");
    const byH = Object.fromEntries(g.map((x) => [x.key, x]));
    return Array.from({ length: 24 }, (_, h) => byH[h] || { key: String(h), total: 0, "Slight Injury": 0, "Serious Injury": 0, "Fatal injury": 0 });
  }, [filtered]);

  const W = 760, cellW = (W - 70) / 24, cellH = 30, gridH = cellH * 7;

  return (
    <>
      <div className="card">
        <div className="card-head">
          <span className="card-title">Accident intensity · day × hour</span>
          <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
            <button className={"btn ghost"} style={btn(metric === "volume")} onClick={() => setMetric("volume")}>Volume</button>
            <button className={"btn ghost"} style={btn(metric === "risk")} onClick={() => setMetric("risk")}>Injury risk</button>
          </div>
        </div>
        <div style={{ position: "relative", overflowX: "auto" }}>
          <svg viewBox={`0 0 ${W} ${gridH + 36}`} width="100%" style={{ minWidth: 620 }}>
            {DAYS.map((d, di) => (
              <text key={d} x={62} y={di * cellH + cellH / 2 + 18} textAnchor="end" fontSize="11" fill="#8B98A8"
                    style={{ cursor: "pointer" }} onClick={() => toggleFilter("Day_of_week", d)}
                    fontWeight={isActive("Day_of_week", d) ? 700 : 400}>{d.slice(0, 3)}</text>
            ))}
            {Array.from({ length: 24 }, (_, h) => (
              h % 3 === 0 && <text key={h} x={70 + h * cellW + cellW / 2} y={gridH + 30} textAnchor="middle"
                                   fontSize="10" fill="#5A6675" fontFamily="JetBrains Mono">{String(h).padStart(2, "0")}</text>
            ))}
            {DAYS.map((d, di) => matrix[d].map((c, h) => {
              const v = cellVal(c);
              return (
                <rect key={d + h} className="hm-cell" x={70 + h * cellW} y={di * cellH + 4} width={cellW - 2} height={cellH - 2}
                      rx="2" fill={c.total ? color(v) : "#0E141C"}
                      onClick={() => { setFieldValues("Day_of_week", [d]); setHourRange([h, h]); }}
                      onMouseEnter={() => setHover({ d, h, c, v })} onMouseLeave={() => setHover(null)} />
              );
            }))}
          </svg>
          {hover && (
            <div style={{ position: "absolute", top: 6, right: 6, background: "#0A0E14", border: "1px solid #2C3A4A",
                          borderRadius: 8, padding: "8px 11px", fontSize: 12 }}>
              <b>{hover.d} · {String(hover.h).padStart(2, "0")}:00</b>
              <div style={{ color: "#8B98A8" }}>{hover.c.total} accidents · {hover.c.fatal} fatal</div>
            </div>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10, fontSize: 11, color: "#8B98A8" }}>
          <span>{metric === "volume" ? "fewer" : "lower risk"}</span>
          <div style={{ display: "flex", flex: 1, height: 9, borderRadius: 5, overflow: "hidden" }}>
            {Array.from({ length: 24 }, (_, i) => <div key={i} style={{ flex: 1, background: color((i / 23) * maxVal) }} />)}
          </div>
          <span>{metric === "volume" ? "more" : "higher risk"}</span>
          <span className="tag">cividis · CVD-safe</span>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-head">
          <span className="card-title">Severity composition by hour</span>
          <span className="card-sub">click a bar to filter that hour · {hourRange ? `showing ${hourRange[0]}:00–${hourRange[1]}:59` : "all hours"}</span>
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={hourly} margin={{ left: 0, right: 10 }}>
            <XAxis dataKey="key" {...axisProps} tickFormatter={(h) => `${String(h).padStart(2, "0")}`} />
            <YAxis {...axisProps} />
            <Tooltip {...tipProps} labelFormatter={(h) => `${String(h).padStart(2, "0")}:00`} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {SEVERITY_ORDER.map((s) => (
              <Bar key={s} dataKey={s} stackId="a" fill={sevColor(s)}
                   onClick={(d) => setHourRange([+d.key, +d.key])} cursor="pointer" />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}

const btn = (active) => active
  ? { background: "#E69F00", color: "#0A0E14", borderColor: "#E69F00", padding: "6px 14px", fontSize: 12 }
  : { padding: "6px 14px", fontSize: 12 };
