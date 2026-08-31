const SHEET_ID = "1KEXPq567lHtESUXdtt1CLzXJNSFc1318cT1yNv8nzg8";
const SHEET_LINK = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit?gid=0#gid=0`;
let cache;

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

async function getCatalog() {
  if (cache && Date.now() - cache.loadedAt < 15 * 60 * 1000) return cache;
  const [english, chinese] = await Promise.all([fetchSheet("English"), fetchSheet("Chinese")]);
  cache = { english, chinese: new Map(chinese.map((event) => [event.uid, event])), loadedAt: Date.now() };
  return cache;
}

export default async (request) => {
  try {
    const lang = new URL(request.url).searchParams.get("lang") === "zh" ? "zh" : "en";
    const catalog = await getCatalog();
    const events = lang === "zh"
      ? catalog.english.map((event) => {
          const translated = catalog.chinese.get(event.uid);
          return translated ? { ...event, ...translated, times: event.times } : event;
        })
      : catalog.english;
    return new Response(JSON.stringify({ events, count: events.length }), {
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=300, s-maxage=900, stale-while-revalidate=86400" },
    });
  } catch {
    return new Response(JSON.stringify({ error: "Unable to load events" }), { status: 502, headers: { "content-type": "application/json" } });
  }
};
