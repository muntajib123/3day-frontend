// src/components/HistoricalCardsWrapper.jsx
import React, { useEffect, useState } from "react";
import ThreeDayCards from "./ThreeDayCards";

export default function HistoricalCardsWrapper() {
  const [meta, setMeta] = useState({});
  const [summary, setSummary] = useState({});

  useEffect(() => {
    fetch("/historical_3day_clean.json")
      .then((r) => {
        if (!r.ok) throw new Error("Could not fetch historical JSON");
        return r.json();
      })
      .then((json) => {
        const days = Array.isArray(json.days) ? json.days : [];
        const kpValues = days
          .map((d) => (d.kp_avg != null ? Number(d.kp_avg) : null))
          .filter((v) => v != null);
        const greatestObservedKp = kpValues.length ? Math.max(...kpValues) : null;
        setSummary({
          greatestObservedKp,
          greatestExpectedKp: null,
        });
        setMeta({
          issued: json.source_file || null,
          rangeStart: days[0] ? days[0].date : null,
          rangeEnd: days[days.length - 1] ? days[days.length - 1].date : null,
        });
      })
      .catch((err) => {
        console.error("HistoricalCardsWrapper fetch error:", err);
      });
  }, []);

  return (
    <div style={{ padding: 12 }}>
      <ThreeDayCards summary={summary} meta={meta} />
    </div>
  );
}
