// src/components/ForecastText.js
import React, { useEffect, useMemo, useState } from "react";
import { fetchPredictions } from "../api";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid, ResponsiveContainer,
} from "recharts";

// ───────── helpers ─────────
function slotLabel(i) {
  const labels = ["00-03UT","03-06UT","06-09UT","09-12UT","12-15UT","15-18UT","18-21UT","21-00UT"];
  return labels[i] || `${i*3}-${i*3+3}UT`;
}
const th = { textAlign: "left", padding: "10px 12px", fontWeight: 700, borderBottom: "1px solid #eee", whiteSpace: "nowrap" };
const td = { padding: "10px 12px", borderBottom: "1px solid #f3f3f3" };
const tdMono = { ...td, fontFamily: "ui-monospace, Menlo, Monaco, Consolas, 'Courier New', monospace" };
const kpColor = (v) => (v >= 7 ? "#dc2626" : v >= 5 ? "#f97316" : v >= 3 ? "#ca8a04" : "#16a34a");

function Card({ title, value, subtitle }) {
  return (
    <div style={{
      border: "1px solid #eaeaea",
      borderRadius: 16,
      padding: 16,
      minWidth: 200,
      boxShadow: "0 2px 10px rgba(0,0,0,0.06)",
      background: "#fff"
    }}>
      <div style={{ fontSize: 12, color: "#666" }}>{title}</div>
      <div style={{ fontSize: 28, fontWeight: 700, marginTop: 6 }}>{value}</div>
      {subtitle ? <div style={{ fontSize: 12, color: "#777", marginTop: 6 }}>{subtitle}</div> : null}
    </div>
  );
}

// ───────── component ─────────
export default function ForecastText() {
  const [predictions, setPredictions] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetchPredictions();
        if (!alive) return;
        const items = Array.isArray(res?.predictions) ? res.predictions : [];
        const normalized = items
          .filter(p => p?.datetime)
          .sort((a,b) => new Date(a.datetime) - new Date(b.datetime))
          .map(p => ({
            ...p,
            kp: Number(p.kp),
            solar_radiation: Number(p.solar_radiation),
            radio_blackout: Number(p.radio_blackout),
          }));
        setPredictions(normalized);
        setMeta(res?.meta || null);
      } catch (e) {
        setErr(e?.message || "Failed to load data");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  // ── build 3-day structures (UTC days x 8 slots) ──
  const { dayLabels, kpBreakdown, dailySolarAvg, dailyRadioAvg } = useMemo(() => {
    if (!predictions.length) return { dayLabels: [], kpBreakdown: [], dailySolarAvg: [], dailyRadioAvg: [] };

    const daysMap = {};
    predictions.forEach(p => {
      const d = new Date(p.datetime);
      const yyyy = d.getUTCFullYear();
      const mm = String(d.getUTCMonth()+1).padStart(2,'0');
      const dd = String(d.getUTCDate()).padStart(2,'0');
      const key = `${yyyy}-${mm}-${dd}`;
      const slot = Math.floor(d.getUTCHours() / 3) % 8;
      if (!daysMap[key]) daysMap[key] = Array.from({length:8}, () => ({ kp:[], solar:[], radio:[] }));
      daysMap[key][slot].kp.push(p.kp);
      daysMap[key][slot].solar.push(p.solar_radiation);
      daysMap[key][slot].radio.push(p.radio_blackout);
    });

    const dayKeys = Object.keys(daysMap).sort().slice(0, 3);
    while (dayKeys.length < 3) {
      const base = dayKeys[dayKeys.length-1] || new Date().toISOString().slice(0,10);
      const dt = new Date(base + "T00:00:00Z");
      dt.setUTCDate(dt.getUTCDate() + 1);
      const nk = dt.toISOString().slice(0,10);
      dayKeys.push(nk);
      daysMap[nk] = Array.from({length:8}, () => ({ kp:[], solar:[], radio:[] }));
    }

    const dayLabels = dayKeys.map(k => {
      const d = new Date(k + "T00:00:00Z");
      return d.toLocaleString("en-GB", { day: "2-digit", month: "short" });
    });

    const kpBreakdown = Array.from({ length: 8 }).map((_, slot) => {
      const row = { hourBlock: slotLabel(slot) };
      dayKeys.forEach((dk, idx) => {
        const vals = daysMap[dk][slot].kp;
        const avg = vals.length ? (vals.reduce((a,b)=>a+b,0)/vals.length) : 0;
        row[dayLabels[idx]] = Number(avg.toFixed(2));
      });
      return row;
    });

    const dailySolarAvg = dayKeys.map((dk, i) => {
      const vals = daysMap[dk].flatMap(s => s.solar);
      const avg = vals.length ? Math.round(vals.reduce((a,b)=>a+b,0)/vals.length) : 0;
      return { day: dayLabels[i], solar: avg };
    });
    const dailyRadioAvg = dayKeys.map((dk, i) => {
      const vals = daysMap[dk].flatMap(s => s.radio);
      const avg = vals.length ? Math.round(vals.reduce((a,b)=>a+b,0)/vals.length) : 0;
      return { day: dayLabels[i], radio: avg };
    });

    return { dayLabels, kpBreakdown, dailySolarAvg, dailyRadioAvg };
  }, [predictions]);

  if (loading) return <div style={{ padding: 20 }}>Loading forecast…</div>;
  if (err) return <div style={{ padding: 20, color: "#b42318" }}>Error: {err}</div>;
  if (!predictions.length) return <div style={{ padding: 20 }}>No forecast data available.</div>;

  const first = predictions[0];
  const kps = predictions.map(p => p.kp).filter(Number.isFinite);
  const nextKp = Number.isFinite(first?.kp) ? first.kp.toFixed(2) : "—";
  const maxKp = kps.length ? Math.max(...kps).toFixed(2) : "—";
  const avgKp = kps.length ? (kps.reduce((a,b)=>a+b,0)/kps.length).toFixed(2) : "—";
  const peakSolar = predictions.length ? Math.max(...predictions.map(p => p.solar_radiation)).toFixed(0) + "%" : "—";
  const peakRadio = predictions.length ? Math.max(...predictions.map(p => p.radio_blackout)).toFixed(0) + "%" : "—";

  return (
    <div style={{ padding: 20, fontFamily: "system-ui, Arial, sans-serif" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>NOAA 3-Day (Derived) — Cards, Table & Graphs</h2>
        {meta?.generated_at && (
          <span style={{ fontSize: 12, padding: "4px 8px", borderRadius: 999, background: "#eef6ff", color: "#175cd3" }}>
            Generated: {meta.generated_at}
          </span>
        )}
        {meta?.rows && <span style={{ fontSize: 12, color: "#666" }}>{meta.rows} rows</span>}
      </div>

      {/* KPI Cards */}
      <div style={{
        display: "grid",
        gap: 16,
        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        marginBottom: 20
      }}>
        <Card title="Next Kp (3h)" value={nextKp} subtitle={new Date(first.datetime).toLocaleString([], { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })} />
        <Card title="Max Kp (72h)" value={maxKp} />
        <Card title="Avg Kp (72h)" value={avgKp} />
        <Card title="Peak Solar Radiation" value={peakSolar} />
        <Card title="Peak Radio Blackout" value={peakRadio} />
      </div>

      {/* Kp Chart (lines per day) */}
      <div style={{ height: 340, marginBottom: 20, background: "#fff", border: "1px solid #eee", borderRadius: 16, padding: 12 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={kpBreakdown} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="hourBlock" />
            <YAxis domain={[0, 9]} />
            <Tooltip />
            <Legend />
            {dayLabels.map(d => (
              <Line key={d} type="monotone" dataKey={d} dot={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Kp Table */}
      <h3 style={{ margin: "8px 0" }}>Kp index breakdown</h3>
      <div style={{ background: "#fff", borderRadius: 16, padding: 12, boxShadow: "0 2px 10px rgba(0,0,0,0.06)", border: "1px solid #eee" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead>
              <tr>
                <th style={th}>UTC Block</th>
                {dayLabels.map(d => <th key={d} style={th}>{d}</th>)}
              </tr>
            </thead>
            <tbody>
              {kpBreakdown.map(row => (
                <tr key={row.hourBlock}>
                  <td style={tdMono}>{row.hourBlock}</td>
                  {dayLabels.map(d => (
                    <td key={d} style={{ ...td, fontWeight: 600, color: kpColor(Number(row[d])) }}>
                      {Number(row[d]).toFixed(2)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Daily Solar/Radio Averages (mini badges) */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 14 }}>
        {dailySolarAvg.map((d, i) => (
          <span key={`s-${i}`} style={{ fontSize: 12, background: "#f6f6f6", padding: "6px 10px", borderRadius: 999 }}>
            ☀️ {d.day}: {d.solar}%
          </span>
        ))}
        {dailyRadioAvg.map((d, i) => (
          <span key={`r-${i}`} style={{ fontSize: 12, background: "#f6f6f6", padding: "6px 10px", borderRadius: 999 }}>
            📡 {d.day}: {d.radio}%
          </span>
        ))}
      </div>
    </div>
  );
}
