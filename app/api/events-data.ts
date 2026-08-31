export const WEBSITE_URL = "https://playa.intelchen.com";
export const SHEET_ID = "1KEXPq567lHtESUXdtt1CLzXJNSFc1318cT1yNv8nzg8";
export const SHEET_LINK = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit?gid=0#gid=0`;
export const EVENT_DATES = [
  "2026-08-30", "2026-08-31", "2026-09-01", "2026-09-02", "2026-09-03",
  "2026-09-04", "2026-09-05", "2026-09-06", "2026-09-07",
] as const;
export const CATEGORY_KEYS = ["all", "prty", "arts", "work", "food", "tea", "adlt", "kid", "othr"] as const;

export type EventLanguage = "en" | "zh";
export type EventCategory = (typeof CATEGORY_KEYS)[number];
export type EventItem = {
  uid: string;
  title: string;
  description: string;
  type: string;
  camp: string;
  where: string;
  extra: string;
  link: string;
  times: string[];
};

type Cell = { v?: string | number | null } | null;
type SheetRow = { c?: Cell[] };

const categoryAliases: Record<string, EventCategory> = {
  all: "all", prty: "prty", party: "prty", "派对": "prty",
  arts: "arts", art: "arts", "艺术": "arts",
  work: "work", workshop: "work", "工作": "work", "工作坊": "work",
  food: "food", "食物": "food", "美食": "food",
  tea: "tea", drinks: "tea", drink: "tea", "茶": "tea", "茶饮": "tea",
  adlt: "adlt", adult: "adlt", "成人": "adlt",
  kid: "kid", kids: "kid", "孩子": "kid", "亲子": "kid",
  othr: "othr", other: "othr", "其他": "othr",
};

function value(row: SheetRow, index: number) {
  const raw = row.c?.[index]?.v;
  return raw === null || raw === undefined || raw === "" ? "-" : String(raw);
}

export function normalizeCategory(type: string): EventCategory {
  return categoryAliases[type.trim().toLocaleLowerCase()] ?? "othr";
}

export function filterEvents(events: EventItem[], options: { q: string; category: EventCategory; day: number | null }) {
  const needle = options.q.toLocaleLowerCase();
  return events.filter((event) => {
    const matchesQuery = !needle || [event.title, event.description, event.camp, event.where, event.extra]
      .join(" ").toLocaleLowerCase().includes(needle);
    const matchesCategory = options.category === "all" || normalizeCategory(event.type) === options.category;
    const matchesDay = options.day === null || (event.times[options.day] && event.times[options.day] !== "-");
    return matchesQuery && matchesCategory && matchesDay;
  });
}

export type SearchOptions = {
  q: string;
  lang: EventLanguage;
  category: EventCategory;
  day: number | null;
  limit: number;
  offset: number;
};

export class SearchInputError extends Error {}

function invalid(message: string): never {
  throw new SearchInputError(message);
}

function parseInteger(value: string, name: string, min: number, max: number) {
  if (!/^[0-9]+$/.test(value)) invalid(`${name} must be an integer between ${min} and ${max}`);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) invalid(`${name} must be an integer between ${min} and ${max}`);
  return parsed;
}

function parseDay(value: string) {
  if (/^[0-8]$/.test(value)) return Number(value);
  const normalized = value.trim().replace(/[/.]/g, "-");
  const shortDate = normalized.match(/^(\d{1,2})-(\d{1,2})$/);
  const date = shortDate
    ? `2026-${shortDate[1].padStart(2, "0")}-${shortDate[2].padStart(2, "0")}`
    : normalized;
  const dateIndex = EVENT_DATES.indexOf(date as (typeof EVENT_DATES)[number]);
  if (dateIndex >= 0) return dateIndex;
  return invalid("day must be 0-8 or a Playa 2026 date (for example 2026-08-30)");
}

/** Parses the public /api/search query string. Kept separate for endpoint tests. */
export function parseSearchOptions(params: URLSearchParams): SearchOptions {
  const rawLang = params.get("lang") ?? "en";
  if (rawLang !== "en" && rawLang !== "zh") invalid("lang must be en or zh");

  const q = params.get("q") ?? "";
  if (q.length > 200) invalid("q must be 200 characters or fewer");

  const rawCategory = (params.get("category") ?? "all").trim().toLocaleLowerCase();
  const category = categoryAliases[rawCategory];
  if (!category) invalid(`category must be one of: ${CATEGORY_KEYS.join(", ")}`);

  const dayValue = params.get("day") ?? params.get("date");
  if (params.has("day") && params.has("date") && params.get("day") !== params.get("date")) {
    invalid("use either day or date, not conflicting values for both");
  }

  return {
    q,
    lang: rawLang,
    category,
    day: dayValue === null || dayValue === "" || dayValue === "all" ? null : parseDay(dayValue),
    limit: params.has("limit") ? parseInteger(params.get("limit")!, "limit", 1, 100) : 25,
    offset: params.has("offset") ? parseInteger(params.get("offset")!, "offset", 0, 10000) : 0,
  };
}

async function fetchSheet(sheet: "English" | "Chinese"): Promise<EventItem[]> {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${sheet}`;
  const response = await fetch(url, { next: { revalidate: 900 } });
  if (!response.ok) throw new Error(`Sheet returned ${response.status}`);
  const source = await response.text();
  const start = source.indexOf("{");
  const end = source.lastIndexOf("}");
  if (start < 0 || end < 0) throw new Error("Invalid sheet response");
  const payload = JSON.parse(source.slice(start, end + 1));
  const rows: SheetRow[] = payload.table.rows || [];

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

export function getEvents(lang: EventLanguage) {
  return fetchSheet(lang === "zh" ? "Chinese" : "English");
}
