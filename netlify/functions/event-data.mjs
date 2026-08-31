import { enrichEventsWithCampLocations } from "../../lib/camp-location.mjs";
import { mergeBilingualEventRows } from "../../lib/bilingual-events.mjs";

export const WEBSITE_URL = "https://playa.intelchen.com";
export const SHEET_ID = "1cPbc5bkKwQ11aID9Xa4-fRyMLpFaX80bAcN3hMjo_DY";
export const SHEET_LINK = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit`;
export const CHINESE_SHEET_GID = "1125425695";
export const CHINESE_SHEET_LINK = `${SHEET_LINK}?gid=${CHINESE_SHEET_GID}#gid=${CHINESE_SHEET_GID}`;
export const EVENT_DATES = [
  "2026-08-30", "2026-08-31", "2026-09-01", "2026-09-02", "2026-09-03",
  "2026-09-04", "2026-09-05", "2026-09-06", "2026-09-07",
];

export function getSheetLink(lang) {
  return lang === "zh" ? CHINESE_SHEET_LINK : SHEET_LINK;
}

async function fetchSheetRows(lang) {
  const url = lang === "zh"
    ? `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&gid=${CHINESE_SHEET_GID}`
    : `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=English`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Sheet returned ${response.status}`);
  const source = await response.text();
  const start = source.indexOf("{");
  const end = source.lastIndexOf("}");
  if (start < 0 || end < 0) throw new Error("Invalid sheet response");
  const payload = JSON.parse(source.slice(start, end + 1));
  return payload.table.rows || [];
}

const cache = new Map();

export async function getEvents(lang) {
  const key = lang === "zh" ? "zh" : "en";
  const cached = cache.get(key);
  if (cached && Date.now() - cached.loadedAt < 15 * 60 * 1000) return cached.events;
  const [englishRows, chineseRows] = await Promise.all([fetchSheetRows("en"), fetchSheetRows("zh")]);
  const localizedEvents = mergeBilingualEventRows({
    englishRows,
    chineseRows,
    lang: key,
    sheetLinks: { en: SHEET_LINK, zh: CHINESE_SHEET_LINK },
  });
  const events = await enrichEventsWithCampLocations(localizedEvents);
  cache.set(key, { events, loadedAt: Date.now() });
  return events;
}
