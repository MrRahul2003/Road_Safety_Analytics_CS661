import React, { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
         ScatterChart, Scatter, ZAxis, Cell, ReferenceLine } from "recharts";
import { useStore, groupSeverity } from "../data/store.jsx";
import { cividis, SEVERITY_ORDER } from "../theme.js";
import { axisProps, tipProps } from "./Overview.jsx";
import SeverityFactorBars from "./SeverityFactorBars.jsx";

export default function Causal() {
  const { filtered, sevColor, toggleFilter, isActive } = useStore();

  const causes = useMemo(() =>
    groupSeverity(filtered, "Cause_of_accident", { minCount: 5 })
      .sort((a, b) => b.total - a.total).slice(0, 10), [filtered]);

  const collisions = useMemo(() =>
    groupSeverity(filtered, "Type_of_collision", { minCount: 5 })
      .sort((a, b) => b.total - a.total).slice(0, 8), [filtered]);

  const scatter = useMemo(() => {
    const g = groupSeverity(filtered, "Cause_of_accident", { minCount: 10 });
    return g.map((o) => ({ ...o, x: o.total, y: +(o.fatalRate * 100).toFixed(2), z: o.total }));
  }, [filtered]);
  const maxRisk = Math.max(0.01, ...scatter.map((s) => s.risk));
  const color = cividis(maxRisk);
  const avgFatal = scatter.length ? scatter.reduce((a, s) => a + s.y, 0) / scatter.length : 0;

  return (
    <div className="view" style={{ gridTemplateRows: "1fr 1fr" }}>
      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr 1fr", minHeight: 0 }}>
        <div className="card">
          <div className="card-head">
            <span className="card-title">Top causes of accident</span>
            <span className="card-sub">by volume · click to filter</span>
          </div>
          <div className="fill">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={causes} layout="vertical" margin={{ left: 6, right: 14 }}>
              <XAxis type="number" {...axisProps} />
              <YAxis type="category" dataKey="key" width={155} stroke="#2C3A4A" tick={{ fontSize: 10.5, fill: "#8B98A8" }} tickLine={false} />
              <Tooltip {...tipProps} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {SEVERITY_ORDER.map((s) => (
                <Bar key={s} dataKey={s} stackId="a" fill={sevColor(s)}
                     onClick={(d) => toggleFilter("Cause_of_accident", d.key)} cursor="pointer" />
              ))}
            </BarChart>
          </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <span className="card-title">Collision type</span>
            <span className="card-sub">by volume · click to filter</span>
          </div>
          <div className="fill">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={collisions} layout="vertical" margin={{ left: 6, right: 14 }}>
              <XAxis type="number" {...axisProps} />
              <YAxis type="category" dataKey="key" width={155} stroke="#2C3A4A" tick={{ fontSize: 10.5, fill: "#8B98A8" }} tickLine={false} />
              <Tooltip {...tipProps} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {SEVERITY_ORDER.map((s) => (
                <Bar key={s} dataKey={s} stackId="a" fill={sevColor(s)}
                     onClick={(d) => toggleFilter("Type_of_collision", d.key)} cursor="pointer" />
              ))}
            </BarChart>
          </ResponsiveContainer>
          </div>
        </div>

        <SeverityFactorBars field="Vehicle_movement" title="By vehicle movement" sub="severity % · click to filter" top={8} />
      </div>

      <div className="card">
        <div className="card-head">
          <span className="card-title">Frequency vs lethality · find the "rare but deadly" causes</span>
          <span className="card-sub">x = volume · y = fatal rate · bubble = volume · dashed line = mean fatal rate</span>
        </div>
        <div className="fill">
          <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ left: 6, right: 20, top: 10, bottom: 14 }}>
            <XAxis type="number" dataKey="x" name="Accidents" {...axisProps}
                   label={{ value: "accidents (volume)", position: "insideBottom", offset: -6, fontSize: 11, fill: "#5A6675" }} />
            <YAxis type="number" dataKey="y" name="Fatal %" unit="%" {...axisProps}
                   label={{ value: "fatal rate", angle: -90, position: "insideLeft", fontSize: 11, fill: "#5A6675" }} />
            <ZAxis type="number" dataKey="z" range={[60, 600]} />
            <ReferenceLine y={avgFatal} stroke="#5A6675" strokeDasharray="4 4" />
            <Tooltip {...tipProps} cursor={{ strokeDasharray: "3 3" }}
                     formatter={(v, n) => n === "Fatal %" ? [`${v}%`, n] : [v.toLocaleString(), n]}
                     labelFormatter={() => ""} content={<CauseTip />} />
            <Scatter data={scatter} onClick={(d) => toggleFilter("Cause_of_accident", d.key)} cursor="pointer">
              {scatter.map((s) => (
                <Cell key={s.key} fill={color(s.risk)} stroke={isActive("Cause_of_accident", s.key) ? "#E69F00" : "#0A0E14"} strokeWidth={isActive("Cause_of_accident", s.key) ? 2.5 : 1} />
              ))}
            </Scatter>
          </ScatterChart>
          </ResponsiveContainer>
        </div>
        <div style={{ fontSize: 11, color: "#8B98A8", marginTop: 4, flex: "none" }}>
          Causes in the <b style={{ color: "#E6EDF3" }}>upper area</b> (above the mean line) convert to fatalities disproportionately —
          prioritise these for interventions even when their raw counts are modest.
        </div>
      </div>
    </div>
  );
}

function CauseTip({ payload }) {
  if (!payload || !payload.length) return null;
  const d = payload[0].payload;
  return (
    <div style={{ background: "#0A0E14", border: "1px solid #2C3A4A", borderRadius: 8, padding: "9px 12px", fontSize: 12 }}>
      <div style={{ fontWeight: 600, marginBottom: 3 }}>{d.key}</div>
      <div style={{ color: "#8B98A8" }}>{d.total.toLocaleString()} accidents</div>
      <div style={{ color: "#8B98A8" }}>Fatal {d.y}% · Serious {(d.seriousRate * 100).toFixed(1)}%</div>
    </div>
  );
}
