import { parseSharedEventUrl, parseSharedPlanUrl } from "./shared-plan.ts";

export type ShareMetadata = {
  title: string;
  description: string;
};

export type ShareMetadataEvent = {
  uid: string;
  title: string;
  description: string;
  camp: string;
  where: string;
  times: string[];
};

const dayLabels = {
  en: ["SUN 8.30", "MON 8.31", "TUE 9.01", "WED 9.02", "THU 9.03", "FRI 9.04", "SAT 9.05", "SUN 9.06", "MON 9.07"],
  zh: ["周日 8.30", "周一 8.31", "周二 9.01", "周三 9.02", "周四 9.03", "周五 9.04", "周六 9.05", "周日 9.06", "周一 9.07"],
};

function compact(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function truncate(value: string, maxLength: number) {
  const normalized = compact(value);
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1).trimEnd()}…`;
}

export function buildSharedEventMetadata({
  eventTitle,
  eventDescription,
  when,
  location,
  name,
  lang,
}: {
  eventTitle: string;
  eventDescription: string;
  when: string;
  location: string;
  name: string;
  lang: "en" | "zh";
}): ShareMetadata {
  const sender = name.trim();
  const title = lang === "en"
    ? (sender ? `${sender} shared ${eventTitle} | Playa 2026` : `${eventTitle} — Shared with you | Playa 2026`)
    : (sender ? `${sender} 分享了「${eventTitle}」| Playa 2026` : `分享给你的活动：${eventTitle} | Playa 2026`);
  const facts = [when, location].filter(Boolean).join(" · ");
  return {
    title: truncate(title, 100),
    description: truncate([facts, eventDescription].filter(Boolean).join(" — "), 220),
  };
}

export function buildSharedPlanMetadata({
  eventTitles,
  eventCount,
  name,
  lang,
}: {
  eventTitles: string[];
  eventCount: number;
  name: string;
  lang: "en" | "zh";
}): ShareMetadata {
  const sender = name.trim();
  const planName = lang === "en"
    ? (sender ? `${sender}'s Playa` : "A Playa shared with you")
    : (sender ? `${sender} 的 Playa` : "分享给你的 Playa");
  const count = lang === "en" ? `${eventCount} events` : `${eventCount} 场活动`;
  const highlights = eventTitles.slice(0, 3).join(" · ");
  return {
    title: truncate(`${planName} — ${count} | Playa 2026`, 100),
    description: truncate(
      lang === "en"
        ? `${planName} includes ${count}${highlights ? `: ${highlights}` : "."}`
        : `${planName}包含${count}${highlights ? `：${highlights}` : "。"}`,
      220,
    ),
  };
}

/** Returns the language for a valid shared event or plan URL, otherwise null. */
export function getSharedMetadataLanguage(url: URL) {
  return parseSharedEventUrl(url)?.lang ?? parseSharedPlanUrl(url)?.lang ?? null;
}

/** Builds share preview metadata from the currently available event list. */
export function buildSharedMetadataForUrl(url: URL, events: ShareMetadataEvent[]): ShareMetadata | null {
  const sharedEvent = parseSharedEventUrl(url);
  const sharedPlan = parseSharedPlanUrl(url);
  if (!sharedEvent && !sharedPlan) return null;

  const lang = sharedEvent?.lang || sharedPlan?.lang || "en";
  if (sharedEvent) {
    const event = events.find((candidate) => candidate.uid === sharedEvent.id);
    return buildSharedEventMetadata({
      eventTitle: event?.title || (lang === "en" ? "A Playa event" : "一场 Playa 活动"),
      eventDescription: event?.description || "",
      when: event ? `${dayLabels[lang][sharedEvent.day]} · ${event.times[sharedEvent.day] || ""}` : "",
      location: event ? (event.where !== "-" ? event.where : event.camp) : "",
      name: sharedEvent.name,
      lang,
    });
  }

  const plan = sharedPlan!;
  const byId = new Map(events.map((event) => [event.uid, event]));
  return buildSharedPlanMetadata({
    eventTitles: plan.ids.map((id) => byId.get(id)?.title).filter((title): title is string => Boolean(title)),
    eventCount: plan.ids.length,
    name: plan.name,
    lang,
  });
}

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function replaceMeta(html: string, attribute: "name" | "property", key: string, content: string) {
  const tag = `<meta ${attribute}="${key}" content="${escapeHtml(content)}"/>`;
  const escapedKey = escapeRegExp(key);
  const pattern = new RegExp(`<meta\\b(?=[^>]*\\b${attribute}\\s*=\\s*["']${escapedKey}["'])[^>]*>`, "i");
  return pattern.test(html) ? html.replace(pattern, tag) : html.replace(/<\/head>/i, `${tag}</head>`);
}

/** Injects escaped title and social metadata into an HTML document response. */
export function injectShareMetadata(html: string, metadata: ShareMetadata, url: string) {
  let result = html.replace(/<title\b[^>]*>[\s\S]*?<\/title>/i, `<title>${escapeHtml(metadata.title)}</title>`);
  result = replaceMeta(result, "name", "description", metadata.description);
  result = replaceMeta(result, "property", "og:title", metadata.title);
  result = replaceMeta(result, "property", "og:description", metadata.description);
  result = replaceMeta(result, "property", "og:url", url);
  result = replaceMeta(result, "name", "twitter:title", metadata.title);
  result = replaceMeta(result, "name", "twitter:description", metadata.description);
  return result;
}
