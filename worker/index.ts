/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import {
  buildSharedMetadataForUrl,
  getSharedMetadataLanguage,
  injectShareMetadata,
  type ShareMetadataEvent,
} from "../lib/share-metadata";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

async function loadShareEvents(url: URL, lang: "en" | "zh", env: Env, ctx: ExecutionContext) {
  const apiUrl = new URL(`/api/events?lang=${lang}`, url.origin);
  const response = await handler.fetch(new Request(apiUrl, { headers: { accept: "application/json" } }), env, ctx);
  if (!response.ok) return [];
  const payload = await response.json();
  return Array.isArray(payload?.events) ? payload.events as ShareMetadataEvent[] : [];
}

async function withSharedMetadata(request: Request, env: Env, ctx: ExecutionContext, url: URL) {
  const lang = getSharedMetadataLanguage(url);
  if (!lang) return handler.fetch(request, env, ctx);

  const [response, events] = await Promise.all([
    handler.fetch(request, env, ctx),
    loadShareEvents(url, lang, env, ctx).catch(() => []),
  ]);
  if (!response.headers.get("content-type")?.includes("text/html")) return response;

  const metadata = buildSharedMetadataForUrl(url, events);
  if (!metadata) return response;
  const headers = new Headers(response.headers);
  headers.delete("content-length");
  headers.delete("content-encoding");
  return new Response(injectShareMetadata(await response.text(), metadata, url.toString()), {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    return withSharedMetadata(request, env, ctx, url);
  },
};

export default worker;
