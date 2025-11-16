// src/components/ForecastDashboard.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Divider,
  Paper,
  CircularProgress,
  useTheme,
  Button,
  Stack,
  Container,
} from "@mui/material";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { parseISO, format } from "date-fns";
import fetchPredictions from "../api";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

/* ---------- helpers: PNG/PDF downloads ---------- */
async function downloadPNGFromRef(ref, filename = "chart.png") {
  if (!ref?.current) return;
  const canvas = await html2canvas(ref.current, { useCORS: true, scale: 2 });
  const url = canvas.toDataURL("image/png");
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
}
async function downloadPDFFromRef(ref, filename = "chart.pdf") {
  if (!ref?.current) return;
  const canvas = await html2canvas(ref.current, { useCORS: true, scale: 2 });
  const imgData = canvas.toDataURL("image/png");
  const pdf = new jsPDF("l", "mm", "a4");
  const pageWidth = pdf.internal.pageSize.getWidth();
  const imgProps = pdf.getImageProperties(imgData);
  const imgWidth = pageWidth - 12;
  const imgHeight = (imgProps.height * imgWidth) / imgProps.width;
  pdf.addImage(imgData, "PNG", 6, 6, imgWidth, imgHeight);
  pdf.save(filename);
}

export default function ForecastDashboard() {
  const theme = useTheme();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const kpRef = useRef(null);
  const apRef = useRef(null);
  const solarRef = useRef(null);
  const radioRef = useRef(null);

  /* -------- load predictions -------- */
  useEffect(() => {
    setLoading(true);
    fetchPredictions()
      .then((res) => {
        const data = Array.isArray(res) ? res : res?.predictions ?? res?.data ?? [];
        const normalized = data
          .map((r) => {
            const dtRaw = r.datetime ?? r.date ?? r.time;
            const dt = typeof dtRaw === "string" ? parseISO(dtRaw) : new Date(dtRaw);
            return {
              ...r,
              dt,
              kp: r.kp != null ? Number(r.kp) : null,
              ap: r.ap != null ? Number(r.ap) : null,
              solar:
                r.solar_radiation != null
                  ? Number(r.solar_radiation)
                  : r.solar != null
                  ? Number(r.solar)
                  : null,
              radio:
                r.radio_blackout != null
                  ? Number(r.radio_blackout)
                  : r.radio != null
                  ? Number(r.radio)
                  : null,
            };
          })
          .filter((r) => r.dt && !Number.isNaN(r.dt.getTime()))
          .sort((a, b) => a.dt - b.dt);
        setRows(normalized);
      })
      .catch((err) => {
        console.error("fetchPredictions error:", err);
        setError(err?.response?.data ?? err.message ?? String(err));
      })
      .finally(() => setLoading(false));
  }, []);

  /* -------- group by date -------- */
  const groupedByDate = useMemo(() => {
    if (!rows.length) return [];
    const map = new Map();
    rows.forEach((r) => {
      const key = format(r.dt, "yyyy-MM-dd");
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(r);
    });
    return Array.from(map.entries()).map(([date, items]) => ({ date, items }));
  }, [rows]);

  /* -------- compute Ap daily from Kp if missing -------- */
  const apMap = useMemo(() => {
    const m = new Map();
    groupedByDate.forEach(({ date, items }) => {
      const kpVals = items.map((i) => i.kp).filter((v) => v != null && !Number.isNaN(v));
      const avg = kpVals.length ? kpVals.reduce((s, v) => s + v, 0) / kpVals.length : null;
      m.set(date, avg);
    });
    return m;
  }, [groupedByDate]);

  /* -------- limit charts to same 3 visible days as cards -------- */
  const visibleDates = useMemo(() => groupedByDate.slice(0, 3).map((g) => g.date), [groupedByDate]);
  const visibleChartRows = useMemo(
    () => rows.filter((r) => visibleDates.includes(format(r.dt, "yyyy-MM-dd"))),
    [rows, visibleDates]
  );

  const chartData = useMemo(
    () =>
      visibleChartRows.map((r) => {
        const dateKey = format(r.dt, "yyyy-MM-dd");
        return {
          time: format(r.dt, "MMM d, HH:mm"),
          kp: r.kp,
          ap: r.ap != null ? r.ap : apMap.get(dateKey) ?? null,
          solar: r.solar,
          radio: r.radio,
        };
      }),
    [visibleChartRows, apMap]
  );

  const { kpPeak, kpAvg, kpNext } = useMemo(() => {
    const vals = visibleChartRows.map((r) => r.kp).filter((v) => v != null && !Number.isNaN(v));
    return {
      kpPeak: vals.length ? Math.max(...vals) : null,
      kpAvg: vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null,
      kpNext: visibleChartRows.find((r) => r.kp != null)?.kp ?? null,
    };
  }, [visibleChartRows]);

  // 🔑 generate key for Recharts containers so they remount correctly
  const rechartsKey = useMemo(() => {
    if (!rows.length) return "empty";
    const first = rows[0]?.dt?.toISOString?.() ?? "";
    const last = rows[rows.length - 1]?.dt?.toISOString?.() ?? "";
    return `len:${rows.length}|${first}->${last}`;
  }, [rows]);

  if (loading) {
    return (
      <Box sx={{ p: 6, display: "flex", justifyContent: "center" }}>
        <CircularProgress />
      </Box>
    );
  }
  if (error) {
    return (
      <Box sx={{ p: 6 }}>
        <Typography color="error">Error loading forecast: {String(error)}</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ py: { xs: 2, md: 4 } }}>
      {/* ===================== TOP SECTIONS ===================== */}
      <Container maxWidth="xl">
        {/* ---------- Day cards ---------- */}
        <Grid container spacing={5} justifyContent="center" sx={{ mb: 6 }}>
          {groupedByDate.slice(0, 3).map((g) => {
            const items = g.items;
            const kp_value = items[0]?.kp ?? null;
            const ap_value = items.find((x) => x.ap != null)?.ap ?? apMap.get(g.date) ?? null;
            const solar_max = items.reduce((m, x) => (x.solar != null ? Math.max(m, x.solar) : m), -Infinity);
            const radio_max = items.reduce((m, x) => (x.radio != null ? Math.max(m, x.radio) : m), -Infinity);
            const label = format(parseISO(g.date + "T00:00:00"), "EEE, MMM d");

            return (
              <Grid item xs={12} sm={10} md={6} lg={4} key={g.date}>
                <Card
                  sx={{
                    height: "100%",
                    borderRadius: 4,
                    boxShadow: "0 10px 30px rgba(15,23,42,0.06)",
                    background: "#fff",
                  }}
                  variant="outlined"
                >
                  <CardContent sx={{ py: 3.5, px: { xs: 3, md: 4 } }}>
                    <Typography variant="subtitle1" color="text.secondary" sx={{ mb: 1 }}>
                      {label}
                    </Typography>
                    <Box sx={{ display: "grid", gap: 0.5 }}>
                      <Typography sx={{ fontSize: 28, fontWeight: 800 }}>
                        Kp: {Number.isFinite(kp_value) ? kp_value.toFixed(2) : "—"}
                      </Typography>
                      <Typography sx={{ fontSize: 22, fontWeight: 700, color: "text.primary" }}>
                        Ap: {ap_value != null ? ap_value.toFixed(2) : "—"}
                      </Typography>
                    </Box>
                    <Divider sx={{ my: 2.5 }} />
                    <Grid container spacing={2}>
                      <Grid item xs={6}>
                        <Typography variant="caption" color="text.secondary">Solar</Typography>
                        <Typography sx={{ fontWeight: 800, fontSize: 18 }}>
                          {Number.isFinite(solar_max) ? `${solar_max.toFixed(0)}%` : "—"}
                        </Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="caption" color="text.secondary">Radio</Typography>
                        <Typography sx={{ fontWeight: 800, fontSize: 18 }}>
                          {Number.isFinite(radio_max) ? `${radio_max.toFixed(0)}%` : "—"}
                        </Typography>
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>

        {/* KPI tiles */}
        <Grid container spacing={4} justifyContent="center" sx={{ mb: 8 }}>
          <Grid item xs={10} sm={6} md={4} lg={3}>
            <Paper sx={{ py: 3.5, textAlign: "center", background: "#ffe9ea", borderRadius: 3 }}>
              <Typography variant="h3" sx={{ fontWeight: 900, color: theme.palette.error.main }}>
                {kpPeak != null ? kpPeak.toFixed(2) : "—"}
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={10} sm={6} md={4} lg={3}>
            <Paper sx={{ py: 3.5, textAlign: "center", background: "#fff6e6", borderRadius: 3 }}>
              <Typography variant="h3" sx={{ fontWeight: 900, color: theme.palette.warning.dark }}>
                {kpAvg != null ? kpAvg.toFixed(2) : "—"}
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={10} sm={6} md={4} lg={3}>
            <Paper sx={{ py: 3.5, textAlign: "center", background: "#e9f5ff", borderRadius: 3 }}>
              <Typography variant="h3" sx={{ fontWeight: 900, color: theme.palette.primary.main }}>
                {kpNext != null ? kpNext.toFixed(2) : "—"}
              </Typography>
            </Paper>
          </Grid>
        </Grid>
      </Container>

      {/* ===================== CHARTS ===================== */}
      <Box sx={{ mt: 2 }}>
        <Container maxWidth="xl">
          {/* Kp chart */}
          <Paper ref={kpRef} sx={{ p: 3, mb: 5, borderRadius: 3 }}>
            <Stack direction="row" justifyContent="space-between" sx={{ mb: 1 }}>
              <Typography variant="h6">Kp Index</Typography>
              <Stack direction="row" spacing={1}>
                <Button size="small" onClick={() => downloadPNGFromRef(kpRef, "kp.png")}>PNG</Button>
                <Button size="small" onClick={() => downloadPDFFromRef(kpRef, "kp.pdf")}>PDF</Button>
              </Stack>
            </Stack>
            <Box sx={{ height: { xs: 320, md: 440 } }}>
              <ResponsiveContainer key={`kp-${rechartsKey}`} width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" tick={{ fontSize: 12 }} />
                  <YAxis />
                  <Tooltip />
                  <ReferenceLine y={5} stroke="rgba(255,0,0,0.45)" />
                  <Line type="monotone" dataKey="kp" stroke={theme.palette.primary.main} strokeWidth={2.25} />
                </LineChart>
              </ResponsiveContainer>
            </Box>
          </Paper>

          {/* Ap chart */}
          <Paper ref={apRef} sx={{ p: 3, mb: 5, borderRadius: 3 }}>
            <Stack direction="row" justifyContent="space-between" sx={{ mb: 1 }}>
              <Typography variant="h6">Ap (daily avg of Kp)</Typography>
              <Stack direction="row" spacing={1}>
                <Button size="small" onClick={() => downloadPNGFromRef(apRef, "ap.png")}>PNG</Button>
                <Button size="small" onClick={() => downloadPDFFromRef(apRef, "ap.pdf")}>PDF</Button>
              </Stack>
            </Stack>
            <Box sx={{ height: { xs: 300, md: 400 } }}>
              <ResponsiveContainer key={`ap-${rechartsKey}`} width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" tick={{ fontSize: 12 }} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="ap" fill={theme.palette.secondary.main} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </Paper>

          {/* Solar chart */}
          <Paper ref={solarRef} sx={{ p: 3, mb: 5, borderRadius: 3 }}>
            <Stack direction="row" justifyContent="space-between" sx={{ mb: 1 }}>
              <Typography variant="h6">Solar Radiation (%)</Typography>
              <Stack direction="row" spacing={1}>
                <Button size="small" onClick={() => downloadPNGFromRef(solarRef, "solar.png")}>PNG</Button>
                <Button size="small" onClick={() => downloadPDFFromRef(solarRef, "solar.pdf")}>PDF</Button>
              </Stack>
            </Stack>
            <Box sx={{ height: { xs: 300, md: 400 } }}>
              <ResponsiveContainer key={`solar-${rechartsKey}`} width="100%" height="100%">
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" tick={{ fontSize: 12 }} />
                  <YAxis />
                  <Tooltip />
                  <Area type="monotone" dataKey="solar" stroke={theme.palette.success.dark} fill={theme.palette.success.light} fillOpacity={0.25} />
                </AreaChart>
              </ResponsiveContainer>
            </Box>
          </Paper>

          {/* Radio chart */}
          <Paper ref={radioRef} sx={{ p: 3, mb: 7, borderRadius: 3 }}>
            <Stack direction="row" justifyContent="space-between" sx={{ mb: 1 }}>
              <Typography variant="h6">Radio Blackout (%)</Typography>
              <Stack direction="row" spacing={1}>
                <Button size="small" onClick={() => downloadPNGFromRef(radioRef, "radio.png")}>PNG</Button>
                <Button size="small" onClick={() => downloadPDFFromRef(radioRef, "radio.pdf")}>PDF</Button>
              </Stack>
            </Stack>
            <Box sx={{ height: { xs: 300, md: 400 } }}>
              <ResponsiveContainer key={`radio-${rechartsKey}`} width="100%" height="100%">
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" tick={{ fontSize: 12 }} />
                  <YAxis />
                  <Tooltip />
                  <Area type="monotone" dataKey="radio" stroke={theme.palette.error.dark} fill={theme.palette.error.light} fillOpacity={0.22} />
                </AreaChart>
              </ResponsiveContainer>
            </Box>
          </Paper>
        </Container>
      </Box>
    </Box>
  );
}
