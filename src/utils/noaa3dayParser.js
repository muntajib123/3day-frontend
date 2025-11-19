// src/utils/noaa3dayParser.js

// ===== Common helpers =====
const MONTHS = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
  Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
};

function pad2(n) { return String(n).padStart(2, "0"); }

function dayKeyUTC(date) {
  // date: JS Date (assumed UTC)
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
}

function toISOKeyFromTuple(year, mon, day) {
  const d = new Date(Date.UTC(year, mon, day, 0, 0, 0));
  return dayKeyUTC(d);
}

// ====== parseNoaa3Day (Kp text) ======
export function parseNoaa3Day(text) {
  if (!text || typeof text !== "string") {
    return { meta: {}, summary: {}, kpBreakdown: [], daysLabel: [], daysISO: [], kpSeries: [] };
  }
  const clean = text.replace(/\r/g, "");
  const lines = clean.split("\n");

  const meta = {};
  const summary = {};

  // :Issued:
  const issuedLine = lines.find((l) => /^:Issued:/i.test(l));
  if (issuedLine) meta.issued = issuedLine.replace(/^:Issued:\s*/i, "").trim();

  // Section A summary
  const aIdx = lines.findIndex((l) => /^\s*A\.\s*NOAA/i.test(l));
  if (aIdx !== -1) {
    const block = lines.slice(aIdx, aIdx + 60).join("\n");
    const observed = block.match(/greatest observed.*?was\s+([0-9.]+)/i);
    const expected = block.match(/greatest expected.*?is\s+([0-9.]+)/i);
    if (observed) summary.greatestObservedKp = Number(observed[1]);
    if (expected) summary.greatestExpectedKp = Number(expected[1]);
  }

  // Find "Kp index breakdown ..." (NOAA sometimes omits the leading "NOAA")
  const kpTitleIdx = lines.findIndex((l) => /Kp index breakdown/i.test(l));
  if (kpTitleIdx === -1) {
    return { meta, summary, kpBreakdown: [], daysLabel: [], daysISO: [], kpSeries: [] };
  }
  const titleLine = lines[kpTitleIdx];
  let breakdownYear = null;
  const ym = titleLine.match(/(\d{4})\s*$/);
  if (ym) breakdownYear = Number(ym[1]);
  if (!breakdownYear && meta.issued) {
    const iy = meta.issued.match(/(\d{4})/);
    if (iy) breakdownYear = Number(iy[1]);
  }
  if (!breakdownYear) breakdownYear = new Date().getUTCFullYear();

  // Header row with day labels e.g. "Oct 23    Oct 24    Oct 25"
  let headerRow = kpTitleIdx + 1;
  while (headerRow < lines.length && !lines[headerRow].trim()) headerRow++;
  const dayHeaderLine = lines[headerRow] || "";

  // Extract short labels (e.g. "Oct 23")
  const daysLabel = dayHeaderLine
    .split(/\s{2,}/)
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((s) => /^[A-Za-z]{3}\s+\d{1,2}$/.test(s))
    .slice(0, 3);

  // Parse months/days + handle Dec->Jan rollover
  const dayTuples = daysLabel.map((dStr) => {
    const m = dStr.match(/^([A-Za-z]{3})\s+(\d{1,2})$/);
    if (!m) return null;
    return { mon: MONTHS[m[1]], day: Number(m[2]), label: dStr, yOffset: 0 };
  });

  // handle year rollover across Dec->Jan in the day labels
  for (let i = 1; i < dayTuples.length; i++) {
    const prev = dayTuples[i - 1], cur = dayTuples[i];
    if (prev && cur && prev.mon === 11 && cur.mon === 0) {
      for (let j = i; j < dayTuples.length; j++) dayTuples[j].yOffset = 1;
      break;
    }
  }

  // Build daysISO (YYYY-MM-DD) aligned with daysLabel order
  const daysISO = dayTuples
    .filter(Boolean)
    .map((t) => {
      const y = breakdownYear + (t.yOffset || 0);
      return toISOKeyFromTuple(y, t.mon, t.day);
    });

  // Build a mapping label -> ISO key for later use
  const labelToISO = {};
  dayTuples.forEach((t, idx) => {
    if (!t) return;
    const iso = daysISO[idx];
    labelToISO[t.label] = iso;
  });

  // Build the Kp table rows
  const kpBreakdown = [];
  for (let r = headerRow + 1; r < lines.length; r++) {
    const row = lines[r];
    if (!row.trim()) break;
    if (/^Rationale:/i.test(row)) break;

    const m = row.match(/^(\d{2}-\d{2})UT\s+(.+)$/i);
    if (!m) continue;
    const hourBlock = m[1];
    // split on two or more spaces to preserve possible single-space tokens
    const vals = m[2].trim().split(/\s{2,}/).map((v) => v.trim());
    const entry = { hourBlock };
    // Map values to ISO keys (not to original labels) so frontend can use calendar keys
    daysLabel.forEach((d, idx) => {
      const vRaw = vals[idx];
      const v = vRaw == null || vRaw === "" ? null : Number(vRaw);
      const isoKey = labelToISO[d];
      entry[isoKey] = Number.isFinite(v) ? v : null;
    });
    kpBreakdown.push(entry);
  }

  // Flat time series (UTC ISO)
  const hourStart = (hb) => {
    const mm = hb.match(/^(\d{2})-(\d{2})$/);
    return mm ? Number(mm[1]) : null;
  };

  const kpSeries = [];
  dayTuples.forEach((t, dayIndex) => {
    if (!t) return;
    const y = breakdownYear + (t.yOffset || 0);
    const isoDay = toISOKeyFromTuple(y, t.mon, t.day); // YYYY-MM-DD
    kpBreakdown.forEach((row) => {
      const h = hourStart(row.hourBlock);
      if (h == null) return;
      const kp = row[isoDay];
      if (kp == null) return;
      const iso = new Date(Date.UTC(y, t.mon, t.day, h, 0, 0)).toISOString();
      kpSeries.push({ iso, kp: Number(kp), dayIndex });
    });
  });

  return { meta, summary, kpBreakdown, daysLabel, daysISO, kpSeries };
}

// ====== Probability parsing (Solar/Radio) ======
// Robust parser that reads the two sections inside the MAIN 3-day text.

function parseDaysAfter(lines, startIdx, fallbackYear) {
  // find the line with the three day tokens
  for (let i = startIdx; i < Math.min(lines.length, startIdx + 10); i++) {
    const line = lines[i];
    const tokens = line
      .trim()
      .split(/\s{2,}/)
      .map((s) => s.trim())
      .filter((s) => /^[A-Za-z]{3}\s+\d{1,2}$/.test(s));
    if (tokens.length >= 3) {
      const tuples = tokens.slice(0, 3).map((tok) => {
        const m = tok.match(/^([A-Za-z]{3})\s+(\d{1,2})$/);
        return { mon: MONTHS[m[1]], day: Number(m[2]) };
      });
      // year: try to read from header line (may have year), else fallback
      const yearMatch = lines[startIdx].match(/(\d{4})\s*$/);
      const year = yearMatch ? Number(yearMatch[1]) : (fallbackYear || new Date().getUTCFullYear());
      // handle Dec->Jan rollover
      for (let j = 1; j < tuples.length; j++) {
        if (tuples[j - 1].mon === 11 && tuples[j].mon === 0) {
          for (let k = j; k < tuples.length; k++) tuples[k].yearBump = 1;
          break;
        }
      }
      return tuples.map((t) => {
        const y = year + (t.yearBump || 0);
        return dayKeyUTC(new Date(Date.UTC(y, t.mon, t.day, 0, 0, 0)));
      });
    }
  }
  return [];
}

function findPercentTriplet(lines, startIdx, preferRegexList) {
  // search up to ~20 lines after start for the first matching row
  for (let i = startIdx; i < Math.min(lines.length, startIdx + 20); i++) {
    const line = lines[i];
    for (const re of preferRegexList) {
      const m = line.match(re);
      if (m) {
        // last three captures are the percentages
        const nums = m.slice(-3).map((x) => Number(x));
        if (nums.every((n) => Number.isFinite(n))) return nums;
      }
    }
  }
  return null;
}

export function parseNoaaProbabilities(text, fallbackYear, daysHintISO = []) {
  const lines = (text || "").replace(/\r/g, "").split("\n");
  const clamp = (n) => Math.min(100, Math.max(0, Number(n) || 0));

  // --- locate section headers in main file
  const solarHdrIdx = lines.findIndex((l) => /Solar\s+Radiation\s+Storm\s+Forecast/i.test(l));
  const radioHdrIdx = lines.findIndex((l) => /Radio\s+Blackout\s+Forecast/i.test(l));

  let daysISO = [];
  const solarByDay = new Map();
  const radioByDay = new Map();

  // --- SOLAR
  if (solarHdrIdx !== -1) {
    const localDays = parseDaysAfter(lines, solarHdrIdx, fallbackYear);
    if (localDays.length === 3) daysISO = localDays;

    // Prefer the explicit "S1 or greater" row
    const solarTriplet =
      findPercentTriplet(lines, solarHdrIdx, [
        /S1\s*or\s*greater\s+(\d{1,3})\s*%\s+(\d{1,3})\s*%\s+(\d{1,3})\s*%/i
      ]) ||
      // or any line with 3 percentages inside the next ~20 lines
      findPercentTriplet(lines, solarHdrIdx, [
        /(\d{1,3})\s*%\s+(\d{1,3})\s*%\s+(\d{1,3})\s*%/
      ]);

    if (daysISO.length === 3 && Array.isArray(solarTriplet)) {
      daysISO.forEach((d, i) => solarByDay.set(d, clamp(solarTriplet[i])));
    }
  }

  // --- RADIO
  if (radioHdrIdx !== -1) {
    if (daysISO.length !== 3) {
      const localDays = parseDaysAfter(lines, radioHdrIdx, fallbackYear);
      if (localDays.length === 3) daysISO = localDays;
    }

    // Prefer R1-R2 row, else fall back to R3 or greater
    const radioTriplet =
      findPercentTriplet(lines, radioHdrIdx, [
        /R1\s*-\s*R2\s+(\d{1,3})\s*%\s+(\d{1,3})\s*%\s+(\d{1,3})\s*%/i
      ]) ||
      findPercentTriplet(lines, radioHdrIdx, [
        /R3\s*or\s*greater\s+(\d{1,3})\s*%\s+(\d{1,3})\s*%\s+(\d{1,3})\s*%/i
      ]) ||
      findPercentTriplet(lines, radioHdrIdx, [
        /(\d{1,3})\s*%\s+(\d{1,3})\s*%\s+(\d{1,3})\s*%/
      ]);

    if (daysISO.length === 3 && Array.isArray(radioTriplet)) {
      daysISO.forEach((d, i) => radioByDay.set(d, clamp(radioTriplet[i])));
    }
  }

  // If we still don't have daysISO from sections, trust daysHintISO
  if (!(Array.isArray(daysISO) && daysISO.length === 3) &&
      Array.isArray(daysHintISO) && daysHintISO.length === 3) {
    daysISO = [...daysHintISO];
  }

  return { daysISO, solarByDay, radioByDay };
}
