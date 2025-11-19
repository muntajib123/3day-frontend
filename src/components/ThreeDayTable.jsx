import React from "react";

/**
 * Utility: convert a date-like value into 'YYYY-MM-DD' (UTC) string.
 * Accepts Date objects or ISO date strings. Defensive: if invalid, returns the input as-is.
 */
function dateKeyUTC(d) {
  if (!d) return d;
  try {
    const dt = d instanceof Date ? d : new Date(d);
    if (Number.isNaN(dt.getTime())) return d;
    const yyyy = dt.getUTCFullYear();
    const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(dt.getUTCDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  } catch (err) {
    return d;
  }
}

/**
 * Normalize days array into unique calendar-day keys (UTC), preserving original order.
 * Limits result to maxDays (default 3).
 *
 * days: Array of strings/dates/objects — if objects, we try to read `.date` or `.day` fields.
 */
function normalizeDays(days, maxDays = 3) {
  if (!Array.isArray(days)) return [];

  const seen = new Set();
  const out = [];

  for (const d of days) {
    // Accept either a direct string/Date, or an object with common keys.
    let raw = d;
    if (d && typeof d === "object" && !(d instanceof Date)) {
      // prefer common date fields if present
      if (d.date) raw = d.date;
      else if (d.day) raw = d.day;
      else if (d.key) raw = d.key;
      else raw = JSON.stringify(d); // fallback
    }

    const key = dateKeyUTC(raw);
    // ignore invalid conversion
    if (typeof key !== "string") continue;
    if (!seen.has(key)) {
      seen.add(key);
      out.push(key);
      if (out.length >= maxDays) break;
    }
  }

  return out;
}

/**
 * ThreeDayTable
 * - days: array (strings or Date objects) or objects that include a date/day property
 * - kpBreakdown: array of rows where each row has `hourBlock` and day-keyed values (matching the normalized day keys)
 *
 * This component will:
 * - normalize and dedupe days to calendar-day UTC keys
 * - limit to the first 3 unique days (no duplicates / overlap)
 * - render a table using those normalized day keys
 */
export default function ThreeDayTable({ days, kpBreakdown, maxDays = 3 }) {
  if (!days || !days.length || !kpBreakdown || !kpBreakdown.length) return null;

  // Normalize and dedupe days into calendar-only keys (YYYY-MM-DD) using UTC
  const headerDays = normalizeDays(days, maxDays);

  // If normalization produced no usable days, try falling back to the raw days truncated
  if (!headerDays.length) {
    // attempt fallback: stringify items and use as headers
    const fallback = days.slice(0, maxDays).map((d, i) => (typeof d === "object" ? JSON.stringify(d) : String(d)));
    return (
      <div style={{ background: "#fff", borderRadius: 16, padding: 12, boxShadow: "0 2px 10px rgba(0,0,0,0.06)", border: "1px solid #eee" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead>
              <tr>
                <th style={th}>UTC Block</th>
                {fallback.map((d, idx) => <th key={d + idx} style={th}>{d}</th>)}
              </tr>
            </thead>
            <tbody>
              {kpBreakdown.map(row => (
                <tr key={row.hourBlock}>
                  <td style={tdMono}>{row.hourBlock}</td>
                  {fallback.map((_, i) => <td key={i} style={td}>{row[i] ?? "—"}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // Render table using normalized headerDays.
  return (
    <div style={{ background: "#fff", borderRadius: 16, padding: 12, boxShadow: "0 2px 10px rgba(0,0,0,0.06)", border: "1px solid #eee" }}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr>
              <th style={th}>UTC Block</th>
              {headerDays.map(d => <th key={d} style={th}>{d}</th>)}
            </tr>
          </thead>
          <tbody>
            {kpBreakdown.map(row => (
              <tr key={row.hourBlock}>
                <td style={tdMono}>{row.hourBlock}</td>
                {headerDays.map((d) => {
                  // In some datasets the breakdown keys may already be 'YYYY-MM-DD' strings,
                  // in others they might be full ISO strings — we try both.
                  const cell = row[d] ?? row[dateKeyUTC(d)] ?? row[d.replace(/"/g, "")] ?? "—";
                  return <td key={`${row.hourBlock}-${d}`} style={td}>{cell}</td>;
                })}
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
