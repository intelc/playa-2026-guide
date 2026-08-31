export type SharedPlanPayload = {
  version: 1;
  ids: string[];
  name: string;
  lang: "en" | "zh";
};

export type SharedEventPayload = {
  version: 1;
  id: string;
  day: number;
  name: string;
  lang: "en" | "zh";
};

/**
 * Keep every representation of a shared plan within conservative mobile canvas
 * and URL budgets. A 40-row, 1080px-wide PNG is 6,160px tall rather than an
 * unreliable 16,000px image, and the same cap is applied to the share URL.
 */
export const MAX_SHARED_PLAN_EVENTS = 40;
const MAX_SHARED_NAME_LENGTH = 32;
const EVENT_UID_PATTERN = /^[A-Za-z0-9_-]{1,80}$/;

function uniqueValidIds(ids: Iterable<string>) {
  const unique = new Set<string>();
  for (const id of ids) {
    const trimmedId = id.trim();
    if (!EVENT_UID_PATTERN.test(trimmedId)) continue;
    unique.add(trimmedId);
    if (unique.size === MAX_SHARED_PLAN_EVENTS) break;
  }
  return [...unique];
}

function normalizeName(name: string | null | undefined) {
  return (name || "").trim().slice(0, MAX_SHARED_NAME_LENGTH);
}

export function createSharedPlanUrl({
  origin,
  ids,
  name,
  lang,
}: {
  origin: string;
  ids: Iterable<string>;
  name?: string;
  lang: "en" | "zh";
}) {
  const url = new URL("/", origin);
  const safeIds = uniqueValidIds(ids);
  url.searchParams.set("p", "1");
  url.searchParams.set("e", safeIds.join("."));
  const safeName = normalizeName(name);
  if (safeName) url.searchParams.set("by", safeName);
  url.searchParams.set("lang", lang);
  return url.toString();
}

export function parseSharedPlanUrl(input: string | URL): SharedPlanPayload | null {
  let url: URL;
  try {
    url = input instanceof URL ? input : new URL(input);
  } catch {
    return null;
  }
  if (url.searchParams.get("p") !== "1") return null;

  const encodedIds = url.searchParams.get("e");
  if (!encodedIds) return null;
  const ids = uniqueValidIds(encodedIds.split("."));
  if (!ids.length) return null;

  return {
    version: 1,
    ids,
    name: normalizeName(url.searchParams.get("by")),
    lang: url.searchParams.get("lang") === "zh" ? "zh" : "en",
  };
}

export function createSharedEventUrl({
  origin,
  id,
  day,
  name,
  lang,
}: {
  origin: string;
  id: string;
  day: number;
  name?: string;
  lang: "en" | "zh";
}) {
  const url = new URL("/", origin);
  const [safeId] = uniqueValidIds([id]);
  url.searchParams.set("event", "1");
  url.searchParams.set("e", safeId || "");
  url.searchParams.set("d", String(Math.max(0, Math.min(8, Math.trunc(day)))));
  const safeName = normalizeName(name);
  if (safeName) url.searchParams.set("by", safeName);
  url.searchParams.set("lang", lang);
  return url.toString();
}

export function parseSharedEventUrl(input: string | URL): SharedEventPayload | null {
  let url: URL;
  try {
    url = input instanceof URL ? input : new URL(input);
  } catch {
    return null;
  }
  if (url.searchParams.get("event") !== "1") return null;

  const [id] = uniqueValidIds([url.searchParams.get("e") || ""]);
  if (!id) return null;
  const parsedDay = Number(url.searchParams.get("d"));
  const day = Number.isInteger(parsedDay) && parsedDay >= 0 && parsedDay <= 8 ? parsedDay : 0;

  return {
    version: 1,
    id,
    day,
    name: normalizeName(url.searchParams.get("by")),
    lang: url.searchParams.get("lang") === "zh" ? "zh" : "en",
  };
}
