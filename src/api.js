// my-frontend/src/api.js
import axios from "axios";

/**
 * API base URL selection:
 * - If REACT_APP_API_BASE is defined at build time (Vercel env var) we use that.
 * - Otherwise default to localhost for local development.
 */
const API_BASE = process.env.REACT_APP_API_BASE || "http://127.0.0.1:8000";

if (typeof window !== "undefined") {
  // Helpful runtime info in browser console while debugging
  // eslint-disable-next-line no-console
  console.info("[API] using API_BASE =", API_BASE);
}

/**
 * GET wrapper with cache-busting query param to avoid CDN caching during development
 * and to ensure the latest returned data.
 */
function bustCache(url, params = {}) {
  return axios.get(`${API_BASE}${url}`, {
    params: { ...params, t: Date.now() },
    headers: { "Cache-Control": "no-cache", Pragma: "no-cache" },
  });
}

/* ====================== FORECAST ====================== */
export async function fetchPredictions() {
  // 3-day predictions (used by Future tab)
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
/**
 * Fetch the NOAA "present" bulletin text.
 * Backend may return either:
 *  - plain string (res.data is string), or
 *  - JSON object { text: "...", fetched_at: "...", source: "cached" }
 *
 * This function normalizes to a plain string.
 */
export async function fetchPresentForecast() {
  const res = await bustCache("/api/noaa/present/text");
  const body = res && res.data;
  if (!body) return "";
  if (typeof body === "string") return body;
  if (typeof body === "object" && body.text && typeof body.text === "string") return body.text;
  // fallback: return any 'text' field
  if (typeof body === "object" && "text" in body) return String(body.text || "");
  // last resort: stringify object
  try {
    return JSON.stringify(body);
  } catch (e) {
    return "";
  }
}

export async function fetchNoaaPresentText() {
  // alias kept for backwards compatibility
  return fetchPresentForecast();
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
