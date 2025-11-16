import React from "react";

export default function ThreeDayTable({ days, kpBreakdown }) {
  if (!days?.length || !kpBreakdown?.length) return null;

  return (
    <div style={{ background: "#fff", borderRadius: 16, padding: 12, boxShadow: "0 2px 10px rgba(0,0,0,0.06)", border: "1px solid #eee" }}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr>
              <th style={th}>UTC Block</th>
              {days.map(d => <th key={d} style={th}>{d}</th>)}
            </tr>
          </thead>
          <tbody>
            {kpBreakdown.map(row => (
              <tr key={row.hourBlock}>
                <td style={tdMono}>{row.hourBlock}</td>
                {days.map(d => <td key={d} style={td}>{row[d] ?? "—"}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const th = { textAlign: "left", padding: "10px 12px", fontWeight: 700, borderBottom: "1px solid #eee", whiteSpace: "nowrap" };
const td = { padding: "10px 12px", borderBottom: "1px solid #f3f3f3" };
const tdMono = { ...td, fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace" };
