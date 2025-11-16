// src/App.js
import React from "react";
import TopNav from "./components/TopNav";
import DataExplorer from "./components/DataExplorer";   // ✅ NEW
import "./App.css";

function App() {
  return (
    <div className="app-root">
      <TopNav />
      <main className="app-main">
        <DataExplorer />
      </main>
    </div>
  );
}

export default App;
