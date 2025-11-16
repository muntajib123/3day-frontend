// src/components/TopNav.js
import React from "react";
import { AppBar, Toolbar, Typography } from "@mui/material";

export default function TopNav() {
  return (
    <AppBar
      position="static"
      color="default"
      sx={{
        mb: 2,
        boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
        background: "#fff",
      }}
    >
      <Toolbar sx={{ display: "flex", justifyContent: "space-between" }}>
        {/* Logo / Title */}
        <Typography
          variant="h6"
          noWrap
          component="div"
          sx={{ fontWeight: 700, color: "#1976d2" }}
        >
          🌌 Space Weather Forecast
        </Typography>
      </Toolbar>
    </AppBar>
  );
}
