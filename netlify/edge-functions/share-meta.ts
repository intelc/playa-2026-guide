import type { Config, Context } from "@netlify/edge-functions";
import {
  buildSharedMetadataForUrl,
  getSharedMetadataLanguage,
  injectShareMetadata,
  type ShareMetadataEvent,
} from "../../lib/share-metadata.ts";

async function loadEvents(url: URL, lang: "en" | "zh") {
  const apiUrl = new URL(`/api/events?lang=${lang}`, url.origin);
  const response = await fetch(apiUrl, { headers: { accept: "application/json" } });
  if (!response.ok) return [];
  const payload = await response.json();
  return Array.isArray(payload?.events) ? payload.events as ShareMetadataEvent[] : [];
}

export default async function shareMetadata(request: Request, context: Context) {
  const url = new URL(request.url);
  const lang = getSharedMetadataLanguage(url);
  if (!lang) return;
  const [response, events] = await Promise.all([context.next(), loadEvents(url, lang).catch(() => [])]);
  if (!response.headers.get("content-type")?.includes("text/html")) return response;
  const metadata = buildSharedMetadataForUrl(url, events);
  if (!metadata) return response;
  const html = injectShareMetadata(await response.text(), metadata, url.toString());
  const headers = new Headers(response.headers);
  headers.delete("content-length");
  headers.delete("content-encoding");
  return new Response(html, { status: response.status, statusText: response.statusText, headers });
}

export const config: Config = { path: "/", onError: "bypass" };
