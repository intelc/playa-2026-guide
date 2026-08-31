import assert from "node:assert/strict";
import test from "node:test";
import {
  buildSharedEventMetadata,
  buildSharedMetadataForUrl,
  buildSharedPlanMetadata,
  getSharedMetadataLanguage,
  injectShareMetadata,
} from "../lib/share-metadata.ts";

test("event metadata names the sender and event while summarizing useful details", () => {
  assert.deepEqual(buildSharedEventMetadata({
    eventTitle: "Sunrise Tea",
    eventDescription: "Tea and a quiet sunrise.",
    when: "MON 8.31 · 06:00-07:00",
    location: "Tea Camp",
    name: "Intel",
    lang: "en",
  }), {
    title: "Intel shared Sunrise Tea | Playa 2026",
    description: "MON 8.31 · 06:00-07:00 · Tea Camp — Tea and a quiet sunrise.",
  });
});

test("plan metadata includes the sender, count, and event highlights", () => {
  assert.deepEqual(buildSharedPlanMetadata({
    eventTitles: ["Sunrise Tea", "Dusty Disco"],
    eventCount: 2,
    name: "Intel",
    lang: "en",
  }), {
    title: "Intel's Playa — 2 events | Playa 2026",
    description: "Intel's Playa includes 2 events: Sunrise Tea · Dusty Disco",
  });
});

test("resolves shared-event metadata and language from the URL", () => {
  const url = new URL("https://playa.intelchen.com/?event=1&e=sunrise-1&d=1&by=Intel&lang=en");
  assert.equal(getSharedMetadataLanguage(url), "en");
  assert.deepEqual(buildSharedMetadataForUrl(url, [{
    uid: "sunrise-1",
    title: "Sunrise Tea",
    description: "Tea and a quiet sunrise.",
    camp: "Tea Camp",
    where: "-",
    times: ["-", "06:00-07:00"],
  }]), {
    title: "Intel shared Sunrise Tea | Playa 2026",
    description: "MON 8.31 · 06:00-07:00 · Tea Camp — Tea and a quiet sunrise.",
  });
});

test("injects escaped social metadata regardless of meta attribute order", () => {
  const html = "<html><head><title>Playa</title><meta content=\"old\" property=\"og:title\"><meta name=\"description\" content=\"old\"></head><body></body></html>";
  const result = injectShareMetadata(html, {
    title: "Intel's <Playa>",
    description: "A & B",
  }, "https://playa.intelchen.com/?event=1");

  assert.match(result, /<title>Intel&#39;s &lt;Playa&gt;<\/title>/);
  assert.match(result, /<meta property="og:title" content="Intel&#39;s &lt;Playa&gt;"\/>/);
  assert.match(result, /<meta name="description" content="A &amp; B"\/>/);
  assert.match(result, /<meta property="og:url" content="https:\/\/playa\.intelchen\.com\/\?event=1"\/>/);
});
