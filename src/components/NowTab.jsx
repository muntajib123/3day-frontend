// src/components/NowTab.jsx
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  Box, Card, CardContent, Typography, IconButton, Chip,
  Stack, Divider, Tooltip, CircularProgress
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import {
  LineChart, Line, XAxis, YAxis, Tooltip as RcTooltip, Legend, CartesianGrid, ResponsiveContainer,
} from "recharts";

import { parseNoaa3Day, parseNoaaProbabilities } from "../utils/noaa3dayParser";

// ✅ proxied URL (via src/setupProxy.js)
const NOAA_3DAY_URL = "/noaa/text/3-day-forecast.txt";

const fmtTime = (iso) =>
  new Date(iso).toLocaleString([], { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" });
const fmtDayUTC = (iso) => new Date(iso).toLocaleString([], { day: "2-digit", month: "short" });
const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + Number(b || 0), 0) / arr.length : 0);
const fmtKp = (n) => (Number.isFinite(n) ? n.toFixed(2) : "—");

function kpToAp(kp) {
  const table = [0, 4, 7, 15, 27, 48, 80, 132, 207, 400];
  if (!isFinite(kp) || kp <= 0) return 0;
  if (kp >= 9) return 400;
  const lo = Math.floor(kp), hi = lo + 1, t = kp - lo;
  return Math.round(table[lo] + (table[hi] - table[lo]) * t);
}

export default function NowTab() {
  const [daysISO, setDaysISO] = useState([]);
  const [kpSeries, setKpSeries] = useState([]);
  const [solarByDay, setSolarByDay] = useState(new Map());
  const [radioByDay, setRadioByDay] = useState(new Map());
  const [issued, setIssued] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      // 🔹 Fetch the SINGLE main bulletin
      const txt = await fetch(NOAA_3DAY_URL).then((r) => {
        if (!r.ok) throw new Error("NOAA 3-day fetch failed");
        return r.text();
      });

      // 🔹 Parse Kp/Ap
      const kpParsed = parseNoaa3Day(txt);
      const kpSer = (kpParsed.kpSeries || []).sort((a, b) => Date.parse(a.iso) - Date.parse(b.iso));
      setDaysISO(kpParsed.daysISO || []);
      setKpSeries(kpSer);
      setIssued(kpParsed?.meta?.issued || "");

      // 🔹 Parse Solar/Radio from the SAME file
      const fallbackYear =
        (kpParsed?.meta?.issued && (kpParsed.meta.issued.match(/(\d{4})/) || [])[1]) ||
        new Date().getUTCFullYear();

      const prob = parseNoaaProbabilities(txt, fallbackYear, kpParsed.daysISO);
      setSolarByDay(prob.solarByDay || new Map());
      setRadioByDay(prob.radioByDay || new Map());
    } catch (e) {
      console.error(e);
      setErr("Failed to load NOAA live 3-day forecast.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ---- Cards (Kp avg + Ap + Solar/Radio)
  const dayCards = useMemo(() => {
    if (!daysISO.length) return [];
    const byDayKp = new Map(daysISO.map((d) => [d, []]));
    kpSeries.forEach((pt) => {
      const d = new Date(pt.iso);
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(
        d.getUTCDate()
      ).padStart(2, "0")}`;
      if (byDayKp.has(key)) byDayKp.get(key).push(pt.kp);
    });

    return daysISO.map((dayIso) => {
      const kps = byDayKp.get(dayIso) || [];
      const kpAvg = avg(kps);
      const ap = kpToAp(kpAvg);
      const solar = solarByDay.has(dayIso) ? solarByDay.get(dayIso) : null;
      const radio = radioByDay.has(dayIso) ? radioByDay.get(dayIso) : null;
      return { dayIso, kpAvg, ap, solar, radio };
    });
  }, [daysISO, kpSeries, solarByDay, radioByDay]);

  // ---- Charts
  const kpChart = useMemo(
    () => kpSeries.map((pt) => ({ time: fmtTime(pt.iso), kp: pt.kp, ap: kpToAp(pt.kp) })),
    [kpSeries]
  );

  const hasSolar = useMemo(
    () => daysISO.some((d) => typeof solarByDay.get(d) === "number"),
    [daysISO, solarByDay]
  );
  const hasRadio = useMemo(
    () => daysISO.some((d) => typeof radioByDay.get(d) === "number"),
    [daysISO, radioByDay]
  );

  const solarChart = useMemo(
    () =>
      hasSolar
        ? daysISO.map((d) => ({
            day: fmtDayUTC(`${d}T00:00:00Z`),
            solar: typeof solarByDay.get(d) === "number" ? solarByDay.get(d) : null,
          }))
        : [],
    [daysISO, solarByDay, hasSolar]
  );

  const radioChart = useMemo(
    () =>
      hasRadio
        ? daysISO.map((d) => ({
            day: fmtDayUTC(`${d}T00:00:00Z`),
            radio: typeof radioByDay.get(d) === "number" ? radioByDay.get(d) : null,
          }))
        : [],
    [daysISO, radioByDay, hasRadio]
  );

  return (
    <Box>
      <Card elevation={3} sx={{ borderRadius: 3 }}>
        <CardContent>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Present — Live NOAA 3-Day Space Weather Forecast
            </Typography>
            <Stack direction="row" alignItems="center" spacing={1}>
              {issued && <Chip size="small" label={`Issued: ${issued}`} />}
              <Tooltip title="Refresh">
                <span>
                  <IconButton onClick={load} disabled={loading}>
                    <RefreshIcon />
                  </IconButton>
                </span>
              </Tooltip>
            </Stack>
          </Stack>

          <Divider sx={{ my: 2 }} />

          {loading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
              <CircularProgress />
            </Box>
          ) : err ? (
            <Typography color="error">{err}</Typography>
          ) : !daysISO.length ? (
            <Typography>No live NOAA forecast found.</Typography>
          ) : (
            <>
              {/* Day cards */}
              <Box
                sx={{
                  display: "grid",
                  gap: 2,
                  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                  mb: 2,
                }}
              >
                {dayCards.map((c) => (
                  <Box
                    key={c.dayIso}
                    sx={{
                      border: "1px solid",
                      borderColor: "divider",
                      borderRadius: 2,
                      p: 2,
                      bgcolor: "#fff",
                    }}
                  >
                    <Typography variant="caption" color="text.secondary">
                      Forecast — {fmtDayUTC(`${c.dayIso}T00:00:00Z`)}
                    </Typography>

                    {/* Kp avg + Ap */}
                    <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 1.25, mt: 1 }}>
                      <Box>
                        <Typography variant="caption" color="text.secondary">Kp (avg)</Typography>
                        <Typography variant="h6" sx={{ fontWeight: 700 }}>{fmtKp(c.kpAvg)}</Typography>
                      </Box>
                      <Box>
                        <Typography variant="caption" color="text.secondary">Ap (≈)</Typography>
                        <Typography variant="h6" sx={{ fontWeight: 700 }}>{c.ap}</Typography>
                      </Box>
                    </Box>

                    {/* Solar + Radio */}
                    <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 1.25, mt: 1 }}>
                      <Box>
                        <Typography variant="caption" color="text.secondary">Solar Radiation</Typography>
                        <Typography variant="h6" sx={{ fontWeight: 700 }}>
                          {c.solar == null ? "—" : `${c.solar}%`}
                        </Typography>
                      </Box>
                      <Box>
                        <Typography variant="caption" color="text.secondary">Radio Blackout</Typography>
                        <Typography variant="h6" sx={{ fontWeight: 700 }}>
                          {c.radio == null ? "—" : `${c.radio}%`}
                        </Typography>
                      </Box>
                    </Box>
                  </Box>
                ))}
              </Box>

              {/* Kp chart */}
              <Box sx={{ bgcolor: "#fff", borderRadius: 2, p: 2, mb: 2 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                  Kp Index
                </Typography>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={kpChart}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis domain={[0, 9]} label={{ value: "Kp", angle: -90, position: "insideLeft" }} />
                    <RcTooltip />
                    <Legend />
                    <Line type="monotone" dataKey="kp" stroke="#1f77b4" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </Box>

              {/* Solar chart (only if available) */}
              {hasSolar && (
                <Box sx={{ bgcolor: "#fff", borderRadius: 2, p: 2, mb: 2 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                    Solar Radiation Probability
                  </Typography>
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={solarChart}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="day" />
                      <YAxis domain={[0, 100]} label={{ value: "%", angle: -90, position: "insideLeft" }} />
                      <RcTooltip />
                      <Legend />
                      <Line type="monotone" dataKey="solar" stroke="#2ca02c" dot />
                    </LineChart>
                  </ResponsiveContainer>
                </Box>
              )}

              {/* Radio chart (only if available) */}
              {hasRadio && (
                <Box sx={{ bgcolor: "#fff", borderRadius: 2, p: 2 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                    Radio Blackout Probability
                  </Typography>
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={radioChart}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="day" />
                      <YAxis domain={[0, 100]} label={{ value: "%", angle: -90, position: "insideLeft" }} />
                      <RcTooltip />
                      <Legend />
                      <Line type="monotone" dataKey="radio" stroke="#d62728" dot />
                    </LineChart>
                  </ResponsiveContainer>
                </Box>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
