import React, { useMemo, useState } from "react";
import { useStore, groupSeverity } from "../data/store.jsx";
import { cividis } from "../theme.js";

// Lightweight deterministic circle-packing relaxation (no extra deps).
function packLayout(nodes, W, H, iters = 220) {
  const cx = W / 2, cy = H / 2;
  const seeded = nodes.map((n, i) => {
    const a = i * 2.399963; // golden angle
    return { ...n, x: cx + Math.cos(a) * (40 + i * 14), y: cy + Math.sin(a) * (30 + i * 11) };
  });
  for (let it = 0; it < iters; it++) {
    // gravity to centre
    for (const n of seeded) { n.x += (cx - n.x) * 0.012; n.y += (cy - n.y) * 0.012; }
    // pairwise repulsion on overlap
    for (let i = 0; i < seeded.length; i++)
      for (let j = i + 1; j < seeded.length; j++) {
        const a = seeded[i], b = seeded[j];
        let dx = b.x - a.x, dy = b.y - a.y;
        let d = Math.hypot(dx, dy) || 0.01;
        const min = a.r + b.r + 6;
        if (d < min) {
          const push = (min - d) / 2;
          dx /= d; dy /= d;
          a.x -= dx * push; a.y -= dy * push;
          b.x += dx * push; b.y += dy * push;
        }
      }
    // keep inside bounds
    for (const n of seeded) {
      n.x = Math.max(n.r + 4, Math.min(W - n.r - 4, n.x));
      n.y = Math.max(n.r + 4, Math.min(H - n.r - 4, n.y));
    }
  }
  return seeded;
}

export default function Geospatial() {
  const { filtered, toggleFilter, isActive } = useStore();
  const [hover, setHover] = useState(null);
  const W = 640, H = 460;

  const areas = useMemo(() => groupSeverity(filtered, "Area_accident_occured", { minCount: 1 }), [filtered]);
  const maxCount = Math.max(1, ...areas.map((a) => a.total));
  const maxRisk = Math.max(0.01, ...areas.map((a) => a.risk));
  const color = cividis(maxRisk);

  const nodes = useMemo(() => {
    const sized = areas.map((a) => ({
      ...a, r: 16 + 52 * Math.sqrt(a.total / maxCount),
    }));
    return packLayout(sized, W, H);
  }, [areas, maxCount]);

  const ranked = [...areas].sort((a, b) => b.risk - a.risk);

  return (
    <div className="view" style={{ gridTemplateRows: "auto 1fr" }}>
      <div className="card flat" style={{ borderColor: "#2C3A4A", background: "#0F151D" }}>
        <span style={{ fontSize: 12, color: "#8B98A8" }}>
          <b style={{ color: "#E6EDF3" }}>Spatial dimension · </b>
          The RTA dataset records <i>where</i> accidents occur as area categories, not GPS coordinates.
          Each bubble is an accident area — <b style={{ color: "#E6EDF3" }}>size</b> = volume,
          <b style={{ color: "#E6EDF3" }}> colour</b> = injury-risk score (serious + 3×fatal rate, cividis CVD-safe).
        </span>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1.5fr 1fr", minHeight: 0 }}>
        <div className="card">
          <div className="card-head">
            <span className="card-title">Crash-density map by area</span>
            <span className="card-sub">click a bubble to drill in</span>
          </div>
          <div className="fill" style={{ position: "relative" }}>
            <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet" style={{ display: "block" }}>
              <defs>
                <radialGradient id="bg" cx="50%" cy="45%" r="70%">
                  <stop offset="0%" stopColor="#13202C" />
                  <stop offset="100%" stopColor="#0C1219" />
                </radialGradient>
              </defs>
              <rect x="0" y="0" width={W} height={H} rx="10" fill="url(#bg)" />
              {nodes.map((n) => {
                const sel = isActive("Area_accident_occured", n.key);
                const dim = Object.keys({}).length; // noop
                return (
                  <g key={n.key} transform={`translate(${n.x},${n.y})`}
                     style={{ cursor: "pointer" }}
                     onClick={() => toggleFilter("Area_accident_occured", n.key)}
                     onMouseEnter={() => setHover(n)} onMouseLeave={() => setHover(null)}>
                    <circle r={n.r} fill={color(n.risk)}
                            stroke={sel ? "#E69F00" : "#0A0E14"} strokeWidth={sel ? 3 : 1.5}
                            opacity={hover && hover.key !== n.key ? 0.55 : 0.92} />
                    {n.r > 30 && (
                      <text textAnchor="middle" dy="-2" fontSize="11" fontWeight="600"
                            fill={n.risk / maxRisk > 0.55 ? "#0A0E14" : "#E6EDF3"} pointerEvents="none">
                        {n.key.length > 14 ? n.key.slice(0, 13) + "…" : n.key}
                      </text>
                    )}
                    {n.r > 30 && (
                      <text textAnchor="middle" dy="13" fontSize="11" fontFamily="JetBrains Mono"
                            fill={n.risk / maxRisk > 0.55 ? "#0A0E14" : "#E6EDF3"} pointerEvents="none">
                        {n.total.toLocaleString()}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
            {hover && (
              <div style={{ position: "absolute", top: 10, right: 10, background: "#0A0E14",
                            border: "1px solid #2C3A4A", borderRadius: 8, padding: "10px 12px", fontSize: 12, maxWidth: 220 }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>{hover.key}</div>
                <div style={{ color: "#8B98A8" }}>{hover.total.toLocaleString()} accidents</div>
                <div style={{ color: "#8B98A8" }}>Fatal: {(hover.fatalRate * 100).toFixed(1)}% · Serious: {(hover.seriousRate * 100).toFixed(1)}%</div>
                <div style={{ color: "#E69F00", fontFamily: "JetBrains Mono" }}>risk {hover.risk.toFixed(3)}</div>
              </div>
            )}
          </div>
          <CividisLegend max={maxRisk} />
        </div>

        <div className="card">
          <div className="card-head">
            <span className="card-title">Area risk ranking</span>
            <span className="card-sub">highest-risk first</span>
          </div>
          <div className="fill" style={{ overflow: "hidden" }}>
          <table className="tbl">
            <thead><tr><th>Area</th><th className="num">N</th><th className="num">Fatal%</th><th className="num">Risk</th></tr></thead>
            <tbody>
              {ranked.map((a) => (
                <tr key={a.key} className={"clickable" + (isActive("Area_accident_occured", a.key) ? " sel" : "")}
                    onClick={() => toggleFilter("Area_accident_occured", a.key)}>
                  <td>{a.key}</td>
                  <td className="num">{a.total.toLocaleString()}</td>
                  <td className="num">{(a.fatalRate * 100).toFixed(1)}</td>
                  <td className="num" style={{ color: color(a.risk), fontWeight: 600 }}>{a.risk.toFixed(3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function CividisLegend({ max }) {
  const scale = cividis(max);
  const stops = Array.from({ length: 24 }, (_, i) => (i / 23) * max);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12, fontSize: 11, color: "#8B98A8" }}>
      <span>low risk</span>
      <div style={{ display: "flex", flex: 1, height: 10, borderRadius: 5, overflow: "hidden" }}>
        {stops.map((s, i) => <div key={i} style={{ flex: 1, background: scale(s) }} />)}
      </div>
      <span>high risk</span>
      <span className="tag">cividis · CVD-safe</span>
    </div>
  );
}
