// src/components/ThreeDayCards.jsx
import React from "react";
import PropTypes from "prop-types";

function fmtNumber(v) {
  if (v === null || v === undefined) return "—";
  if (typeof v === "number") {
    return Number.isInteger(v) ? v.toString() : v.toFixed(2);
  }
  return String(v);
}

function fmtIssued(issued) {
  if (!issued) return "—";
  const dt = new Date(issued);
  if (!isNaN(dt)) return dt.toUTCString();
  return issued;
}

export default function ThreeDayCards({ summary = {}, meta = {}, items = null }) {
  const defaultItems = [
    { label: "Greatest Observed Kp (24h)", value: summary?.greatestObservedKp ?? null },
    { label: "Greatest Expected Kp (Next 3d)", value: summary?.greatestExpectedKp ?? null },
    { label: "Issued", value: meta?.issued ?? null },
  ];

  const used = Array.isArray(items) && items.length ? items : defaultItems;

  return (
    <section
      aria-label="Three day summary cards"
      style={{
        display: "grid",
        gap: 12,
        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
      }}
    >
      {used.map((it) => (
        <div
          key={it.label}
          role="group"
          aria-label={it.label}
          style={{
            borderRadius: 16,
            padding: 16,
            boxShadow: "0 2px 10px rgba(0,0,0,0.06)",
            background: "#fff",
            border: "1px solid #eaeaea",
            minHeight: 76,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          <div style={{ fontSize: 12, opacity: 0.75 }}>{it.label}</div>
          <div style={{ fontSize: 28, fontWeight: 700, marginTop: 6 }}>
            {it.label === "Issued" ? fmtIssued(it.value) : fmtNumber(it.value)}
          </div>
        </div>
      ))}
    </section>
  );
}

ThreeDayCards.propTypes = {
  summary: PropTypes.object,
  meta: PropTypes.object,
  items: PropTypes.arrayOf(
    PropTypes.shape({
      label: PropTypes.string.isRequired,
      value: PropTypes.any,
    })
  ),
};
