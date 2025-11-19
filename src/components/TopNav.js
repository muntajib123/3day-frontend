// src/components/TopNav.js
import React from "react";
import { AppBar, Toolbar, Typography, Box } from "@mui/material";

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
      <Toolbar sx={{ display: "flex", justifyContent: "flex-start" }}>
        
        {/* CoralComp Logo */}
        <Box
          component="img"
          src="/images/coralcomp-logo.png"   // <-- Put your logo in public/images/
          alt="CoralComp Logo"
          sx={{
            width: 38,
            height: 38,
            borderRadius: 1,
            mr: 1.2,
          }}
        />

        {/* Title */}
        <Typography
          variant="h6"
          noWrap
          component="div"
          sx={{ fontWeight: 700, color: "#1976d2" }}
        >
          CoralComp Space Weather Forecast
        </Typography>

      </Toolbar>
    </AppBar>
  );
}
