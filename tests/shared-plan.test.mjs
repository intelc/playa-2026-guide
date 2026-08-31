import assert from "node:assert/strict";
import test from "node:test";
import {
  createSharedEventUrl,
  createSharedPlanUrl,
  MAX_SHARED_PLAN_EVENTS,
  parseSharedEventUrl,
  parseSharedPlanUrl,
} from "../lib/shared-plan.ts";

test("shared plan links round-trip event IDs, sender name, and language", () => {
  const url = createSharedPlanUrl({
    origin: "https://playa.intelchen.com/events?old=ignored",
    ids: ["event_abc-123", "eventXYZ456"],
    name: " Intel ",
    lang: "zh",
  });

  assert.equal(url, "https://playa.intelchen.com/?p=1&e=event_abc-123.eventXYZ456&by=Intel&lang=zh");
  assert.deepEqual(parseSharedPlanUrl(url), {
    version: 1,
    ids: ["event_abc-123", "eventXYZ456"],
    name: "Intel",
    lang: "zh",
  });
});

test("shared plan links deduplicate, validate, and cap event IDs", () => {
  const ids = ["first", "first", "not.valid", ...Array.from({ length: 150 }, (_, index) => `event-${index}`)];
  const parsed = parseSharedPlanUrl(createSharedPlanUrl({
    origin: "https://playa.intelchen.com",
    ids,
    name: "A".repeat(40),
    lang: "en",
  }));

  assert.ok(parsed);
  assert.equal(parsed.ids.length, MAX_SHARED_PLAN_EVENTS);
  assert.equal(MAX_SHARED_PLAN_EVENTS, 40, "shared links and generated share cards use the same mobile-safe limit");
  assert.equal(parsed.ids[0], "first");
  assert.equal(parsed.ids.includes("not.valid"), false);
  assert.equal(parsed.name.length, 32);
});

test("shared plan parser rejects missing, unsupported, or empty payloads", () => {
  assert.equal(parseSharedPlanUrl("https://playa.intelchen.com/"), null);
  assert.equal(parseSharedPlanUrl("https://playa.intelchen.com/?p=2&e=event-1"), null);
  assert.equal(parseSharedPlanUrl("https://playa.intelchen.com/?p=1&e=..."), null);
  assert.equal(parseSharedPlanUrl("not a url"), null);
});

test("single-event links round-trip the event, occurrence, sender, and language", () => {
  const url = createSharedEventUrl({
    origin: "https://playa.intelchen.com",
    id: "event_abc-123",
    day: 4,
    name: "Intel",
    lang: "en",
  });

  assert.equal(url, "https://playa.intelchen.com/?event=1&e=event_abc-123&d=4&by=Intel&lang=en");
  assert.deepEqual(parseSharedEventUrl(url), {
    version: 1,
    id: "event_abc-123",
    day: 4,
    name: "Intel",
    lang: "en",
  });
});

test("single-event parser rejects invalid IDs and safely normalizes invalid days", () => {
  assert.equal(parseSharedEventUrl("https://playa.intelchen.com/?event=1&e=not.valid&d=3"), null);
  assert.equal(parseSharedEventUrl("https://playa.intelchen.com/?event=1&e=valid-id&d=99")?.day, 0);
});
