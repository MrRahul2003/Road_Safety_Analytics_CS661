import React, { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { useStore, groupSeverity } from "../data/store.jsx";
import { SEVERITY_ORDER } from "../theme.js";
import { tipProps } from "./Overview.jsx";

function FactorPanel({ field, title, sub, sortByRisk = true, normalize = true }) {
  const { filtered, sevColor, toggleFilter, isActive } = useStore();
  const data = useMemo(() => {
    let g = groupSeverity(filtered, field, { minCount: 5 });
    g = g.sort((a, b) => sortByRisk ? b.risk - a.risk : b.total - a.total);
    if (normalize) {
      g = g.map((o) => ({
        ...o,
        _slight: o.total ? (o["Slight Injury"] / o.total) * 100 : 0,
        _serious: o.total ? (o["Serious Injury"] / o.total) * 100 : 0,
        _fatal: o.total ? (o["Fatal injury"] / o.total) * 100 : 0,
      }));
    }
    return g.slice(0, 8);
  }, [filtered, field, sortByRisk, normalize]);

  const keyMap = { "Slight Injury": "_slight", "Serious Injury": "_serious", "Fatal injury": "_fatal" };
  const h = Math.max(150, data.length * 34 + 30);

  return (
    <div className="card">
      <div className="card-head">
        <span className="card-title">{title}</span>
        <span className="card-sub">{sub}</span>
      </div>
      <div className="fill">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 6, right: 38 }} barCategoryGap={4}>
            <XAxis type="number" domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} allowDataOverflow tickFormatter={(v) => `${Math.round(v)}%`} stroke="#2C3A4A" tick={{ fontSize: 10, fill: "#5A6675" }} tickLine={false} />
            <YAxis type="category" dataKey="key" width={120} stroke="#2C3A4A" tick={{ fontSize: 10.5, fill: "#8B98A8" }} tickLine={false} />
            <Tooltip {...tipProps} formatter={(v, n) => [`${v.toFixed(1)}%`, n.replace("_", "")]} />
            {SEVERITY_ORDER.map((s) => (
              <Bar key={s} dataKey={keyMap[s]} name={s} stackId="a" fill={sevColor(s)}
                   onClick={(d) => toggleFilter(field, d.key)} cursor="pointer"
                   label={s === "Fatal injury" ? { position: "right", fontSize: 10, fill: "#D55E00",
                            formatter: (v) => v > 0 ? `${v.toFixed(0)}%☠` : "" } : false} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default function Insights() {
  const { sevColor } = useStore();
  return (
    <div className="view" style={{ gridTemplateRows: "auto 1fr" }}>
      <div className="legend" style={{ flex: "none" }}>
        <span style={{ fontSize: 12, color: "#8B98A8" }}>Severity composition (% of accidents) by driver & environment factors, sorted by injury risk. ☠ marks fatal share. Click any segment to cross-filter.</span>
        <span className="spacer" style={{ flex: 1 }} />
        {SEVERITY_ORDER.map((s) => (
          <span key={s} className="legend-item"><span className="legend-dot" style={{ background: sevColor(s) }} /> {s}</span>
        ))}
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr 1fr", gridTemplateRows: "1fr 1fr", minHeight: 0 }}>
        <FactorPanel field="Age_band_of_driver" title="Driver age band" sub="by risk" />
        <FactorPanel field="Driving_experience" title="Driving experience" sub="by risk" />
        <FactorPanel field="Weather_conditions" title="Weather" sub="by risk" />
        <FactorPanel field="Light_conditions" title="Light conditions" sub="by risk" />
        <FactorPanel field="Road_surface_conditions" title="Road surface" sub="by risk" />
        <FactorPanel field="Sex_of_driver" title="Driver sex" sub="by risk" />
      </div>
    </div>
  );
}
