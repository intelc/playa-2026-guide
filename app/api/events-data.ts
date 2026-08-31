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
  /** 2026 official camp coordinate when the camp name has an unambiguous match. */
  location?: EventLocation;
};

export type EventLocation = {
  source: "camp";
  label_point: { longitude: number; latitude: number };
  playa_address?: string;
  playa_address_source?: "official_2026_camp_api" | "curated_2026_lookup" | "official_2026_gis_inference";
  playa_address_confidence?: "high" | "reviewed" | "approximate";
  playa_address_distance_m?: number;
  playa_address_checked_at?: string;
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

export function getSheetLink(lang: EventLanguage) {
  return lang === "zh" ? CHINESE_SHEET_LINK : SHEET_LINK;
}

async function fetchSheetRows(lang: EventLanguage): Promise<SheetRow[]> {
  const url = lang === "zh"
    ? `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&gid=${CHINESE_SHEET_GID}`
    : `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=English`;
  const response = await fetch(url, { next: { revalidate: 900 } });
  if (!response.ok) throw new Error(`Sheet returned ${response.status}`);
  const source = await response.text();
  const start = source.indexOf("{");
  const end = source.lastIndexOf("}");
  if (start < 0 || end < 0) throw new Error("Invalid sheet response");
  const payload = JSON.parse(source.slice(start, end + 1));
  return payload.table.rows || [];
}

export async function getEvents(lang: EventLanguage): Promise<EventItem[]> {
  const [englishRows, chineseRows] = await Promise.all([fetchSheetRows("en"), fetchSheetRows("zh")]);
  const events = mergeBilingualEventRows({
    englishRows,
    chineseRows,
    lang,
    sheetLinks: { en: SHEET_LINK, zh: CHINESE_SHEET_LINK },
  }) as EventItem[];
  return enrichEventsWithCampLocations(events) as Promise<EventItem[]>;
}
