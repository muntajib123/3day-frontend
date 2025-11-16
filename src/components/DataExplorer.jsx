// src/components/DataExplorer.jsx
import React, { useEffect, useState, Suspense } from "react";
import { Box, Tabs, Tab, Paper, Stack, Button } from "@mui/material";

// PRESENT: use the new NowTab (cards + charts + exports, no table)
import NowTab from "./NowTab";

// PAST: your existing view
import PastTab from "./PastTab";

// FUTURE: your LSTM UI
import ForecastDisplay from "./ForecastDisplay";

function a11yProps(index) {
  return { id: `data-tab-${index}`, "aria-controls": `data-panel-${index}` };
}

export default function DataExplorer() {
  const [tab, setTab] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0); // force remount when needed

  // Recharts: recalc sizes when tab changes or refresh triggers
  useEffect(() => {
    const t = setTimeout(() => {
      window.dispatchEvent(new Event("resize"));
    }, 120);
    return () => clearTimeout(t);
  }, [tab, refreshKey]);

  const handleChange = (_e, value) => {
    setTab(value);
    setTimeout(() => window.dispatchEvent(new Event("resize")), 0);
  };

  const handleRefresh = () => {
    setRefreshKey((k) => k + 1);
    window.dispatchEvent(new Event("resize"));
  };

  return (
    <Box sx={{ width: "100%" }}>
      {/* Tabs + actions */}
      <Paper elevation={1} sx={{ px: 2, py: 1, borderRadius: 2, mb: 2 }}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <Tabs
            value={tab}
            onChange={handleChange}
            variant="scrollable"
            scrollButtons="auto"
            aria-label="Data Explorer Tabs"
            sx={{ flex: 1 }}
          >
            <Tab label="Present" {...a11yProps(0)} />
            <Tab label="Past" {...a11yProps(1)} />
            <Tab label="Future" {...a11yProps(2)} />
          </Tabs>
          <Button size="small" variant="outlined" onClick={handleRefresh}>
            Refresh
          </Button>
        </Stack>
      </Paper>

      {/* PRESENT */}
      <Box
        key={`present-${refreshKey}`}
        role="tabpanel"
        hidden={tab !== 0}
        id="data-panel-0"
        aria-labelledby="data-tab-0"
      >
        {tab === 0 && (
          <Suspense fallback={<Box sx={{ p: 2 }}>Loading present…</Box>}>
            <NowTab />
          </Suspense>
        )}
      </Box>

      {/* PAST */}
      <Box
        key={`past-${refreshKey}`}
        role="tabpanel"
        hidden={tab !== 1}
        id="data-panel-1"
        aria-labelledby="data-tab-1"
      >
        {tab === 1 && (
          <Suspense fallback={<Box sx={{ p: 2 }}>Loading past…</Box>}>
            <PastTab />
          </Suspense>
        )}
      </Box>

      {/* FUTURE */}
      <Box
        key={`future-${refreshKey}`}
        role="tabpanel"
        hidden={tab !== 2}
        id="data-panel-2"
        aria-labelledby="data-tab-2"
      >
        {tab === 2 && (
          <Suspense fallback={<Box sx={{ p: 2 }}>Loading future…</Box>}>
            <ForecastDisplay />
          </Suspense>
        )}
      </Box>
    </Box>
  );
}
