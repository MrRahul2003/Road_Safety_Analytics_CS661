import React, { useMemo } from "react";
import { Treemap, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, Cell,
         RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from "recharts";
import { useStore, groupSeverity } from "../data/store.jsx";
import { cividis, SEVERITY_ORDER } from "../theme.js";
import { axisProps, tipProps } from "./Overview.jsx";

// ---------------------------------------------------------------------------
// Candidate factors for the association ranking. Only those present in the
// records are scored; each is cross-tabulated against Accident_severity.
// ---------------------------------------------------------------------------
const ASSOC_FACTORS = [
  ["Light_conditions", "Light"],
  ["Weather_conditions", "Weather"],
  ["Cause_of_accident", "Cause"],
  ["Type_of_collision", "Collision type"],
  ["Area_accident_occured", "Area"],
  ["Age_band_of_driver", "Driver age"],
  ["Driving_experience", "Experience"],
  ["Road_surface_conditions", "Road surface"],
  ["Sex_of_driver", "Driver sex"],
  ["Time_of_day", "Time of day"],
  ["Day_of_week", "Day of week"],
  ["Vehicle_movement", "Vehicle movement"],
  ["Type_of_vehicle", "Vehicle type"],
  ["Lanes_or_Medians", "Lanes / medians"],
  ["Educational_level", "Education"],
  ["Number_of_vehicles_involved", "Vehicles involved"],
  ["Number_of_casualties", "Casualties"],
];

// Cramér's V — strength of association (0..1) between a categorical factor and
// the 3-class severity target. Derived live from whatever rows are filtered.
function cramersV(rows, factor) {
  const table = new Map();          // factor level -> [slight, serious, fatal]
  const colTot = [0, 0, 0];
  let N = 0;
  for (const r of rows) {
    const ci = SEVERITY_ORDER.indexOf(r.Accident_severity);
    if (ci < 0) continue;
    const k = String(r[factor]);
    if (!table.has(k)) table.set(k, [0, 0, 0]);
    table.get(k)[ci] += 1;
    colTot[ci] += 1;
    N += 1;
  }
  if (N === 0 || table.size < 2) return 0;
  let chi2 = 0;
  for (const row of table.values()) {
    const rt = row[0] + row[1] + row[2];
    for (let c = 0; c < 3; c++) {
      const exp = (rt * colTot[c]) / N;
      if (exp > 0) { const d = row[c] - exp; chi2 += (d * d) / exp; }
    }
  }
  const k = Math.min(table.size, 3);          // min(#rows, #cols)
  const denom = N * (k - 1);
  return denom > 0 ? Math.min(1, Math.sqrt(chi2 / denom)) : 0;
}

// Binary "danger conditions" for the radar fingerprint.
const CONDITIONS = [
  ["Darkness", (r) => String(r.Light_conditions).startsWith("Darkness")],
  ["Rain / Fog", (r) => ["Raining", "Raining and Windy", "Fog or mist"].includes(r.Weather_conditions)],
  ["Speed / DUI", (r) => ["Driving at high speed", "Driving under the influence of drugs"].includes(r.Cause_of_accident)],
  ["Night", (r) => String(r.Time_of_day).startsWith("Night")],
  ["Weekend", (r) => r.Is_weekend === true],
  ["Multi-vehicle", (r) => Number(r.Number_of_vehicles_involved) >= 3],
];

export default function Patterns() {
  const { filtered, sevColor, toggleFilter, isActive } = useStore();

  // 1 — factor association ranking ------------------------------------------
  const assoc = useMemo(() => {
    const present = ASSOC_FACTORS.filter(([f]) => filtered.length && f in filtered[0]);
    return present
      .map(([f, label]) => ({ field: f, label, v: cramersV(filtered, f) }))
      .sort((a, b) => b.v - a.v);
  }, [filtered]);
  const maxV = Math.max(0.01, ...assoc.map((a) => a.v));
  const assocColor = cividis(maxV);

  // 2 — treemap of causes ----------------------------------------------------
  const tree = useMemo(() => {
    const g = groupSeverity(filtered, "Cause_of_accident", { minCount: 5 });
    return g.map((o) => ({ name: o.key, size: o.total, fatalRate: o.fatalRate, total: o.total }));
  }, [filtered]);
  const maxFatal = Math.max(0.01, ...tree.map((t) => t.fatalRate));
  const treeColor = cividis(maxFatal);
  const treeLookup = useMemo(() => Object.fromEntries(tree.map((t) => [t.name, t])), [tree]);

  // 3 — risk fingerprint radar ----------------------------------------------
  const radar = useMemo(() => {
    const severe = (rows) => {
      let s = 0;
      for (const r of rows) if (r.Accident_severity !== "Slight Injury") s += 1;
      return rows.length ? (s / rows.length) * 100 : 0;
    };
    const baseline = severe(filtered);
    return CONDITIONS.map(([label, test]) => ({
      axis: label,
      value: +severe(filtered.filter(test)).toFixed(1),
      baseline: +baseline.toFixed(1),
    }));
  }, [filtered]);
  const radarMax = Math.max(10, ...radar.map((d) => Math.max(d.value, d.baseline)));

  // 4 — casualty-count distribution -----------------------------------------
  const casualties = useMemo(() =>
    groupSeverity(filtered, "Number_of_casualties")
      .map((o) => ({ ...o, cas: Number(o.key) }))
      .sort((a, b) => a.cas - b.cas), [filtered]);

  return (
    <div className="view" style={{ gridTemplateRows: "1fr 1fr" }}>
      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", minHeight: 0 }}>
        {/* 1 — Association ranking */}
        <div className="card">
          <div className="card-head">
            <span className="card-title">What drives severity · factor association</span>
            <span className="card-sub">Cramér's V vs severity · higher = stronger link</span>
          </div>
          <div className="fill">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={assoc} layout="vertical" margin={{ left: 6, right: 40 }} barCategoryGap={2}>
                <XAxis type="number" domain={[0, Math.ceil(maxV * 20) / 20]} {...axisProps}
                       tickFormatter={(v) => v.toFixed(2)} />
                <YAxis type="category" dataKey="label" width={110} {...axisProps}
                       tick={{ fontSize: 10, fill: "#8B98A8" }} />
                <Tooltip {...tipProps} formatter={(v) => [v.toFixed(3), "Cramér's V"]} />
                <Bar dataKey="v" radius={[0, 3, 3, 0]}
                     label={{ position: "right", fontSize: 9.5, fill: "#8B98A8", formatter: (v) => v.toFixed(2) }}>
                  {assoc.map((a) => <Cell key={a.field} fill={assocColor(a.v)} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 3 — Risk fingerprint radar */}
        <div className="card">
          <div className="card-head">
            <span className="card-title">Risk fingerprint · danger conditions</span>
            <span className="card-sub">% serious-or-fatal · orange vs grey baseline</span>
          </div>
          <div className="fill">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radar} outerRadius="70%">
                <PolarGrid stroke="#2C3A4A" />
                <PolarAngleAxis dataKey="axis" tick={{ fontSize: 10.5, fill: "#8B98A8" }} />
                <PolarRadiusAxis angle={90} domain={[0, radarMax]} tick={{ fontSize: 9, fill: "#5A6675" }} />
                <Radar name="Baseline (all)" dataKey="baseline" stroke="#5A6675" fill="#5A6675" fillOpacity={0.12} />
                <Radar name="Under condition" dataKey="value" stroke="#D55E00" fill="#D55E00" fillOpacity={0.38} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Tooltip {...tipProps} formatter={(v, n) => [`${v}%`, n]} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", minHeight: 0 }}>
        {/* 2 — Treemap */}
        <div className="card">
          <div className="card-head">
            <span className="card-title">Cause landscape · volume × lethality</span>
            <span className="card-sub">area = crashes · colour = fatal rate · click to filter</span>
          </div>
          <div className="fill">
            <ResponsiveContainer width="100%" height="100%">
              <Treemap data={tree} dataKey="size" stroke="#0A0E14" isAnimationActive={false}
                       content={<TreeCell lookup={treeLookup} color={treeColor} maxFatal={maxFatal}
                                          onPick={(name) => toggleFilter("Cause_of_accident", name)}
                                          isActive={(name) => isActive("Cause_of_accident", name)} />}>
                <Tooltip {...tipProps} content={<TreeTip lookup={treeLookup} />} />
              </Treemap>
            </ResponsiveContainer>
          </div>
          <div style={{ flex: "none" }}><CividisBar max={maxFatal} left="lower fatal rate" right="higher fatal rate" pct /></div>
        </div>

        {/* 4 — Casualty histogram */}
        <div className="card">
          <div className="card-head">
            <span className="card-title">Severity by casualties per crash</span>
            <span className="card-sub">distribution · click a bar to filter</span>
          </div>
          <div className="fill">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={casualties} margin={{ left: 0, right: 10 }}>
                <XAxis dataKey="cas" {...axisProps} />
                <YAxis {...axisProps} />
                <Tooltip {...tipProps} labelFormatter={(v) => `${v} casualties`} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {SEVERITY_ORDER.map((s) => (
                  <Bar key={s} dataKey={s} stackId="a" fill={sevColor(s)}
                       onClick={(d) => toggleFilter("Number_of_casualties", d.key)} cursor="pointer" />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

// recharts Treemap custom node: colour by fatal rate, label, click-to-filter.
function TreeCell(props) {
  const { x, y, width, height, name, lookup, color, maxFatal, onPick, isActive } = props;
  if (width <= 0 || height <= 0 || !name) return null;
  const node = lookup[name];
  if (!node) return null;
  const sel = isActive(name);
  const dark = node.fatalRate / maxFatal > 0.5;
  return (
    <g style={{ cursor: "pointer" }} onClick={() => onPick(name)}>
      <rect x={x} y={y} width={width} height={height} rx={2}
            fill={color(node.fatalRate)}
            stroke={sel ? "#E69F00" : "#0A0E14"} strokeWidth={sel ? 2.5 : 1} />
      {width > 70 && height > 30 && (
        <text x={x + 7} y={y + 18} fontSize={11} fontWeight={600}
              fill={dark ? "#0A0E14" : "#E6EDF3"} pointerEvents="none">
          {name.length > Math.floor(width / 8) ? name.slice(0, Math.floor(width / 8)) + "…" : name}
        </text>
      )}
      {width > 70 && height > 46 && (
        <text x={x + 7} y={y + 34} fontSize={10} fontFamily="JetBrains Mono"
              fill={dark ? "#0A0E14" : "#8B98A8"} pointerEvents="none">
          {node.total.toLocaleString()} · {(node.fatalRate * 100).toFixed(1)}% fatal
        </text>
      )}
    </g>
  );
}

function TreeTip({ active, payload, lookup }) {
  if (!active || !payload || !payload.length) return null;
  const name = payload[0].payload?.name;
  const node = lookup[name];
  if (!node) return null;
  return (
    <div style={{ background: "#0A0E14", border: "1px solid #2C3A4A", borderRadius: 8, padding: "9px 12px", fontSize: 12 }}>
      <div style={{ fontWeight: 600, marginBottom: 3 }}>{name}</div>
      <div style={{ color: "#8B98A8" }}>{node.total.toLocaleString()} crashes</div>
      <div style={{ color: "#8B98A8" }}>Fatal rate {(node.fatalRate * 100).toFixed(1)}%</div>
    </div>
  );
}

function CividisBar({ max, left, right, pct }) {
  const scale = cividis(max);
  const stops = Array.from({ length: 24 }, (_, i) => (i / 23) * max);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12, fontSize: 11, color: "#8B98A8" }}>
      <span>{left}</span>
      <div style={{ display: "flex", flex: 1, height: 9, borderRadius: 5, overflow: "hidden" }}>
        {stops.map((s, i) => <div key={i} style={{ flex: 1, background: scale(s) }} />)}
      </div>
      <span>{right}{pct ? ` (${(max * 100).toFixed(0)}%)` : ""}</span>
      <span className="tag">cividis · CVD-safe</span>
    </div>
  );
}
