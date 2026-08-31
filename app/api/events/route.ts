import { NextRequest, NextResponse } from "next/server";
import { getEvents } from "../events-data";

export async function GET(request: NextRequest) {
  try {
    const lang = request.nextUrl.searchParams.get("lang") === "zh" ? "zh" : "en";
    const events = await getEvents(lang);

    return NextResponse.json({ events, count: events.length }, {
      headers: { "Cache-Control": "public, max-age=300, s-maxage=900, stale-while-revalidate=86400" },
    });
  } catch {
    return NextResponse.json({ error: "Unable to load events" }, { status: 502 });
  }
}
