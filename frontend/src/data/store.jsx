import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import { PALETTES, SEVERITY_ORDER } from "../theme.js";

const Ctx = createContext(null);
export const useStore = () => useContext(Ctx);

export function StoreProvider({ children }) {
  const [records, setRecords] = useState(null);
  const [meta, setMeta] = useState(null);
  const [model, setModel] = useState(null);
  const [error, setError] = useState(null);

  const [paletteKey, setPaletteKey] = useState("okabe-ito");
  // filters: { field: [values] } (OR within field, AND across fields)
  const [filters, setFilters] = useState({});
  const [hourRange, setHourRange] = useState(null); // [lo, hi] or null

  useEffect(() => {
    Promise.all([
      fetch("data/records.json").then((r) => r.json()),
      fetch("data/meta.json").then((r) => r.json()),
      fetch("data/model.json").then((r) => r.json()),
    ])
      .then(([rec, m, mo]) => { setRecords(rec); setMeta(m); setModel(mo); })
      .catch((e) => setError(String(e)));
  }, []);

  const palette = PALETTES[paletteKey];
  const sevColor = useCallback((s) => palette.severity[s] || "#888", [palette]);

  const toggleFilter = useCallback((field, value) => {
    setFilters((f) => {
      const cur = f[field] || [];
      const next = cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value];
      const out = { ...f };
      if (next.length) out[field] = next; else delete out[field];
      return out;
    });
  }, []);

  const clearField = useCallback((field) => {
    if (field === "Hour") return setHourRange(null);
    setFilters((f) => { const o = { ...f }; delete o[field]; return o; });
  }, []);

  const setFieldValues = useCallback((field, values) => {
    setFilters((f) => {
      const out = { ...f };
      if (values && values.length) out[field] = values; else delete out[field];
      return out;
    });
  }, []);

  const clearAll = useCallback(() => { setFilters({}); setHourRange(null); }, []);

  const isActive = useCallback((field, value) => (filters[field] || []).includes(value), [filters]);

  // Apply cross-filters
  const filtered = useMemo(() => {
    if (!records) return [];
    const fkeys = Object.keys(filters);
    if (!fkeys.length && !hourRange) return records;
    return records.filter((r) => {
      for (const k of fkeys) if (!filters[k].includes(String(r[k]))) return false;
      if (hourRange && (r.Hour < hourRange[0] || r.Hour > hourRange[1])) return false;
      return true;
    });
  }, [records, filters, hourRange]);

  const activeChips = useMemo(() => {
    const chips = [];
    for (const [k, vals] of Object.entries(filters))
      for (const v of vals) chips.push({ field: k, value: v });
    if (hourRange) chips.push({ field: "Hour", value: `${hourRange[0]}:00–${hourRange[1]}:59` });
    return chips;
  }, [filters, hourRange]);

  const value = {
    records, meta, model, error, filtered,
    palette, paletteKey, setPaletteKey, sevColor, SEVERITY_ORDER,
    filters, hourRange, setHourRange, toggleFilter, clearField, clearAll, isActive, setFieldValues,
    activeChips,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

// ---- shared aggregation helpers (client-side, over the filtered set) ----

export function severityBreakdown(rows) {
  const out = { "Slight Injury": 0, "Serious Injury": 0, "Fatal injury": 0 };
  for (const r of rows) out[r.Accident_severity] = (out[r.Accident_severity] || 0) + 1;
  return out;
}

// group rows by a field -> [{ key, total, Slight Injury, Serious Injury, Fatal injury, fatalRate, risk }]
export function groupSeverity(rows, field, { minCount = 0 } = {}) {
  const map = new Map();
  for (const r of rows) {
    const k = String(r[field]);
    if (!map.has(k)) map.set(k, { key: k, total: 0, "Slight Injury": 0, "Serious Injury": 0, "Fatal injury": 0 });
    const o = map.get(k);
    o.total += 1; o[r.Accident_severity] += 1;
  }
  return [...map.values()]
    .filter((o) => o.total >= minCount)
    .map((o) => ({
      ...o,
      fatalRate: o.total ? o["Fatal injury"] / o.total : 0,
      seriousRate: o.total ? o["Serious Injury"] / o.total : 0,
      risk: o.total ? (o["Serious Injury"] + 3 * o["Fatal injury"]) / o.total : 0,
    }));
}
