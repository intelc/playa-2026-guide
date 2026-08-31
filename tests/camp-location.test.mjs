import assert from "node:assert/strict";
import test from "node:test";
import {
  addPlayaAddress,
  CAMP_API_URL,
  CAMP_CACHE_TTL_MS,
  createCampAddressIndex,
  createCampLocationResolver,
  enrichEventsWithCampLocations,
  getCampAddressIndex,
  getCampLocationResolver,
  MINIMUM_VALID_CAMP_FEATURES,
  normalizeCampName,
  polygonLabelPoint,
  resetCampLocationCachesForTest,
  validateCampGeojson,
} from "../lib/camp-location.mjs";
import {
  createStaticCampAddressIndex,
  curatedCampAddressIndex2026,
  inferredCampAddressIndex2026,
} from "../lib/camp-address-lookups.mjs";
import { inferredCampAddressManifest2026 } from "../data/camp-address-inferred-2026.mjs";

const square = [
  [-119.2, 40.78],
  [-119.19, 40.78],
  [-119.19, 40.79],
  [-119.2, 40.79],
  [-119.2, 40.78],
];

const geojson = {
  type: "FeatureCollection",
  features: [{
    type: "Feature",
    properties: { Name: "Möbius — West", UID: "camp-2026-1" },
    geometry: { type: "Polygon", coordinates: [square] },
  }],
};

const validGeojson = {
  type: "FeatureCollection",
  features: [geojson.features[0], ...Array.from({ length: MINIMUM_VALID_CAMP_FEATURES - 1 }, (_, index) => ({
    type: "Feature",
    properties: { Name: `Other Camp ${index}`, UID: `other-${index}` },
    geometry: { type: "Polygon", coordinates: [square] },
  }))],
};

test("normalizes harmless camp-name formatting but never fuzzy-matches", () => {
  assert.equal(normalizeCampName("  Möbius — West! "), "möbius - west");
  const resolver = createCampLocationResolver(geojson);
  const location = resolver.resolve("möbius - west");

  assert.equal(location.source, "official_camp_placement");
  assert.equal(location.camp_uid, "camp-2026-1");
  assert.equal("polygon" in location, false);
  assert.equal(JSON.stringify(location).includes("coordinates"), false);
  assert.equal(resolver.resolve("Möbius West"), null);
});

test("rejects a malformed or implausibly small official map before it can be cached", () => {
  assert.throws(() => validateCampGeojson({ type: "FeatureCollection", features: [] }), /only 0 valid/);
  assert.throws(() => validateCampGeojson({ type: "FeatureCollection", features: [{ type: "Feature" }] }), /only 0 valid/);
  assert.throws(() => validateCampGeojson({
    type: "FeatureCollection",
    features: Array.from({ length: MINIMUM_VALID_CAMP_FEATURES }, () => ({ type: "Feature" })),
  }), /only 0 valid/);
  assert.throws(() => validateCampGeojson({ type: "NotGeoJSON", features: [] }), /FeatureCollection/);
});

test("does not cache an empty official-map response as an all-unmatched resolver", async () => {
  await assert.rejects(
    getCampLocationResolver(async () => new Response(JSON.stringify({ type: "FeatureCollection", features: [] }))),
    /only 0 valid/,
  );
});

test("derives a display label point from the official polygon", () => {
  const point = polygonLabelPoint([square]);
  assert.equal(point.method, "polygon_centroid");
  assert.ok(Math.abs(point.longitude + 119.195) < 0.000_001);
  assert.ok(Math.abs(point.latitude - 40.785) < 0.000_001);
});

test("camp map outages leave the original events available without a location payload", async () => {
  const events = [{ uid: "event-1", camp: "Camp Missing", title: "Still listed" }];
  const result = await enrichEventsWithCampLocations(events, async () => {
    throw new Error("network unavailable");
  });

  assert.equal(result[0].uid, "event-1");
  assert.equal("location" in result[0], false);
});

test("joins validated official camp API location strings by GeoJSON UID", () => {
  const addresses = createCampAddressIndex([{ uid: "camp-2026-1", location_string: " 4:45 & G " }]);
  const location = createCampLocationResolver(geojson).resolve("Möbius — West");
  const enriched = addPlayaAddress(location, addresses);

  assert.equal(enriched.playa_address, "4:45 & G");
  assert.equal(enriched.playa_address_source, "official_2026_camp_api");
  assert.equal(enriched.playa_address_confidence, "high");
  assert.equal(addPlayaAddress({ ...location, camp_uid: "not-found" }, addresses).playa_address, undefined);
  assert.throws(() => createCampAddressIndex({ camps: [{ uid: "", location_string: "4:45 & G" }] }), /no valid camp UIDs/);
});

test("loads only confidence-gated static curation and Near-only geometry fallbacks", () => {
  assert.equal(curatedCampAddressIndex2026.get("a1XVI00000FP9Vh2AL")?.address, "3:30 & D");
  const inferred = inferredCampAddressIndex2026.get("a1XVI00000FOYMT2A5");
  assert.equal(inferred?.address, "Near 2:00 & E");
  assert.equal(inferred?.source, "official_2026_gis_inference");
  assert.equal(inferred?.confidence, "approximate");
  assert.ok(inferred?.boundary_distance_m <= 10);
  assert.equal(inferredCampAddressManifest2026.rule.includes("≤10m"), true);
  assert.equal(inferredCampAddressManifest2026.inferred_count, inferredCampAddressIndex2026.size);
  assert.match(inferredCampAddressManifest2026.sources.camps.sha256, /^[a-f0-9]{64}$/);
  assert.equal(inferredCampAddressManifest2026.sources.camps.schema.placed_feature_count, 1183);
  assert.match(inferredCampAddressManifest2026.sources.streets.url, /innovate-GIS-data\/[a-f0-9]{40}\//);
  assert.equal(inferredCampAddressManifest2026.sources.streets.schema.radial_feature_count, 270);
  assert.equal(inferredCampAddressManifest2026.sources.streets.schema.annular_feature_count, 291);

  assert.throws(() => createStaticCampAddressIndex([{
    uid: "uid-1", camp_name: "Bad inference", address: "4:45 & G",
    source: "official_2026_gis_inference", confidence: "approximate", boundary_distance_m: 2,
    source_url: "https://example.com", source_note: "test", verified_at: "2026-08-30",
  }], "official_2026_gis_inference"), /official_2026_gis_inference/);
  assert.throws(() => createStaticCampAddressIndex([{
    uid: "uid-1", camp_name: "Unreviewed", address: "4:45 & G",
    source: "curated_2026_lookup", confidence: "approximate",
    source_url: "https://example.com", source_note: "test", verified_at: "2026-08-30",
  }], "curated_2026_lookup"), /must be reviewed/);
});

test("uses API, then curated, then geometry without overwriting stronger addresses", () => {
  const location = { source: "official_camp_placement", camp_uid: "camp-2026-1" };
  const api = new Map([["camp-2026-1", "4:45 & G"]]);
  const curated = new Map([["camp-2026-1", { address: "3:30 & D", source: "curated_2026_lookup", confidence: "reviewed", verified_at: "2026-08-30" }]]);
  const inferred = new Map([["camp-2026-1", { address: "Near 3:30 & D", source: "official_2026_gis_inference", confidence: "approximate", boundary_distance_m: 8.6, verified_at: "2026-08-30" }]]);
  const apiFirst = addPlayaAddress(addPlayaAddress(addPlayaAddress(location, api), curated), inferred);
  assert.equal(apiFirst.playa_address, "4:45 & G");
  assert.equal(apiFirst.playa_address_source, "official_2026_camp_api");
  const curatedFirst = addPlayaAddress(addPlayaAddress(location, curated), inferred);
  assert.equal(curatedFirst.playa_address, "3:30 & D");
  assert.equal(curatedFirst.playa_address_source, "curated_2026_lookup");
  const inferenceOnly = addPlayaAddress(location, inferred);
  assert.equal(inferenceOnly.playa_address, "Near 3:30 & D");
  assert.equal(inferenceOnly.playa_address_distance_m, 8.6);
});

test("shares one private camp-address request and preserves stale good data after a refresh failure", async () => {
  resetCampLocationCachesForTest();
  let calls = 0;
  let seenRequest;
  const successfulFetch = async (url, options) => {
    calls += 1;
    seenRequest = { url, options };
    return new Response(JSON.stringify({ camps: [{ uid: "camp-2026-1", location_string: "4:45 & G" }] }));
  };

  const [first, second] = await Promise.all([
    getCampAddressIndex(successfulFetch, "secret-key", 1_000),
    getCampAddressIndex(successfulFetch, "secret-key", 1_000),
  ]);
  assert.equal(calls, 1);
  assert.equal(first, second);
  assert.equal(first.get("camp-2026-1"), "4:45 & G");
  assert.equal(seenRequest.url, CAMP_API_URL);
  assert.equal(seenRequest.options.headers["X-API-Key"], "secret-key");

  const stale = await getCampAddressIndex(async () => {
    throw new Error("upstream unavailable");
  }, "secret-key", 1_000 + CAMP_CACHE_TTL_MS + 1);
  assert.equal(stale.get("camp-2026-1"), "4:45 & G");
  resetCampLocationCachesForTest();
});

test("does not call the private camp API when no server key is configured", async () => {
  resetCampLocationCachesForTest();
  let called = false;
  const addresses = await getCampAddressIndex(async () => {
    called = true;
    throw new Error("should not be called");
  }, "");
  assert.equal(addresses, null);
  assert.equal(called, false);
});

test("address API failures leave the independently resolved official camp point intact", async () => {
  resetCampLocationCachesForTest();
  const result = await enrichEventsWithCampLocations([{ uid: "event-1", camp: "Möbius — West" }], async (url) => {
    if (url === CAMP_API_URL) return new Response("unavailable", { status: 503 });
    return new Response(JSON.stringify(validGeojson));
  }, "secret-key");

  assert.equal(result[0].location.source, "camp");
  assert.equal(result[0].location.playa_address, undefined);
  assert.ok(result[0].location.label_point);
  assert.deepEqual(Object.keys(result[0].location).sort(), ["label_point", "source"]);
  resetCampLocationCachesForTest();
});
