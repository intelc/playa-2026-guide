import assert from "node:assert/strict";
import test from "node:test";
import {
  SearchInputError,
  filterEvents,
  parseSearchOptions,
} from "../app/api/events-data.ts";

const events = [
  {
    uid: "sunrise-1", title: "Sunrise music", description: "Ambient art at dawn", category: "Art", tags: ["light_visuals", "sunrise"],
    camp: "Dawn Camp", where: "6:30 & E", extra: "", link: "https://example.com/sunrise",
    times: ["06:00", "-", "-", "-", "-", "-", "-", "-", "-"],
  },
  {
    uid: "tea-1", title: "Tea ceremony", description: "A quiet place", category: "食饮", tags: ["茶道"],
    camp: "Tea House", where: "Center Camp", extra: "", link: "https://example.com/tea",
    times: ["-", "14:00", "-", "-", "-", "-", "-", "-", "-"],
  },
];

test("search options accept the documented date, filter, and pagination parameters", () => {
  const options = parseSearchOptions(new URLSearchParams("lang=zh&day=2026-08-30&category=art&q=sunrise&limit=10&offset=2"));
  assert.deepEqual(options, { q: "sunrise", lang: "zh", category: "art", day: 0, limit: 10, offset: 2 });
  assert.equal(parseSearchOptions(new URLSearchParams("date=2026-09-07")).day, 8);
  assert.equal(parseSearchOptions(new URLSearchParams("day=9.7")).day, 8);
});

test("search rejects invalid public API input instead of coercing it", () => {
  for (const query of ["lang=fr", "day=9", "category=music", "limit=101", "offset=-1", "day=0&date=1"]) {
    assert.throws(() => parseSearchOptions(new URLSearchParams(query)), SearchInputError, query);
  }
});

test("search filtering uses the same category aliases, query fields, and day availability as the UI", () => {
  assert.deepEqual(
    filterEvents(events, { q: "light visuals", category: "art", day: 0 }).map((event) => event.uid),
    ["sunrise-1"],
  );
  assert.deepEqual(
    filterEvents(events, { q: "茶道", category: "food-drink", day: 1 }).map((event) => event.uid),
    ["tea-1"],
  );
});
