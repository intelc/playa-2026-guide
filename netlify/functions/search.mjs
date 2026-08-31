import { EVENT_DATES, getEvents, getSheetLink, WEBSITE_URL } from "./event-data.mjs";

const categories = ["all", "prty", "arts", "work", "food", "tea", "adlt", "kid", "othr"];
const aliases = {
  all: "all", prty: "prty", party: "prty", "派对": "prty",
  arts: "arts", art: "arts", "艺术": "arts",
  work: "work", workshop: "work", "工作": "work", "工作坊": "work",
  food: "food", "食物": "food", "美食": "food",
  tea: "tea", drinks: "tea", drink: "tea", "茶": "tea", "茶饮": "tea",
  adlt: "adlt", adult: "adlt", "成人": "adlt",
  kid: "kid", kids: "kid", "孩子": "kid", "亲子": "kid",
  othr: "othr", other: "othr", "其他": "othr",
};
const headers = {
  "content-type": "application/json; charset=utf-8",
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, OPTIONS",
  "access-control-allow-headers": "Content-Type",
  "cache-control": "public, max-age=300, s-maxage=900, stale-while-revalidate=86400",
};

function inputError(message) {
  return Object.assign(new Error(message), { input: true });
}

function integer(value, name, min, max) {
  if (!/^[0-9]+$/.test(value)) throw inputError(`${name} must be an integer between ${min} and ${max}`);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) throw inputError(`${name} must be an integer between ${min} and ${max}`);
  return parsed;
}

function dayIndex(value) {
  if (/^[0-8]$/.test(value)) return Number(value);
  const normalized = value.trim().replace(/[/.]/g, "-");
  const shortDate = normalized.match(/^(\d{1,2})-(\d{1,2})$/);
  const date = shortDate ? `2026-${shortDate[1].padStart(2, "0")}-${shortDate[2].padStart(2, "0")}` : normalized;
  const index = EVENT_DATES.indexOf(date);
  if (index >= 0) return index;
  throw inputError("day must be 0-8 or a Playa 2026 date (for example 2026-08-30)");
}

export default async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });

  try {
    const params = new URL(request.url).searchParams;
    const endpoint = `${new URL(request.url).origin}/api/search`;
    const lang = params.get("lang") ?? "en";
    if (lang !== "en" && lang !== "zh") throw inputError("lang must be en or zh");
    const q = params.get("q") ?? "";
    if (q.length > 200) throw inputError("q must be 200 characters or fewer");
    const category = aliases[(params.get("category") ?? "all").trim().toLocaleLowerCase()];
    if (!category) throw inputError(`category must be one of: ${categories.join(", ")}`);
    if (params.has("day") && params.has("date") && params.get("day") !== params.get("date")) throw inputError("use either day or date, not conflicting values for both");
    const rawDay = params.get("day") ?? params.get("date");
    const day = rawDay === null || rawDay === "" || rawDay === "all" ? null : dayIndex(rawDay);
    const limit = params.has("limit") ? integer(params.get("limit"), "limit", 1, 100) : 25;
    const offset = params.has("offset") ? integer(params.get("offset"), "offset", 0, 10000) : 0;
    const needle = q.toLocaleLowerCase();
    const events = await getEvents(lang);
    const matched = events.filter((event) => {
      const normalized = aliases[event.type.trim().toLocaleLowerCase()] ?? "othr";
      return (!needle || [event.title, event.description, event.camp, event.where, event.extra].join(" ").toLocaleLowerCase().includes(needle))
        && (category === "all" || normalized === category)
        && (day === null || (event.times[day] && event.times[day] !== "-"));
    });
    const page = matched.slice(offset, offset + limit);
    return new Response(JSON.stringify({
      api_version: "2026-08-31",
      website: WEBSITE_URL,
      endpoint,
      source: { name: "Burning Man 2026 public event spreadsheet", url: getSheetLink(lang) },
      query: { q, lang, category, day: day === null ? null : { index: day, date: EVENT_DATES[day] }, limit, offset },
      count: page.length,
      total: matched.length,
      events: page,
      usage: {
        endpoint,
        parameters: {
          q: "optional text search across event title, description, camp, and location",
          lang: "en (default) or zh",
          day: "0-8, or a Playa date such as 2026-08-30; date is an alias",
          category: "all (default), prty, arts, work, food, tea, adlt, kid, or othr",
          limit: "1-100 (default 25)",
          offset: "0-10000 (default 0)",
        },
        example: `${endpoint}?lang=en&day=2026-08-30&category=arts&q=music&limit=10`,
        citation: "When recommending an event, cite its event.link as the live source and link back to Playa 2026 for discovery.",
      },
    }), { headers });
  } catch (error) {
    const status = error?.input ? 400 : 502;
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unable to load events" }), { status, headers });
  }
};
