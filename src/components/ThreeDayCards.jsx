import React from "react";

export default function ThreeDayCards({ summary, meta }) {
  const items = [
    { label: "Greatest Observed Kp (24h)", value: summary?.greatestObservedKp ?? "—" },
    { label: "Greatest Expected Kp (Next 3d)", value: summary?.greatestExpectedKp ?? "—" },
    { label: "Issued", value: meta?.issued ?? "—" },
  ];

  return (
    <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
      {items.map(it => (
        <div key={it.label} style={{
          borderRadius: 16, padding: 16, boxShadow: "0 2px 10px rgba(0,0,0,0.06)",
          background: "#fff", border: "1px solid #eaeaea"
        }}>
          <div style={{ fontSize: 12, opacity: 0.75 }}>{it.label}</div>
          <div style={{ fontSize: 28, fontWeight: 700, marginTop: 6 }}>{it.value}</div>
        </div>
      ))}
    </div>
  );
}
