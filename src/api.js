// src/api.js
import axios from "axios";

// 🔥 Use Render backend in production + localhost in dev
const API_BASE =
  process.env.REACT_APP_API_BASE ||
  "https://space-3day.onrender.com"; // <-- Render backend URL

// Add cache-buster
function bustCache(url, params = {}) {
  return axios.get(`${API_BASE}${url}`, {
    params: { ...params, t: Date.now() },
    headers: { "Cache-Control": "no-cache", Pragma: "no-cache" },
  });
}

/* ====================== FORECAST ====================== */
export async function fetchPredictions() {
  const res = await bustCache("/api/predictions/3day");
  return res.data;
}

/* ==================== HISTORY ======================== */
export async function fetchHistory(year, month) {
  const mm = String(month).padStart(2, "0");
  const res = await bustCache("/api/obs/history", { year, month: mm });
  return Array.isArray(res.data) ? { data: res.data } : res.data;
}

export async function fetchObsHistory({ limit = 200, since, until } = {}) {
  const res = await bustCache("/api/obs/history", { limit, since, until });
  return res.data;
}

/* ================= NOAA PRESENT TEXT ================= */
export async function fetchNoaaPresentText() {
  const res = await bustCache("/api/noaa/present/text");
  return res.data;
}

export async function saveNoaaPresentText(text) {
  const res = await axios.post(
    `${API_BASE}/api/noaa/present/save`,
    { text },
    { headers: { "Content-Type": "application/json" } }
  );
  return res.data;
}

export default fetchPredictions;
