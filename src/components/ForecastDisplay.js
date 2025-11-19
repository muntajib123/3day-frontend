// src/components/ForecastDisplay.js
import React, { useEffect, useMemo, useRef, useState } from "react";
import { fetchPredictions } from "../api";
import {
  LineChart, Line, XAxis, YAxis,
  Tooltip, Legend, CartesianGrid, ResponsiveContainer
} from "recharts";

/* ---------- small styles (only needed ones kept) ---------- */
const btn = {
  border: "1px solid #d0d5dd",
  padding: "6px 10px",
  borderRadius: 8,
  background: "#fff",
  cursor: "pointer",
  fontSize: 12
};

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
  fontWeight: 600
};

/* ---------- helpers ---------- */
function fmtTime(iso) {
  return new Date(iso).toLocaleString([], {
    hour: "2-digit",
    minute: "2-digit",
    day: "numeric",
    month: "short",
  });
}

function fmtDayUTC(iso) {
  const d = new Date(iso);
  return d.toLocaleString([], { day: "2-digit", month: "short" });
}

const isNum = (v) => typeof v === "number" && Number.isFinite(v);
const fmtMSE = (v) => (isNum(v) ? v.toFixed(4) : "N/A");

function avg(arr) {
  return arr.length ? arr.reduce((a, b) => a + Number(b || 0), 0) / arr.length : 0;
}

function kpToAp(kp) {
  const table = [0, 4, 7, 15, 27, 48, 80, 132, 207, 400];
  if (!isNum(kp) || kp <= 0) return 0;
  if (kp >= 9) return 400;
  const lo = Math.floor(kp);
  const hi = lo + 1;
  const t = kp - lo;
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

/* ---------- SVG export helpers (unchanged, no warnings) ---------- */
function inlineSvgStyles(svg) {
  const important = new Set([
    "fill", "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin",
    "stroke-dasharray", "stroke-opacity", "fill-opacity",
    "font", "font-family", "font-size", "font-weight", "opacity",
    "text-anchor", "dominant-baseline", "shape-rendering"
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
    .sort((a, b) => b.rect.width * b.rect.height - a.rect.width * a.rect.height)
    .map(x => x.el)[0];

  if (bigSurface) return bigSurface;

  const svgs = Array.from(containerEl.querySelectorAll("svg"))
    .map(s => ({ el: s, rect: s.getBoundingClientRect() }))
    .filter(({ rect }) => rect.width > 150 && rect.height > 100)
    .sort((a, b) => b.rect.width * b.rect.height - a.rect.width * a.rect.height);

  return svgs[0]?.el || null;
}

function cloneChartSvg(containerEl) {
  const svg = pickMainSurface(containerEl);
  if (!svg) return null;

  const clone = svg.cloneNode(true);
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");

  const rect = svg.getBoundingClientRect();
  let w = Number(svg.getAttribute("width")) || rect.width;
  let h = Number(svg.getAttribute("height")) || rect.height;

  clone.setAttribute("width", w);
  clone.setAttribute("height", h);
  clone.setAttribute("viewBox", `0 0 ${w} ${h}`);

  inlineSvgStyles(clone);

  return { clone, w, h };
}

function downloadBlob(dataUrl, filename) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  a.click();
}

async function downloadSvg(containerEl, filename) {
  const res = cloneChartSvg(containerEl);
  if (!res) return;
  const xml = new XMLSerializer().serializeToString(res.clone);
  const url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(xml);
  downloadBlob(url, filename);
}

async function exportSvgToPng(containerEl, filename, scale = 2) {
  const res = cloneChartSvg(containerEl);
  if (!res) return;

  const img = new Image();
  img.src = "data:image/svg+xml," + encodeURIComponent(new XMLSerializer().serializeToString(res.clone));

  await new Promise((resolve) => (img.onload = resolve));

  const canvas = document.createElement("canvas");
  canvas.width = res.w * scale;
  canvas.height = res.h * scale;

  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  downloadBlob(canvas.toDataURL("image/png"), filename);
}

async function exportChartToPdf(containerEl, filename, scale = 2) {
  const res = cloneChartSvg(containerEl);
  if (!res) return;

  const img = new Image();
  img.src = "data:image/svg+xml," + encodeURIComponent(new XMLSerializer().serializeToString(res.clone));

  await new Promise((resolve) => (img.onload = resolve));

  const canvas = document.createElement("canvas");
  canvas.width = res.w * scale;
  canvas.height = res.h * scale;

  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const png = canvas.toDataURL("image/png");

  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });

  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const ratio = Math.min(pageW / canvas.width, pageH / canvas.height);

  pdf.addImage(png, "PNG", (pageW - canvas.width * ratio) / 2, (pageH - canvas.height * ratio) / 2, canvas.width * ratio, canvas.height * ratio);
  pdf.save(filename);
}

/* ---------- Reusable chart component ---------- */
function ChartSection({ title, data, yDomain, yLabel, dataKey, color, containerRef, onSvg, onPng, onPdf }) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #eee",
        borderRadius: 12,
        padding: 12,
        marginBottom: 18,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", marginBottom: 6 }}>
        <h3 style={{ fontSize: 16, margin: 0 }}>{title}</h3>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button style={btn} onClick={onSvg}>SVG</button>
          <button style={btn} onClick={onPng}>PNG</button>
          <button style={btn} onClick={onPdf}>PDF</button>
        </div>
      </div>

      <div ref={containerRef} style={{ width: "100%", height: 280 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="time" tick={{ fontSize: 11 }} />
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

/* ---------- MAIN COMPONENT ---------- */
export default function ForecastDisplay() {
  const [predictions, setPredictions] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);

  const refKp = useRef(null);
  const refRadio = useRef(null);
  const refSolar = useRef(null);

  useEffect(() => {
    async function load() {
      const res = await fetchPredictions();
      if (res?.predictions) {
        const norm = res.predictions.map((p) => ({
          ...p,
          datetime: new Date(p.datetime).toLocaleString(),
          _t: p.datetime,
        }));
        setPredictions(norm);
        setMeta(res.meta || null);
      }
      setLoading(false);
    }
    load();
  }, []);

  /* -------- derive values (hooks at top, not conditional!) -------- */
  const dayBuckets = useMemo(() => {
    const m = new Map();
    predictions.forEach((p) => {
      const d = new Date(p._t);
      const k = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(
        d.getUTCDate()
      ).padStart(2, "0")}`;
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(p);
    });
    return m;
  }, [predictions]);

  const dayCards = useMemo(() => {
    const keys = [...dayBuckets.keys()].sort().slice(0, 3);
    return keys.map((key) => {
      const items = dayBuckets.get(key) || [];
      const avgKp = avg(items.map((x) => Number(x.kp || 0)));
      return {
        dayLabel: fmtDayUTC(key + "T00:00:00Z"),
        kp: avgKp.toFixed(2),
        ap: kpToAp(avgKp),
        solar: Math.round(avg(items.map((x) => Number(x.solar_radiation || 0)))),
        radio: Math.round(avg(items.map((x) => Number(x.radio_blackout || 0)))),
      };
    });
  }, [dayBuckets]);

  const series = useMemo(
    () =>
      predictions.map((p) => ({
        time: fmtTime(p._t),
        kp: Number(p.kp),
        solar: Number(p.solar_radiation),
        radio: Number(p.radio_blackout),
      })),
    [predictions]
  );

  /* ---------- render ---------- */
  if (loading) return <div style={{ padding: 20 }}>Loading forecasts…</div>;
  if (!predictions.length) return <div style={{ padding: 20 }}>No forecast data.</div>;

  return (
    <div style={{ padding: 20 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <h2 style={{ margin: 0 }}>🌌 3-Day Space Weather Forecast</h2>

        <span style={chip}>
          MSE: {fmtMSE(meta?.mse?.overall)}
        </span>
      </div>

      {/* day cards */}
      <div
        style={{
          display: "grid",
          gap: 16,
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          marginBottom: 22
        }}
      >
        {dayCards.map((c, i) => (
          <div
            key={i}
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              padding: 16,
              background: "#fff",
              boxShadow: "0 2px 8px rgba(0,0,0,0.06)"
            }}
          >
            <div style={{ fontSize: 12, color: "#667085" }}>Forecast — {c.dayLabel}</div>
            <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "repeat(2,1fr)" }}>
              <div>
                <div style={{ fontSize: 11, color: "#6b7280" }}>Kp (avg)</div>
                <div style={{ fontSize: 22, fontWeight: 700 }}>{c.kp}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "#6b7280" }}>Ap (≈)</div>
                <div style={{ fontSize: 22, fontWeight: 700 }}>{c.ap}</div>
              </div>
              <div>
                <div style={{ fontSize: 11 }}>Solar</div>
                <div style={{ fontSize: 22, fontWeight: 700 }}>{c.solar}%</div>
              </div>
              <div>
                <div style={{ fontSize: 11 }}>Radio</div>
                <div style={{ fontSize: 22, fontWeight: 700 }}>{c.radio}%</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* intensity cards */}
      <div
        style={{
          display: "grid",
          gap: 16,
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          marginBottom: 24
        }}
      >
        {dayCards.map((c, i) => (
          <div
            key={i}
            style={{
              padding: 20,
              borderRadius: 16,
              color: "#fff",
              background: dailyKpColor(c.kp),
              textAlign: "center"
            }}
          >
            <div style={{ fontSize: 14 }}>Day {i + 1} — {c.dayLabel}</div>
            <div style={{ fontSize: 36, fontWeight: 700 }}>{c.kp}</div>
            <div style={{ fontSize: 13 }}>Avg Kp Index</div>
          </div>
        ))}
      </div>

      {/* charts */}
      <ChartSection
        title="Kp Index"
        data={series}
        yDomain={[0, 9]}
        yLabel="Kp"
        dataKey="kp"
        color="#1f77b4"
        containerRef={refKp}
        onSvg={() => downloadSvg(refKp.current, "kp.svg")}
        onPng={() => exportSvgToPng(refKp.current, "kp.png")}
        onPdf={() => exportChartToPdf(refKp.current, "kp.pdf")}
      />

      <ChartSection
        title="Solar Radiation (%)"
        data={series}
        yDomain={[0, 100]}
        yLabel="%"
        dataKey="solar"
        color="#2ca02c"
        containerRef={refSolar}
        onSvg={() => downloadSvg(refSolar.current, "solar.svg")}
        onPng={() => exportSvgToPng(refSolar.current, "solar.png")}
        onPdf={() => exportChartToPdf(refSolar.current, "solar.pdf")}
      />

      <ChartSection
        title="Radio Blackout (%)"
        data={series}
        yDomain={[0, 100]}
        yLabel="%"
        dataKey="radio"
        color="#d62728"
        containerRef={refRadio}
        onSvg={() => downloadSvg(refRadio.current, "radio.svg")}
        onPng={() => exportSvgToPng(refRadio.current, "radio.png")}
        onPdf={() => exportChartToPdf(refRadio.current, "radio.pdf")}
      />

      {/* metadata */}
      {meta && (
        <div style={{ marginTop: 12, color: "#555" }}>
          Generated at: {meta.generated_at || meta.file_mtime} • rows: {meta.rows}
        </div>
      )}
    </div>
  );
}
