import React, { useMemo } from "react";
import {
  BarChart, Bar, LineChart, Line, ScatterChart, Scatter, ZAxis,
  RadialBarChart, RadialBar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { useStore, groupSeverity } from "../data/store.jsx";
import { cividis, SEVERITY_ORDER } from "../theme.js";
import { axisProps, tipProps } from "./Overview.jsx";

const AGE_ORDER = ["Under 18", "18-30", "31-50", "Over 51", "Unknown"];
const EXP_ORDER = ["No Licence", "Below 1yr", "1-2yr", "2-5yr", "5-10yr", "Above 10yr", "Unknown"];

// reorder grouped rows by a known ordinal sequence, appending any extras
function ordered(rows, order) {
  const map = Object.fromEntries(rows.map((o) => [o.key, o]));
  const head = order.filter((k) => map[k]).map((k) => map[k]);
  const tail = rows.filter((o) => !order.includes(o.key));
  return [...head, ...tail];
}

export default function Insights() {
  const { filtered, sevColor, toggleFilter } = useStore();

  const age = useMemo(() => ordered(groupSeverity(filtered, "Age_band_of_driver"), AGE_ORDER), [filtered]);

  const exp = useMemo(() =>
    ordered(groupSeverity(filtered, "Driving_experience"), EXP_ORDER)
      .map((o) => ({ key: o.key, Fatal: +(o.fatalRate * 100).toFixed(1), Serious: +(o.seriousRate * 100).toFixed(1) })),
    [filtered]);

  const weather = useMemo(() =>
    groupSeverity(filtered, "Weather_conditions", { minCount: 10 })
      .map((o) => ({ key: o.key, x: o.total, y: +(o.fatalRate * 100).toFixed(2), z: o.total, risk: o.risk })),
    [filtered]);
  const wMaxRisk = Math.max(0.01, ...weather.map((d) => d.risk));
  const wColor = cividis(wMaxRisk);

  const light = useMemo(() =>
    groupSeverity(filtered, "Light_conditions")
      .sort((a, b) => b.risk - a.risk)
      .map((o) => ({ name: o.key, value: +(o.fatalRate * 100).toFixed(1), risk: o.risk })),
    [filtered]);
  const lMaxRisk = Math.max(0.01, ...light.map((d) => d.risk));
  const lColor = cividis(lMaxRisk);

  const surface = useMemo(() => groupSeverity(filtered, "Road_surface_conditions", { minCount: 1 }), [filtered]);
  const sMaxRisk = Math.max(0.01, ...surface.map((d) => d.risk));
  const sColor = cividis(sMaxRisk);

  const sex = useMemo(() =>
    groupSeverity(filtered, "Sex_of_driver", { minCount: 1 })
      .map((o) => ({ key: o.key, Fatal: +(o.fatalRate * 100).toFixed(1), Serious: +(o.seriousRate * 100).toFixed(1) })),
    [filtered]);

  return (
    <div className="view" style={{ gridTemplateRows: "auto 1fr" }}>
      <div className="legend" style={{ flex: "none" }}>
        <span style={{ fontSize: 12, color: "#8B98A8" }}>
          Six lenses on <b style={{ color: "#E6EDF3" }}>who</b> and <b style={{ color: "#E6EDF3" }}>under what conditions</b> crashes turn severe — click most charts to cross-filter.
        </span>
        <span className="spacer" style={{ flex: 1 }} />
        {SEVERITY_ORDER.map((s) => (
          <span key={s} className="legend-item"><span className="legend-dot" style={{ background: sevColor(s) }} /> {s}</span>
        ))}
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr 1fr", gridTemplateRows: "1fr 1fr", minHeight: 0 }}>

        {/* 1 — Driver age · vertical stacked volume */}
        <div className="card">
          <div className="card-head"><span className="card-title">Driver age band</span><span className="card-sub">volume + severity</span></div>
          <div className="fill">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={age} margin={{ left: 0, right: 8 }}>
                <XAxis dataKey="key" {...axisProps} tick={{ fontSize: 10, fill: "#8B98A8" }} />
                <YAxis {...axisProps} />
                <Tooltip {...tipProps} />
                {SEVERITY_ORDER.map((s) => (
                  <Bar key={s} dataKey={s} stackId="a" fill={sevColor(s)}
                       onClick={(d) => toggleFilter("Age_band_of_driver", d.key)} cursor="pointer" />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 2 — Driving experience · line trend of lethality */}
        <div className="card">
          <div className="card-head"><span className="card-title">Driving experience</span><span className="card-sub">fatal & serious rate, least→most</span></div>
          <div className="fill">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={exp} margin={{ left: 0, right: 12, top: 6 }}>
                <XAxis dataKey="key" {...axisProps} tick={{ fontSize: 9.5, fill: "#8B98A8" }} />
                <YAxis {...axisProps} unit="%" />
                <Tooltip {...tipProps} formatter={(v, n) => [`${v}%`, n]} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="Serious" stroke={sevColor("Serious Injury")} strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="Fatal" stroke={sevColor("Fatal injury")} strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 3 — Weather · frequency vs lethality scatter */}
        <div className="card">
          <div className="card-head"><span className="card-title">Weather</span><span className="card-sub">volume × fatal rate · click a point</span></div>
          <div className="fill">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ left: 4, right: 14, top: 8, bottom: 6 }}>
                <XAxis type="number" dataKey="x" name="Accidents" {...axisProps} />
                <YAxis type="number" dataKey="y" name="Fatal" unit="%" {...axisProps} />
                <ZAxis type="number" dataKey="z" range={[60, 400]} />
                <Tooltip {...tipProps} cursor={{ strokeDasharray: "3 3" }} content={<WeatherTip />} />
                <Scatter data={weather} onClick={(d) => toggleFilter("Weather_conditions", d.key)} cursor="pointer">
                  {weather.map((d) => <Cell key={d.key} fill={wColor(d.risk)} stroke="#0A0E14" />)}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 4 — Light conditions · radial fatal-rate bars */}
        <div className="card">
          <div className="card-head"><span className="card-title">Light conditions</span><span className="card-sub">fatal rate · radial</span></div>
          <div className="fill">
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart data={light} innerRadius="22%" outerRadius="98%" startAngle={90} endAngle={-270}>
                <RadialBar dataKey="value" background={{ fill: "#0F151D" }} cornerRadius={3}
                           onClick={(d) => toggleFilter("Light_conditions", d.name)} cursor="pointer">
                  {light.map((d) => <Cell key={d.name} fill={lColor(d.risk)} />)}
                </RadialBar>
                <Legend iconSize={8} layout="vertical" verticalAlign="middle" align="right" wrapperStyle={{ fontSize: 9.5, lineHeight: "13px" }} />
                <Tooltip {...tipProps} formatter={(v) => [`${v}% fatal`, ""]} />
              </RadialBarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 5 — Road surface · volume pie coloured by risk */}
        <div className="card">
          <div className="card-head"><span className="card-title">Road surface</span><span className="card-sub">volume · colour = risk · click a slice</span></div>
          <div className="fill">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={surface} dataKey="total" nameKey="key" outerRadius="82%" innerRadius="42%" paddingAngle={2}
                     stroke="#0A0E14" strokeWidth={2}
                     onClick={(d) => toggleFilter("Road_surface_conditions", d.key)} cursor="pointer">
                  {surface.map((d) => <Cell key={d.key} fill={sColor(d.risk)} />)}
                </Pie>
                <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
                <Tooltip {...tipProps} formatter={(v, n, p) => [`${v.toLocaleString()} (risk ${p.payload.risk.toFixed(2)})`, p.payload.key]} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 6 — Driver sex · grouped fatal vs serious */}
        <div className="card">
          <div className="card-head"><span className="card-title">Driver sex</span><span className="card-sub">fatal vs serious rate</span></div>
          <div className="fill">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sex} margin={{ left: 0, right: 8 }} barCategoryGap="22%">
                <XAxis dataKey="key" {...axisProps} />
                <YAxis {...axisProps} unit="%" />
                <Tooltip {...tipProps} formatter={(v, n) => [`${v}%`, n]} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Serious" fill={sevColor("Serious Injury")} radius={[3, 3, 0, 0]}
                     onClick={(d) => toggleFilter("Sex_of_driver", d.key)} cursor="pointer" />
                <Bar dataKey="Fatal" fill={sevColor("Fatal injury")} radius={[3, 3, 0, 0]}
                     onClick={(d) => toggleFilter("Sex_of_driver", d.key)} cursor="pointer" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

function WeatherTip({ active, payload }) {
  if (!active || !payload || !payload.length) return null;
  const d = payload[0].payload;
  return (
    <div style={{ background: "#0A0E14", border: "1px solid #2C3A4A", borderRadius: 8, padding: "8px 11px", fontSize: 12 }}>
      <div style={{ fontWeight: 600, marginBottom: 2 }}>{d.key}</div>
      <div style={{ color: "#8B98A8" }}>{d.x.toLocaleString()} accidents</div>
      <div style={{ color: "#8B98A8" }}>Fatal {d.y}% · risk {d.risk.toFixed(2)}</div>
    </div>
  );
}
