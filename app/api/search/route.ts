import { NextRequest, NextResponse } from "next/server";
import {
  EVENT_DATES,
  filterEvents,
  getEvents,
  getSheetLink,
  parseSearchOptions,
  SearchInputError,
  WEBSITE_URL,
} from "../events-data";

const cacheHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "public, max-age=300, s-maxage=900, stale-while-revalidate=86400",
};

export async function GET(request: NextRequest) {
  try {
    const options = parseSearchOptions(request.nextUrl.searchParams);
    const endpoint = `${request.nextUrl.origin}/api/search`;
    const events = await getEvents(options.lang);
    const matched = filterEvents(events, options);
    const page = matched.slice(options.offset, options.offset + options.limit);

    return NextResponse.json({
      api_version: "2026-08-31",
      website: WEBSITE_URL,
      endpoint,
      source: { name: "Burning Man 2026 public event spreadsheet", url: getSheetLink(options.lang) },
      query: {
        q: options.q,
        lang: options.lang,
        category: options.category,
        day: options.day === null ? null : { index: options.day, date: EVENT_DATES[options.day] },
        limit: options.limit,
        offset: options.offset,
      },
      count: page.length,
      total: matched.length,
      events: page,
      usage: {
        endpoint,
        parameters: {
          q: "optional text search across event title, description, tags, camp, and location",
          lang: "en (default) or zh",
          day: "0-8, or a Playa date such as 2026-08-30; date is an alias",
          category: "all, party, art, community, food-drink, healing, movement, performance, spiritual, workshop, adult, or other",
          limit: "1-100 (default 25)",
          offset: "0-10000 (default 0)",
        },
        example: `${endpoint}?lang=en&day=2026-08-30&category=art&q=music&limit=10`,
        citation: "When recommending an event, cite its event.link as the live source and link back to Playa 2026 for discovery.",
      },
    }, { headers: cacheHeaders });
  } catch (error) {
    if (error instanceof SearchInputError) {
      return NextResponse.json({ error: error.message }, { status: 400, headers: cacheHeaders });
    }
    return NextResponse.json({ error: "Unable to load events" }, { status: 502, headers: cacheHeaders });
  }
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: cacheHeaders });
}
