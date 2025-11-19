// src/components/PastTab.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
} from "@mui/material";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

// Helper: convert "00-03" to "00:00"
function hourLabelFromBlock(hb) {
  const m = hb.match(/^(\d{2})-(\d{2})/);
  if (!m) return hb;
  return `${m[1]}:00`;
}

export default function PastTab() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [days, setDays] = useState([]); // array of day objects from JSON
  const [selectedDate, setSelectedDate] = useState(null);

  useEffect(() => {
    setLoading(true);
    fetch("/historical_3day_clean.json")
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load historical JSON");
        return r.json();
      })
      .then((json) => {
        const list = Array.isArray(json.days) ? json.days : [];
        setDays(list);
        const firstWithData = list.find((d) => d.kp_avg != null) || list[0] || null;
        setSelectedDate(firstWithData ? firstWithData.date : (list[0] && list[0].date) || null);
      })
      .catch((e) => {
        console.error("PastTab fetch error:", e);
        setError(String(e));
      })
      .finally(() => setLoading(false));
  }, []);

  const selectedDay = useMemo(() => days.find((d) => d.date === selectedDate) || null, [days, selectedDate]);

  const series = useMemo(() => {
    if (!selectedDay || !selectedDay.kp_hourly) return [];
    const items = Object.keys(selectedDay.kp_hourly)
      .map((hb) => {
        const v = selectedDay.kp_hourly[hb];
        return { block: hb, hour: hourLabelFromBlock(hb), kp: typeof v === "number" ? v : null };
      })
      .sort((a, b) => a.block.localeCompare(b.block));
    return items;
  }, [selectedDay]);

  if (loading) {
    return (
      <Box sx={{ py: 6, display: "flex", justifyContent: "center" }}>
        <CircularProgress />
      </Box>
    );
  }
  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography color="error">Error loading historical data: {error}</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2 }}>
      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Typography variant="h5" sx={{ mb: 2, fontWeight: 700 }}>
            Historical — Kp Index
          </Typography>

          <Paper sx={{ p: 2, mb: 2 }}>
            <FormControl fullWidth>
              <InputLabel id="pastday-select-label">Select date</InputLabel>
              <Select
                labelId="pastday-select-label"
                value={selectedDate || ""}
                label="Select date"
                onChange={(e) => setSelectedDate(e.target.value)}
              >
                {days.map((d) => (
                  <MenuItem key={d.date} value={d.date}>
                    {d.date} {d.kp_avg != null ? `• Kp avg ${Number(d.kp_avg).toFixed(2)}` : ""}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Paper>

          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary">
                Summary for {selectedDay ? selectedDay.date : "—"}
              </Typography>

              <Grid container spacing={2} sx={{ mt: 1 }}>
                <Grid item>
                  <Typography variant="h4" sx={{ fontWeight: 800 }}>
                    {selectedDay && selectedDay.kp_avg != null ? Number(selectedDay.kp_avg).toFixed(2) : "—"}
                  </Typography>
                  <Typography variant="caption">Daily Avg Kp</Typography>
                </Grid>

                <Grid item>
                  <Typography variant="h5" sx={{ fontWeight: 700 }}>
                    {selectedDay ? selectedDay.kp_points : "—"}
                  </Typography>
                  <Typography variant="caption">Kp points</Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Typography variant="subtitle1" sx={{ mb: 1 }}>
                Hourly Kp (by UTC-block)
              </Typography>

              {series.length ? (
                <Box sx={{ width: "100%", height: 320 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={series}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="hour" />
                      <YAxis domain={[0, 9]} />
                      <Tooltip />
                      <Line type="monotone" dataKey="kp" stroke="#1f77b4" dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </Box>
              ) : (
                <Typography>No hourly Kp data for this date.</Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Typography variant="subtitle1" sx={{ mb: 1 }}>
            Day Details
          </Typography>

          <Paper sx={{ p: 1 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>UTC Block</TableCell>
                  <TableCell>Kp</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {series.length ? (
                  series.map((s) => (
                    <TableRow key={s.block}>
                      <TableCell>{s.block}</TableCell>
                      <TableCell>{s.kp != null ? Number(s.kp).toFixed(2) : "—"}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={2}>No data</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
