import { NextRequest, NextResponse } from "next/server";

const SHEET_ID = "1KEXPq567lHtESUXdtt1CLzXJNSFc1318cT1yNv8nzg8";
const SHEET_LINK = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit?gid=0#gid=0`;

type Cell = { v?: string | number | null } | null;
type SheetRow = { c?: Cell[] };

type EventItem = {
  uid: string;
  title: string;
  description: string;
  type: string;
  camp: string;
  where: string;
  extra: string;
  link: string;
  times: string[];
};

function value(row: SheetRow, index: number) {
  const raw = row.c?.[index]?.v;
  return raw === null || raw === undefined || raw === "" ? "-" : String(raw);
}

async function fetchSheet(sheet: "English" | "Chinese") {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${sheet}`;
  const response = await fetch(url, { next: { revalidate: 900 } });
  if (!response.ok) throw new Error(`Sheet returned ${response.status}`);
  const source = await response.text();
  const start = source.indexOf("{");
  const end = source.lastIndexOf("}");
  if (start < 0 || end < 0) throw new Error("Invalid sheet response");
  const payload = JSON.parse(source.slice(start, end + 1));
  const rows: SheetRow[] = payload.table.rows || [];

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

export async function GET(request: NextRequest) {
  try {
    const lang = request.nextUrl.searchParams.get("lang") === "zh" ? "zh" : "en";
    const english = await fetchSheet("English");
    let events: EventItem[] = english;

    if (lang === "zh") {
      events = await fetchSheet("Chinese");
    }

    return NextResponse.json({ events, count: events.length }, {
      headers: { "Cache-Control": "public, max-age=300, s-maxage=900, stale-while-revalidate=86400" },
    });
  } catch {
    return NextResponse.json({ error: "Unable to load events" }, { status: 502 });
  }
}
