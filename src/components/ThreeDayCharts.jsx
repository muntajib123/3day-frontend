import React from "react";
import { LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from "recharts";

// kpBreakdown: [{ hourBlock: "00-03", "Oct 20": 3.0, "Oct 21": 2.67, ...}, ...]
export default function ThreeDayCharts({ days, kpBreakdown }) {
  if (!days?.length || !kpBreakdown?.length) return null;
  return (
    <div style={{ background: "#fff", borderRadius: 16, padding: 12, boxShadow: "0 2px 10px rgba(0,0,0,0.06)", border: "1px solid #eee", height: 340 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={kpBreakdown} margin={{ top: 10, right: 30, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="hourBlock" />
          <YAxis domain={[0, 9]} />
          <Tooltip />
          <Legend />
          {days.map(d => (
            <Line key={d} type="monotone" dataKey={d} dot={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
