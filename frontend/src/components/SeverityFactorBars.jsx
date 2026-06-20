import React, { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { useStore, groupSeverity } from "../data/store.jsx";
import { SEVERITY_ORDER } from "../theme.js";
import { tipProps } from "./Overview.jsx";

// Reusable card: 100%-stacked severity composition for any categorical field,
// sorted by injury risk. Click a bar to cross-filter. Fits its grid cell.
export default function SeverityFactorBars({ field, title, sub, top = 8, sortByRisk = true, legend = false, minCount = 5, style }) {
  const { filtered, sevColor, toggleFilter } = useStore();

  const data = useMemo(() => {
    let g = groupSeverity(filtered, field, { minCount });
    g = g.sort((a, b) => (sortByRisk ? b.risk - a.risk : b.total - a.total)).slice(0, top);
    return g.map((o) => ({
      key: o.key,
      total: o.total,
      _slight: o.total ? (o["Slight Injury"] / o.total) * 100 : 0,
      _serious: o.total ? (o["Serious Injury"] / o.total) * 100 : 0,
      _fatal: o.total ? (o["Fatal injury"] / o.total) * 100 : 0,
    }));
  }, [filtered, field, sortByRisk, top, minCount]);

  const keyMap = { "Slight Injury": "_slight", "Serious Injury": "_serious", "Fatal injury": "_fatal" };

  return (
    <div className="card" style={style}>
      <div className="card-head">
        <span className="card-title">{title}</span>
        {sub && <span className="card-sub">{sub}</span>}
      </div>
      <div className="fill">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 6, right: 30 }} barCategoryGap={3}>
            <XAxis type="number" domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickFormatter={(v) => `${v}%`}
                   stroke="#2C3A4A" tick={{ fontSize: 9.5, fill: "#5A6675" }} tickLine={false} />
            <YAxis type="category" dataKey="key" width={118} stroke="#2C3A4A" tick={{ fontSize: 10, fill: "#8B98A8" }} tickLine={false} />
            <Tooltip {...tipProps} formatter={(v, n) => [`${v.toFixed(1)}%`, n]} />
            {legend && <Legend wrapperStyle={{ fontSize: 11 }} />}
            {SEVERITY_ORDER.map((s) => (
              <Bar key={s} dataKey={keyMap[s]} name={s} stackId="a" fill={sevColor(s)}
                   onClick={(d) => toggleFilter(field, d.key)} cursor="pointer"
                   label={s === "Fatal injury" ? { position: "right", fontSize: 9.5, fill: "#D55E00",
                            formatter: (v) => (v > 0 ? `${v.toFixed(0)}%` : "") } : false} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
