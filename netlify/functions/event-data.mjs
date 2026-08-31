export const WEBSITE_URL = "https://playa.intelchen.com";
export const SHEET_ID = "1KEXPq567lHtESUXdtt1CLzXJNSFc1318cT1yNv8nzg8";
export const SHEET_LINK = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit?gid=0#gid=0`;
export const EVENT_DATES = [
  "2026-08-30", "2026-08-31", "2026-09-01", "2026-09-02", "2026-09-03",
  "2026-09-04", "2026-09-05", "2026-09-06", "2026-09-07",
];

function value(row, index) {
  const raw = row.c?.[index]?.v;
  return raw === null || raw === undefined || raw === "" ? "-" : String(raw);
}

async function fetchSheet(sheet) {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${sheet}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Sheet returned ${response.status}`);
  const source = await response.text();
  const start = source.indexOf("{");
  const end = source.lastIndexOf("}");
  if (start < 0 || end < 0) throw new Error("Invalid sheet response");
  const payload = JSON.parse(source.slice(start, end + 1));
  const rows = payload.table.rows || [];
  return rows.slice(1).map((row) => ({
    times: Array.from({ length: 9 }, (_, index) => value(row, index)),
    title: value(row, 9),
    description: value(row, 10),
    type: value(row, 11),
    camp: value(row, 12),
    where: value(row, 13),
    extra: value(row, 14),
    link: /^https?:\/\//.test(value(row, 15)) ? value(row, 15) : SHEET_LINK,
    uid: value(row, 16),
  })).filter((event) => event.uid !== "-" && event.title !== "-");
}

const cache = new Map();

export async function getEvents(lang) {
  const key = lang === "zh" ? "zh" : "en";
  const cached = cache.get(key);
  if (cached && Date.now() - cached.loadedAt < 15 * 60 * 1000) return cached.events;
  const events = await fetchSheet(key === "zh" ? "Chinese" : "English");
  cache.set(key, { events, loadedAt: Date.now() });
  return events;
}
