const SHEET_SCHEMAS = {
  en: {
    headerRows: 1,
    title: 9,
    description: 10,
    category: 11,
    tags: 12,
    camp: 13,
    where: 14,
    extra: 15,
    link: 16,
    uid: 17,
  },
  zh: {
    headerRows: 2,
    title: 9,
    description: 11,
    category: 12,
    tags: 13,
    camp: 14,
    where: 15,
    extra: 16,
    link: 17,
    uid: 18,
  },
};

function value(row, index) {
  const raw = row?.c?.[index]?.v;
  return raw === null || raw === undefined || raw === "" ? "-" : String(raw).trim();
}

function tags(row, index) {
  const raw = value(row, index);
  return raw === "-" ? [] : raw.split("|").map((tag) => tag.trim()).filter(Boolean);
}

export function normalizeEventUrl(rawUrl) {
  if (!rawUrl || rawUrl === "-") return null;
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    url.protocol = "https:";
    url.hostname = url.hostname.toLocaleLowerCase();
    for (const key of [...url.searchParams.keys()]) {
      if (/^utm_/i.test(key)) url.searchParams.delete(key);
    }
    url.searchParams.sort();
    if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, "");
    return url.toString();
  } catch {
    return null;
  }
}

export function parseEventRows(rows, lang) {
  const schema = SHEET_SCHEMAS[lang === "zh" ? "zh" : "en"];
  return rows.slice(schema.headerRows).map((row) => ({
    times: Array.from({ length: 9 }, (_, index) => value(row, index)),
    title: value(row, schema.title),
    description: value(row, schema.description),
    category: value(row, schema.category),
    tags: tags(row, schema.tags),
    camp: value(row, schema.camp),
    where: value(row, schema.where),
    extra: value(row, schema.extra),
    link: value(row, schema.link),
    uid: value(row, schema.uid),
  })).filter((event) => event.uid !== "-" && event.title !== "-");
}

function countUrls(events) {
  const counts = new Map();
  for (const event of events) {
    const url = normalizeEventUrl(event.link);
    if (url) counts.set(url, (counts.get(url) || 0) + 1);
  }
  return counts;
}

function indexEvents(events) {
  const byUrl = new Map();
  const byUid = new Map();
  for (const event of events) {
    const url = normalizeEventUrl(event.link);
    if (url) byUrl.set(url, event);
    if (event.uid && event.uid !== "-") byUid.set(event.uid, event);
  }
  return { byUrl, byUid };
}

export function mergeBilingualEventRows({ englishRows, chineseRows, lang, sheetLinks }) {
  const englishEvents = parseEventRows(englishRows, "en");
  const chineseEvents = parseEventRows(chineseRows, "zh");
  const englishUrlCounts = countUrls(englishEvents);
  const chineseUrlCounts = countUrls(chineseEvents);
  const chineseIndex = indexEvents(chineseEvents);

  return englishEvents.map((englishEvent) => {
    const canonicalUrl = normalizeEventUrl(englishEvent.link);
    const urlIsUnique = canonicalUrl
      && englishUrlCounts.get(canonicalUrl) === 1
      && chineseUrlCounts.get(canonicalUrl) === 1;
    const chineseEvent = (urlIsUnique ? chineseIndex.byUrl.get(canonicalUrl) : undefined)
      || chineseIndex.byUid.get(englishEvent.uid);
    const localizedEvent = lang === "zh" && chineseEvent ? chineseEvent : englishEvent;
    const resolvedUrl = canonicalUrl || normalizeEventUrl(localizedEvent.link);

    return {
      ...localizedEvent,
      uid: englishEvent.uid,
      link: resolvedUrl || sheetLinks[lang === "zh" ? "zh" : "en"],
      canonicalUrl: resolvedUrl,
      matchKey: resolvedUrl ? `url:${resolvedUrl}` : `uid:${englishEvent.uid}`,
    };
  });
}
