import assert from "node:assert/strict";
import test from "node:test";
import { getEventAddressProvenance, getEventLocationDisplay, getEventPlayaAddress, getOfficialCampCoordinates, getOfficialCampMapUrl } from "../lib/event-location.ts";

const officialCampLocation = {
  source: "camp",
  label_point: { longitude: -119.2064, latitude: 40.7864 },
};

test("returns coordinates only for a validated official 2026 camp point", () => {
  assert.deepEqual(getOfficialCampCoordinates(officialCampLocation), { longitude: -119.2064, latitude: 40.7864 });
  assert.equal(getOfficialCampCoordinates({ ...officialCampLocation, source: "other" }), null);
  assert.equal(getOfficialCampCoordinates({ ...officialCampLocation, label_point: { longitude: "-119.2064", latitude: 40.7864 } }), null);
});

test("creates an HTTPS map link for a validated official 2026 camp point", () => {
  assert.equal(
    getOfficialCampMapUrl(officialCampLocation),
    "https://www.openstreetmap.org/?mlat=40.7864&mlon=-119.2064#map=18/40.7864/-119.2064",
  );
});

test("does not link unlocated, out-of-year, or malformed API location data", () => {
  for (const location of [
    undefined,
    { source: "other", label_point: { longitude: -119, latitude: 40 } },
    { source: "camp", label_point: { longitude: "-119", latitude: 40 } },
    { source: "camp", label_point: { longitude: -119, latitude: 91 } },
  ]) {
    assert.equal(getOfficialCampMapUrl(location), null);
  }
});

test("prefers a strict per-event sheet address over camp-level addresses", () => {
  assert.equal(getEventPlayaAddress({ ...officialCampLocation, playa_address: "  4:45 & G  " }, "Open Playa"), "4:45 & G");
  assert.equal(getEventPlayaAddress({ ...officialCampLocation, playa_address: "4:45 & G" }, "7:30+D"), "7:30 & D");
  assert.equal(getEventPlayaAddress(undefined, "4:45+K"), "4:45 & K");
  assert.equal(getEventPlayaAddress(undefined, " 10:00 & a "), "10:00 & A");
  assert.equal(getEventPlayaAddress(undefined, "8:00+Esplanade"), "8:00 & Esplanade");
  assert.equal(getEventPlayaAddress(undefined, "4:45 G"), null);
  assert.equal(getEventPlayaAddress(undefined, "Open Playa"), null);
  assert.equal(getEventPlayaAddress(undefined, "4:45 + K near the bar"), null);
  assert.equal(getEventPlayaAddress({ ...officialCampLocation, source: "other", playa_address: "4:45 & G" }, "Open Playa"), null);
});

test("retains the Near prefix for geometry-derived camp addresses", () => {
  assert.deepEqual(
    getEventLocationDisplay({ ...officialCampLocation, playa_address: "Near 2:00 & E", playa_address_source: "official_2026_gis_inference" }, "Camp LandHO!", "Open Playa"),
    {
      playaAddress: "Near 2:00 & E",
      listedLocation: "Open Playa",
      primary: "Camp LandHO!",
      secondary: "Near 2:00 & E",
      campInLocation: true,
    },
  );
});

test("shows provenance only for the displayed curated or map-derived address", () => {
  assert.deepEqual(
    getEventAddressProvenance({ ...officialCampLocation, playa_address: "4:45 & G", playa_address_source: "curated_2026_lookup", playa_address_checked_at: "2026-08-30" }, "Open Playa"),
    { kind: "reviewed", checkedAt: "2026-08-30" },
  );
  assert.deepEqual(
    getEventAddressProvenance({ ...officialCampLocation, playa_address: "Near 4:45 & G", playa_address_source: "official_2026_gis_inference", playa_address_checked_at: "2026-08-31" }, "Open Playa"),
    { kind: "map_derived", checkedAt: "2026-08-31" },
  );
  assert.equal(
    getEventAddressProvenance({ ...officialCampLocation, playa_address: "Near 4:45 & G", playa_address_source: "official_2026_gis_inference" }, "7:30 + D"),
    null,
  );
  assert.equal(getEventAddressProvenance({ ...officialCampLocation, playa_address: "4:45 & G", playa_address_source: "official_2026_camp_api" }, "Open Playa"), null);
});

test("shows camp first and its strict playa address second without duplicates", () => {
  assert.deepEqual(
    getEventLocationDisplay({ ...officialCampLocation, playa_address: "7:30 + d" }, "Down Low Club", "Open Playa"),
    {
      playaAddress: "7:30 & D",
      listedLocation: "Open Playa",
      primary: "Down Low Club",
      secondary: "7:30 & D",
      campInLocation: true,
    },
  );
  assert.deepEqual(
    getEventLocationDisplay(undefined, "Camp LandHO!", "4:45+K"),
    {
      playaAddress: "4:45 & K",
      listedLocation: "4:45+K",
      primary: "Camp LandHO!",
      secondary: "4:45 & K",
      campInLocation: true,
    },
  );
});

test("keeps unstructured where text and suppresses repeated camp/address values", () => {
  assert.deepEqual(
    getEventLocationDisplay(undefined, "Camp LandHO!", "Open Playa"),
    {
      playaAddress: null,
      listedLocation: "Open Playa",
      primary: "Open Playa",
      secondary: null,
      campInLocation: false,
    },
  );
  assert.deepEqual(
    getEventLocationDisplay(undefined, "4:45 & G", "4:45+G"),
    {
      playaAddress: "4:45 & G",
      listedLocation: "4:45+G",
      primary: "4:45 & G",
      secondary: null,
      campInLocation: true,
    },
  );
});
