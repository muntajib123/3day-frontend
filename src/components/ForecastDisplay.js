// src/components/ForecastDisplay.js
import React, { useEffect, useMemo, useRef, useState } from "react";
import { fetchPredictions } from "../api";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid, ResponsiveContainer
} from "recharts";

/* Optional (for true PDFs instead of print fallback):
   npm i jspdf
*/

// ---------- small styles ----------
const th = { textAlign: "left", padding: "10px 12px", fontSize: 13, color: "#444" };
const td = { padding: "10px 12px", fontSize: 13, color: "#222" };
const btn = { border: "1px solid #d0d5dd", padding: "6px 10px", borderRadius: 8, background: "#fff", cursor: "pointer", fontSize: 12 };
const chip = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "2px 8px",
  borderRadius: 999,
  border: "1px solid #c7d2fe",
  background: "#eef2ff",
  color: "#3730a3",
  fontSize: 12,
  fontWeight: 600,
};

// ---------- helpers ----------
function fmtTime(iso) {
  return new Date(iso).toLocaleString([], { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" });
}
function fmtDayUTC(iso) {
  const d = new Date(iso);
  return d.toLocaleString([], { day: "2-digit", month: "short" });
}
function avg(arr) { return arr.length ? arr.reduce((a,b)=>a+Number(b||0),0)/arr.length : 0; }
function kpToAp(kp) {
  const table = [0, 4, 7, 15, 27, 48, 80, 132, 207, 400]; // Kp 0..9
  if (!isFinite(kp) || kp <= 0) return 0;
  if (kp >= 9) return 400;
  const lo = Math.floor(kp), hi = lo + 1, t = kp - lo;
  return Math.round(table[lo] + (table[hi] - table[lo]) * t);
}
function dailyKpColor(kp) {
  const v = Number(kp);
  if (v >= 7) return "#b91c1c";
  if (v >= 5) return "#f97316";
  if (v >= 4) return "#facc15";
  if (v >= 3) return "#22c55e";
  return "#3b82f6";
}
const isNum = (v) => typeof v === "number" && Number.isFinite(v);
const fmtMSE = (v) => isNum(v) ? v.toFixed(4) : "N/A";

/* ---------- EXPORT HELPERS (robust) ---------- */
function inlineSvgStyles(svg) {
  const important = new Set([
    "fill","stroke","stroke-width","stroke-linecap","stroke-linejoin",
    "stroke-dasharray","stroke-opacity","fill-opacity",
    "font","font-family","font-size","font-weight","opacity",
    "text-anchor","dominant-baseline","shape-rendering"
  ]);
  const walker = document.createTreeWalker(svg, NodeFilter.SHOW_ELEMENT, null, false);
  while (walker.nextNode()) {
    const el = walker.currentNode;
    const cs = window.getComputedStyle(el);
    let style = el.getAttribute("style") || "";
    important.forEach(k => {
      const v = cs.getPropertyValue(k);
      if (v) style += `${k}:${v};`;
    });
    if (style) el.setAttribute("style", style);
  }
}

function pickMainSurface(containerEl) {
  if (!containerEl) return null;
  const surfaces = Array.from(containerEl.querySelectorAll("svg.recharts-surface"));
  const bigSurface = surfaces
    .map(s => ({ el: s, rect: s.getBoundingClientRect() }))
    .filter(({ rect }) => rect.width > 150 && rect.height > 100)
    .sort((a, b) => (b.rect.width * b.rect.height) - (a.rect.width * a.rect.height))
    .map(x => x.el)[0];

  if (bigSurface) return bigSurface;

  const svgs = Array.from(containerEl.querySelectorAll("svg"))
    .map(s => ({ el: s, rect: s.getBoundingClientRect() }))
    .filter(({ rect }) => rect.width > 150 && rect.height > 100)
    .sort((a, b) => (b.rect.width * b.rect.height) - (a.rect.width * a.rect.height));
  return svgs[0]?.el || null;
}

function cloneChartSvg(containerEl) {
  const svg = pickMainSurface(containerEl);
  if (!svg) return null;

  const clone = svg.cloneNode(true);
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");

  const rect = svg.getBoundingClientRect();
  let w = Number(svg.getAttribute("width")) || 0;
  let h = Number(svg.getAttribute("height")) || 0;
  if (!w || !h) {
    w = Math.max(1, Math.round(rect.width));
    h = Math.max(1, Math.round(rect.height));
  }
  const vb = svg.getAttribute("viewBox");
  if (vb) {
    const parts = vb.split(/\s+/).map(Number);
    if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
      w = parts[2]; h = parts[3];
    }
  }
  clone.setAttribute("width", String(w));
  clone.setAttribute("height", String(h));
  if (!clone.getAttribute("viewBox")) clone.setAttribute("viewBox", `0 0 ${w} ${h}`);

  inlineSvgStyles(clone);
  return { clone, w, h };
}

function downloadBlob(dataUrl, filename) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

async function downloadSvg(containerEl, filename = "chart.svg") {
  const res = cloneChartSvg(containerEl);
  if (!res) return;
  const { clone } = res;
  const xml = new XMLSerializer().serializeToString(clone);
  const url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(xml);
  downloadBlob(url, filename);
}

async function exportSvgToPng(containerEl, filename = "chart.png", scale = 2) {
  const res = cloneChartSvg(containerEl);
  if (!res) return;
  const { clone, w, h } = res;
  const xml = new XMLSerializer().serializeToString(clone);
  const url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(xml);

  const img = new Image();
  img.decoding = "sync";
  img.src = url;
  await new Promise(r => { img.onload = r; });

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const png = canvas.toDataURL("image/png");
  downloadBlob(png, filename);
}

async function exportChartToPdf(containerEl, filename = "chart.pdf", scale = 2) {
  const res = cloneChartSvg(containerEl);
  if (!res) return;
  const { clone, w, h } = res;
  const xml = new XMLSerializer().serializeToString(clone);
  const url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(xml);

  const img = new Image();
  img.decoding = "sync";
  img.src = url;
  await new Promise(r => { img.onload = r; });

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const pngDataUrl = canvas.toDataURL("image/png");

  try {
    const { jsPDF } = await import("jspdf");
    const pdf = new jsPDF({ orientation: w >= h ? "landscape" : "portrait", unit: "pt", format: "a4" });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const ratio = Math.min(pageW / canvas.width, pageH / canvas.height);
    const imgW = canvas.width * ratio;
    const imgH = canvas.height * ratio;
    const x = (pageW - imgW) / 2;
    const y = (pageH - imgH) / 2;
    pdf.addImage(pngDataUrl, "PNG", x, y, imgW, imgH);
    pdf.save(filename);
  } catch {
    const html = `
      <html><head><title>${filename}</title></head>
      <body style="margin:0;display:flex;align-items:center;justify-content:center;background:#fff;">
        <img src="${pngDataUrl}" style="max-width:100%;max-height:100vh"/>
        <script>window.onload=() => window.print();</script>
      </body></html>`;
    const win = window.open("", "_blank");
    if (win) { win.document.write(html); win.document.close(); }
  }
}

// Reusable chart section
function ChartSection({ title, data, yDomain, yLabel, dataKey, color, containerRef, onSvg, onPng, onPdf }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #eee", borderRadius: 12, padding: 12, marginBottom: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <h3 style={{ margin: 0, fontSize: 16 }}>{title}</h3>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button onClick={onSvg} style={btn}>SVG</button>
          <button onClick={onPng} style={btn}>PNG</button>
          <button onClick={onPdf} style={btn}>PDF</button>
        </div>
      </div>
      <div ref={containerRef} style={{ width: "100%", height: 280 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 30, left: 5, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="time" tick={{ fontSize: 11 }} interval={Math.max(0, Math.floor((data?.length || 1) / 8))} />
            <YAxis domain={yDomain} label={{ value: yLabel, angle: -90, position: "insideLeft" }} />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey={dataKey} stroke={color} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ---------- main component ----------
export default function ForecastDisplay() {
  const [predictions, setPredictions] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const res = await fetchPredictions();
      if (res && res.predictions) {
        const normalized = res.predictions.map(p => ({
          ...p,
          datetime: new Date(p.datetime).toLocaleString(),
          _t: p.datetime,
        }));
        setPredictions(normalized);
        setMeta(res.meta || null);
      }
      setLoading(false);
    }
    load();
  }, []);

  // -------- derive BEFORE early returns --------
  const dayBuckets = useMemo(() => {
    const m = new Map();
    predictions.forEach(p => {
      const d = new Date(p._t);
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,"0")}-${String(d.getUTCDate()).padStart(2,"0")}`;
      if (!m.has(key)) m.set(key, []);
      m.get(key).push(p);
    });
    return m;
  }, [predictions]);

  const dayCards = useMemo(() => {
    const keys = Array.from(dayBuckets.keys()).sort().slice(0, 3);
    return keys.map(key => {
      const items = dayBuckets.get(key) || [];
      const avgKp = avg(items.map(x => Number(x.kp || 0)));
      const avgSolar = Math.round(avg(items.map(x => Number(x.solar_radiation || 0))));
      const avgRadio = Math.round(avg(items.map(x => Number(x.radio_blackout || 0))));
      return {
        dayLabel: fmtDayUTC(key + "T00:00:00Z"),
        kp: avgKp.toFixed(2),
        ap: kpToAp(avgKp),
        solar: avgSolar,
        radio: avgRadio,
      };
    });
  }, [dayBuckets]);

  const series = useMemo(() => (
    predictions.map(p => ({
      time: fmtTime(p._t),
      kp: Number(p.kp),
      radio: Number(p.radio_blackout),
      solar: Number(p.solar_radiation),
    }))
  ), [predictions]);

  const refKp = useRef(null);
  const refRadio = useRef(null);
  const refSolar = useRef(null);

  // -------- early returns --------
  if (loading) return <div style={{ padding: 20 }}>Loading forecasts…</div>;
  if (!predictions.length) return <div style={{ padding: 20 }}>No forecast data available.</div>;

  // ---- MSE values from meta (added) ----
  const mseOverall = meta?.mse?.overall;
  const mseKp = meta?.mse?.kp;
  const mseSolar = meta?.mse?.solar_radiation;
  const mseRadio = meta?.mse?.radio_blackout;

  return (
    <div style={{ padding: 20, fontFamily: "system-ui, Arial, sans-serif" }}>
      {/* Header + MSE badge */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <h2 style={{ marginTop: 0, marginBottom: 0 }}>🌌 3-Day Space Weather Forecast</h2>
        <span
          style={chip}
          title={`MSEs — overall: ${fmtMSE(mseOverall)}, Kp: ${fmtMSE(mseKp)}, Solar: ${fmtMSE(mseSolar)}, Radio: ${fmtMSE(mseRadio)}`}
        >
          MSE: {fmtMSE(mseOverall)}
        </span>
      </div>

      {/* Day-wise summary cards */}
      <div style={{
        display: "grid",
        gap: 16,
        gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
        marginBottom: 18
      }}>
        {dayCards.map((c, i) => (
          <div key={i} style={{
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            padding: 16,
            minWidth: 240,
            background: "#fff",
            boxShadow: "0 2px 8px rgba(0,0,0,0.06)"
          }}>
            <div style={{ fontSize: 12, color: "#667085" }}>Forecast — {c.dayLabel}</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 10, marginTop: 8 }}>
              <div><div style={{ fontSize: 11, color: "#6b7280" }}>Kp (avg)</div><div style={{ fontSize: 22, fontWeight: 700 }}>{c.kp}</div></div>
              <div><div style={{ fontSize: 11, color: "#6b7280" }}>Ap (≈)</div><div style={{ fontSize: 22, fontWeight: 700 }}>{c.ap}</div></div>
              <div><div style={{ fontSize: 11, color: "#6b7280" }}>Solar</div><div style={{ fontSize: 22, fontWeight: 700 }}>{c.solar}%</div></div>
              <div><div style={{ fontSize: 11, color: "#6b7280" }}>Radio</div><div style={{ fontSize: 22, fontWeight: 700 }}>{c.radio}%</div></div>
            </div>
          </div>
        ))}
      </div>

      {/* Daily Kp intensity cards */}
      <div style={{
        display: "grid",
        gap: 16,
        gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
        marginBottom: 18
      }}>
        {dayCards.map((c, i) => (
          <div key={`int-${i}`} style={{
            borderRadius: 16,
            padding: 20,
            textAlign: "center",
            color: "#fff",
            background: dailyKpColor(c.kp),
            boxShadow: "0 2px 10px rgba(0,0,0,0.2)"
          }}>
            <div style={{ fontSize: 14, opacity: 0.9 }}>Day {i + 1} — {c.dayLabel}</div>
            <div style={{ fontSize: 36, fontWeight: 700, lineHeight: 1.2 }}>{c.kp}</div>
            <div style={{ fontSize: 13, opacity: 0.85 }}>Avg Kp Index</div>
          </div>
        ))}
      </div>

      {/* Separate charts with SVG/PNG/PDF download */}
      <ChartSection
        title="Kp index"
        data={series}
        yDomain={[0, 9]}
        yLabel="Kp"
        dataKey="kp"
        color="#1f77b4"
        containerRef={refKp}
        onSvg={() => downloadSvg(refKp.current, "kp_chart.svg")}
        onPng={() => exportSvgToPng(refKp.current, "kp_chart.png")}
        onPdf={() => exportChartToPdf(refKp.current, "kp_chart.pdf")}
      />
      <ChartSection
        title="Radio blackout (%)"
        data={series}
        yDomain={[0, 100]}
        yLabel="%"
        dataKey="radio"
        color="#d62728"
        containerRef={refRadio}
        onSvg={() => downloadSvg(refRadio.current, "radio_chart.svg")}
        onPng={() => exportSvgToPng(refRadio.current, "radio_chart.png")}
        onPdf={() => exportChartToPdf(refRadio.current, "radio_chart.pdf")}
      />
      <ChartSection
        title="Solar radiation (%)"
        data={series}
        yDomain={[0, 100]}
        yLabel="%"
        dataKey="solar"
        color="#2ca02c"
        containerRef={refSolar}
        onSvg={() => downloadSvg(refSolar.current, "solar_chart.svg")}
        onPng={() => exportSvgToPng(refSolar.current, "solar_chart.png")}
        onPdf={() => exportChartToPdf(refSolar.current, "solar_chart.pdf")}
      />

      {/* Table */}
      <h3>All 72-hour values</h3>
      <div style={{ overflowX: "auto", border: "1px solid #eee", borderRadius: 8 }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead style={{ background: "#fafafa" }}>
            <tr>
              <th style={th}>datetime</th>
              <th style={th}>kp</th>
              <th style={th}>solar_radiation (%)</th>
              <th style={th}>radio_blackout (%)</th>
            </tr>
          </thead>
          <tbody>
            {predictions.map((p, i) => (
              <tr key={i} style={{ borderTop: "1px solid #f1f1f1" }}>
                <td style={td}>{p.datetime}</td>
                <td style={td}>{Number(p.kp).toFixed(2)}</td>
                <td style={td}>{Number(p.solar_radiation).toFixed(0)}</td>
                <td style={td}>{Number(p.radio_blackout).toFixed(0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {meta && (
        <div style={{ marginTop: 12, color: "#666" }}>
          Generated at: {meta.generated_at || meta.file_mtime} • rows: {meta.rows}
          {meta.metrics_run_id ? (
            <> • metrics run: <code>{meta.metrics_run_id}</code></>
          ) : null}
        </div>
      )}
    </div>
  );
}
