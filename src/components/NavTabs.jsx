// src/components/NavTabs.jsx
import React from "react";
import PropTypes from "prop-types";
import {
  Box,
  Tabs,
  Tab,
  Container,
  Button,
  Paper,
  Typography,
  useMediaQuery,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import { useTheme } from "@mui/material/styles";

function a11yProps(index) {
  return {
    id: `forecast-tab-${index}`,
    "aria-controls": `forecast-tabpanel-${index}`,
  };
}

/**
 * NavTabs
 *
 * Props:
 * - value: number (0 = Present, 1 = Historical, 2 = Future)
 * - onChange: (event, newValue) => void
 * - onRefresh: () => void
 * - issuedText: optional string to show (e.g. "Issued: 2025 Nov 18 0030 UTC")
 */
export default function NavTabs({ value = 0, onChange, onRefresh, issuedText = null }) {
  const theme = useTheme();
  const small = useMediaQuery(theme.breakpoints.down("sm"));

  return (
    <Container maxWidth="lg" sx={{ mt: 2 }}>
      <Paper elevation={1} sx={{ px: 2, py: 1.25, borderRadius: 2 }}>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Tabs
            value={value}
            onChange={onChange}
            aria-label="Forecast tabs"
            variant={small ? "scrollable" : "standard"}
            scrollButtons
            allowScrollButtonsMobile
            sx={{
              "& .MuiTab-root": { textTransform: "none", minWidth: 100, fontWeight: 600 },
              "& .MuiTabs-indicator": { height: 3, borderRadius: 2 },
            }}
          >
            <Tab label="PRESENT" {...a11yProps(0)} />
            <Tab label="HISTORICAL" {...a11yProps(1)} />
            <Tab label="FUTURE" {...a11yProps(2)} />
          </Tabs>

          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            {issuedText ? (
              <Typography
                variant="caption"
                sx={{
                  bgcolor: "#eef2f6",
                  px: 1.2,
                  py: 0.6,
                  borderRadius: 2,
                  mr: 1,
                  fontWeight: 600,
                }}
              >
                {issuedText}
              </Typography>
            ) : null}

            <Button
              variant="outlined"
              size="small"
              startIcon={<RefreshIcon />}
              onClick={onRefresh}
              aria-label="Refresh forecasts"
            >
              Refresh
            </Button>
          </Box>
        </Box>
      </Paper>
    </Container>
  );
}

NavTabs.propTypes = {
  value: PropTypes.number,
  onChange: PropTypes.func,
  onRefresh: PropTypes.func,
  issuedText: PropTypes.string,
};
