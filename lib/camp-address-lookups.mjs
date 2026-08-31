import { curatedCampAddresses2026 } from "../data/camp-address-curated-2026.mjs";
import { inferredCampAddresses2026 } from "../data/camp-address-inferred-2026.mjs";

const STRICT_ADDRESS = /^(?:[1-9]|1[0-2]):(?:00|15|30|45) & (?:[A-L]|ESP)$/;
const INFERRED_ADDRESS = new RegExp(`^Near ${STRICT_ADDRESS.source.slice(1, -1)}$`);
const VALID_SOURCES = new Set(["curated_2026_lookup", "official_2026_gis_inference"]);

function cleanText(value) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function isDate(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/**
 * Validates static address rows and returns an unambiguous UID index. A bad
 * curated or generated lookup must never make it into a live response.
 */
export function createStaticCampAddressIndex(rows, expectedSource) {
  if (!Array.isArray(rows)) throw new Error("Camp address lookup must be an array");
  if (!VALID_SOURCES.has(expectedSource)) throw new Error("Unknown camp address lookup source");

  const index = new Map();
  const duplicateUids = new Set();
  for (const row of rows) {
    if (!row || typeof row !== "object") throw new Error("Camp address lookup contains an invalid row");
    const uid = cleanText(row.uid);
    const campName = cleanText(row.camp_name);
    const address = cleanText(row.address);
    const sourceUrl = cleanText(row.source_url);
    const sourceNote = cleanText(row.source_note);
    const confidence = cleanText(row.confidence);
    const verifiedAt = cleanText(row.verified_at);
    const expectsNear = expectedSource === "official_2026_gis_inference";
    const validAddress = expectsNear ? INFERRED_ADDRESS.test(address) : address.length <= 160 && !address.startsWith("Near ");
    if (!uid || !campName || !validAddress || !sourceUrl.startsWith("https://") || !sourceNote || !isDate(verifiedAt)) {
      throw new Error(`Invalid ${expectedSource} camp address row`);
    }
    if (row.source !== expectedSource) throw new Error(`Unexpected camp address source for ${uid}`);
    if (expectsNear) {
      if (confidence !== "approximate" || !Number.isFinite(row.boundary_distance_m) || row.boundary_distance_m < 0 || row.boundary_distance_m > 10) {
        throw new Error(`Invalid inferred camp address row for ${uid}`);
      }
    } else if (confidence !== "reviewed") {
      throw new Error(`Curated camp address for ${uid} must be reviewed`);
    }
    if (index.has(uid)) {
      index.delete(uid);
      duplicateUids.add(uid);
    } else if (!duplicateUids.has(uid)) {
      index.set(uid, {
        address,
        source: expectedSource,
        confidence,
        boundary_distance_m: expectsNear ? row.boundary_distance_m : undefined,
        verified_at: verifiedAt,
      });
    }
  }
  return index;
}

export const curatedCampAddressIndex2026 = createStaticCampAddressIndex(curatedCampAddresses2026, "curated_2026_lookup");
export const inferredCampAddressIndex2026 = createStaticCampAddressIndex(inferredCampAddresses2026, "official_2026_gis_inference");
