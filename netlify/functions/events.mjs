import { getEvents } from "./event-data.mjs";

export default async (request) => {
  try {
    const lang = new URL(request.url).searchParams.get("lang") === "zh" ? "zh" : "en";
    const events = await getEvents(lang);
    return new Response(JSON.stringify({ events, count: events.length }), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "public, max-age=300, s-maxage=900, stale-while-revalidate=86400",
      },
    });
  } catch {
    return new Response(JSON.stringify({ error: "Unable to load events" }), {
      status: 502,
      headers: { "content-type": "application/json" },
    });
  }
};
