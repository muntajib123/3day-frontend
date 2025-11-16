// src/components/PastTab.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  IconButton,
  Stack,
} from "@mui/material";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { DateCalendar } from "@mui/x-date-pickers/DateCalendar";
import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos";

const API_BASE = process.env.REACT_APP_API_BASE || "http://127.0.0.1:8000";

const dayKeyUTC = (d) =>
  new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
    .toISOString()
    .slice(0, 10);

const rowDayKeyUTC = (iso) => iso.slice(0, 10);

const toUTCDateOnly = (d) =>
  new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

const fmtUTC = (isoOrDate) => {
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${y}-${m}-${day} ${hh}:${mm} UTC`;
};

async function fetchMonth(year, month1to12) {
  const mm = String(month1to12).padStart(2, "0");
  const url = `${API_BASE}/api/obs/history?year=${year}&month=${mm}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  const json = await res.json();
  const arr = Array.isArray(json?.data) ? json.data : [];
  return arr
    .filter((r) => r?.datetime)
    .map((r) => ({
      time_utc: r.datetime,
      kp: r.kp ?? null,
      solar_pct: r.solar_radiation ?? null,
      radio_pct: r.radio_blackout ?? null,
    }));
}

export default function PastTab() {
  const [viewMonth, setViewMonth] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const bootstrappedRef = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const now = new Date();
        for (let i = 0; i < 24; i++) {
          const probe = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
          const rows = await fetchMonth(probe.getUTCFullYear(), probe.getUTCMonth() + 1);
          if (rows.length > 0) {
            setViewMonth(probe);
            setHistory(rows);
            const days = rows.map((r) => rowDayKeyUTC(r.time_utc)).sort();
            const latest = days[days.length - 1];
            const [yy, mm, dd] = latest.split("-").map((n) => parseInt(n, 10));
            setSelectedDate(new Date(Date.UTC(yy, mm - 1, dd)));
            bootstrappedRef.current = true;
            return;
          }
        }
        setError("No historical data found.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!bootstrappedRef.current || !viewMonth) return;
    (async () => {
      try {
        setLoading(true);
        const rows = await fetchMonth(viewMonth.getUTCFullYear(), viewMonth.getUTCMonth() + 1);
        setHistory(rows);
        if (rows.length) {
          const days = rows.map((r) => rowDayKeyUTC(r.time_utc));
          const selectedKey = selectedDate ? dayKeyUTC(selectedDate) : null;
          if (!selectedKey || !days.includes(selectedKey)) {
            const sorted = [...new Set(days)].sort();
            const latest = sorted[sorted.length - 1];
            const [yy, mm, dd] = latest.split("-").map((n) => parseInt(n, 10));
            setSelectedDate(new Date(Date.UTC(yy, mm - 1, dd)));
          }
        } else {
          setSelectedDate(null);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [viewMonth]);

  const { byDay, daySet } = useMemo(() => {
    const map = new Map();
    for (const r of history) {
      const k = rowDayKeyUTC(r.time_utc);
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(r);
    }
    return { byDay: map, daySet: new Set(map.keys()) };
  }, [history]);

  const selectedKey = selectedDate ? dayKeyUTC(selectedDate) : null;
  const rowsForDay = selectedKey && byDay.has(selectedKey) ? byDay.get(selectedKey) : [];

  const shouldDisableDate = (date) => !daySet.has(dayKeyUTC(date));

  const goMonth = (delta) => {
    if (!viewMonth) return;
    setViewMonth(new Date(Date.UTC(viewMonth.getUTCFullYear(), viewMonth.getUTCMonth() + delta, 1)));
    bootstrappedRef.current = true;
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box display="grid" gridTemplateColumns={{ xs: "1fr", md: "360px 1fr" }} gap={2}>
        {/* Calendar */}
        <Card elevation={3} sx={{ borderRadius: 3 }}>
          <CardContent>
            <Stack direction="row" alignItems="center" justifyContent="flex-end" mb={1}>
              <IconButton size="small" aria-label="Previous month" onClick={() => goMonth(-1)}>
                <ArrowBackIosNewIcon fontSize="small" />
              </IconButton>
              <IconButton size="small" aria-label="Next month" onClick={() => goMonth(1)}>
                <ArrowForwardIosIcon fontSize="small" />
              </IconButton>
            </Stack>

            <DateCalendar
              value={selectedDate ? toUTCDateOnly(selectedDate) : null}
              onChange={(newValue) => {
                if (!newValue) return setSelectedDate(null);
                const d = new Date(
                  Date.UTC(newValue.getFullYear(), newValue.getMonth(), newValue.getDate())
                );
                setSelectedDate(d);
              }}
              onMonthChange={(monthDate) => {
                setViewMonth(new Date(Date.UTC(monthDate.getFullYear(), monthDate.getMonth(), 1)));
                bootstrappedRef.current = true;
              }}
              shouldDisableDate={shouldDisableDate}
              referenceDate={viewMonth || undefined}
            />
          </CardContent>
        </Card>

        {/* Table */}
        <Box display="grid" gap={2}>
          <Card elevation={3} sx={{ borderRadius: 3 }}>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                {loading ? "Loading…" : error ? "Error" : `Rows for ${selectedKey ?? "—"}`}
              </Typography>
              {error && (
                <Typography color="error" sx={{ mt: 1, whiteSpace: "pre-wrap" }}>
                  {error}
                </Typography>
              )}
              {rowsForDay.length > 0 && (
                <Box component="table" sx={{ width: "100%", mt: 1, borderCollapse: "collapse" }}>
                  <Box component="thead">
                    <Box component="tr" sx={{ borderBottom: "1px solid rgba(255,255,255,0.12)" }}>
                      <Box component="th" sx={{ textAlign: "left", p: 1 }}>
                        Date/Time (UTC)
                      </Box>
                      <Box component="th" sx={{ textAlign: "right", p: 1 }}>
                        Kp
                      </Box>
                      <Box component="th" sx={{ textAlign: "right", p: 1 }}>
                        Solar (%)
                      </Box>
                      <Box component="th" sx={{ textAlign: "right", p: 1 }}>
                        Radio (%)
                      </Box>
                    </Box>
                  </Box>
                  <Box component="tbody">
                    {rowsForDay.map((r, i) => (
                      <Box
                        component="tr"
                        key={i}
                        sx={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}
                      >
                        <Box component="td" sx={{ p: 1, whiteSpace: "nowrap" }}>
                          {fmtUTC(r.time_utc)}
                        </Box>
                        <Box component="td" sx={{ p: 1, textAlign: "right" }}>
                          {r.kp ?? "-"}
                        </Box>
                        <Box component="td" sx={{ p: 1, textAlign: "right" }}>
                          {r.solar_pct ?? "-"}
                        </Box>
                        <Box component="td" sx={{ p: 1, textAlign: "right" }}>
                          {r.radio_pct ?? "-"}
                        </Box>
                      </Box>
                    ))}
                  </Box>
                </Box>
              )}
            </CardContent>
          </Card>
        </Box>
      </Box>
    </LocalizationProvider>
  );
}
