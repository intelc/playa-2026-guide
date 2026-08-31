/**
 * 2026 Burning Man placed-theme-camp data. This is deliberately a runtime
 * dependency: placements are event-year specific and are occasionally revised
 * shortly before the event, so we do not bake a copy of the map into the app.
 */
import { curatedCampAddressIndex2026, inferredCampAddressIndex2026 } from "./camp-address-lookups.mjs";

export const CAMP_GEOJSON_URL = "https://bm-innovate.s3.amazonaws.com/2026/public_camps.geojson";
export const CAMP_API_URL = "https://api.burningman.org/api/camp?year=2026";
export const CAMP_LOCATION_YEAR = 2026;
export const CAMP_CACHE_TTL_MS = 15 * 60 * 1000;
// The official 2026 dataset contains 1,183 placed camps. This deliberately
// allows normal late-placement churn while rejecting a partial/error payload.
export const MINIMUM_VALID_CAMP_FEATURES = 500;

let cachedIndex = null;
let cachedAt = 0;
let pendingIndex = null;
let cachedAddressIndex = null;
let cachedAddressAt = 0;
let pendingAddressIndex = null;

/**
 * Format-only normalization. It intentionally does not tokenize, abbreviate,
 * or fuzzy-match names; an ambiguous normalized name is never auto-resolved.
 */
export function normalizeCampName(value) {
  if (typeof value !== "string") return "";
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("en-US")
    .replace(/[‘’`]/g, "'")
    .replace(/[‐‑‒–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.,;:!?]+$/g, "")
    .trim();
}

function isPosition(position) {
  return Array.isArray(position)
    && position.length >= 2
    && Number.isFinite(position[0])
    && Number.isFinite(position[1])
    && position[0] >= -180
    && position[0] <= 180
    && position[1] >= -90
    && position[1] <= 90;
}

function isLinearRing(ring) {
  if (!Array.isArray(ring) || ring.length < 4 || !ring.every(isPosition)) return false;
  const first = ring[0];
  const last = ring[ring.length - 1];
  return first[0] === last[0] && first[1] === last[1];
}

function isPolygonCoordinates(coordinates) {
  return Array.isArray(coordinates)
    && coordinates.length > 0
    && coordinates.every(isLinearRing);
}

function isCampGeometry(geometry) {
  return (geometry?.type === "Polygon" && isPolygonCoordinates(geometry.coordinates))
    || (geometry?.type === "MultiPolygon"
      && Array.isArray(geometry.coordinates)
      && geometry.coordinates.length > 0
      && geometry.coordinates.every(isPolygonCoordinates));
}

function geometryLabelPoint(geometry) {
  if (geometry?.type === "Polygon") return polygonLabelPoint(geometry.coordinates);
  if (geometry?.type === "MultiPolygon") {
    for (const polygon of geometry.coordinates) {
      const point = polygonLabelPoint(polygon);
      if (point) return point;
    }
  }
  return null;
}

function isPlacedCampFeature(feature) {
  return typeof feature?.properties?.Name === "string"
    && typeof feature?.properties?.UID === "string"
    && isCampGeometry(feature.geometry);
}

export function validateCampGeojson(geojson) {
  if (geojson?.type !== "FeatureCollection" || !Array.isArray(geojson.features)) {
    throw new Error("Camp GeoJSON must be a FeatureCollection");
  }
  const validFeatures = geojson.features.filter(isPlacedCampFeature);
  if (validFeatures.length < MINIMUM_VALID_CAMP_FEATURES) {
    throw new Error(`Camp GeoJSON has only ${validFeatures.length} valid placed-camp features`);
  }
  return validFeatures.length;
}

function pointInRing(point, ring) {
  let inside = false;
  for (let current = 0, previous = ring.length - 1; current < ring.length; previous = current, current += 1) {
    const [currentX, currentY] = ring[current];
    const [previousX, previousY] = ring[previous];
    const crosses = (currentY > point[1]) !== (previousY > point[1]);
    if (crosses && point[0] < ((previousX - currentX) * (point[1] - currentY)) / (previousY - currentY) + currentX) inside = !inside;
  }
  return inside;
}

function isInsidePolygon(point, rings) {
  return pointInRing(point, rings[0]) && !rings.slice(1).some((ring) => pointInRing(point, ring));
}

function ringCentroid(ring) {
  let areaTwice = 0;
  let longitude = 0;
  let latitude = 0;
  for (let index = 0; index < ring.length - 1; index += 1) {
    const [x1, y1] = ring[index];
    const [x2, y2] = ring[index + 1];
    const cross = x1 * y2 - x2 * y1;
    areaTwice += cross;
    longitude += (x1 + x2) * cross;
    latitude += (y1 + y2) * cross;
  }
  if (Math.abs(areaTwice) < Number.EPSILON) return null;
  return [longitude / (3 * areaTwice), latitude / (3 * areaTwice)];
}

/**
 * Return a deterministic point inside the exterior ring when possible. A
 * polygon centroid is ideal for labels, but concave plots can put it outside;
 * in that case a small ordered grid finds an interior label point. This point
 * is only for display and must not be presented as an entrance or address.
 */
export function polygonLabelPoint(coordinates) {
  const exterior = coordinates?.[0];
  if (!Array.isArray(exterior) || exterior.length < 3) return null;
  const centroid = ringCentroid(exterior);
  if (centroid && isInsidePolygon(centroid, coordinates)) {
    return { longitude: centroid[0], latitude: centroid[1], method: "polygon_centroid" };
  }

  const positions = exterior.filter(isPosition);
  if (!positions.length) return null;
  const longitudes = positions.map(([longitude]) => longitude);
  const latitudes = positions.map(([, latitude]) => latitude);
  const minLongitude = Math.min(...longitudes);
  const maxLongitude = Math.max(...longitudes);
  const minLatitude = Math.min(...latitudes);
  const maxLatitude = Math.max(...latitudes);

  // Check the center first, then a deterministic 15×15 grid from the middle
  // outward. This avoids a vertex/boundary fallback for normal camp polygons.
  const fractions = [0.5, 0.4375, 0.5625, 0.375, 0.625, 0.3125, 0.6875, 0.25, 0.75, 0.1875, 0.8125, 0.125, 0.875, 0.0625, 0.9375];
  for (const xFraction of fractions) {
    for (const yFraction of fractions) {
      const point = [
        minLongitude + (maxLongitude - minLongitude) * xFraction,
        minLatitude + (maxLatitude - minLatitude) * yFraction,
      ];
      if (isInsidePolygon(point, coordinates)) {
        return { longitude: point[0], latitude: point[1], method: "interior_label_point" };
      }
    }
  }
  return null;
}

function unresolvedLocation() { return null; }

function getCampApiRows(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.camps)) return payload.camps;
  return null;
}

/**
 * Extract the official human-readable address by the same UID used by the
 * GeoJSON map. Duplicate UIDs are dropped rather than assigning an arbitrary
 * address, and a structurally invalid response is never cached.
 */
export function createCampAddressIndex(payload) {
  const rows = getCampApiRows(payload);
  if (!rows) throw new Error("Camp API must return an array of camps");

  const index = new Map();
  const ambiguous = new Set();
  let validUidRows = 0;
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const uid = typeof row.uid === "string" ? row.uid : row.UID;
    if (typeof uid !== "string" || !uid.trim()) continue;
    validUidRows += 1;
    const rawAddress = row.location_string;
    if (typeof rawAddress !== "string") continue;
    const address = rawAddress.replace(/\s+/g, " ").trim();
    if (!address || address.length > 160) continue;
    if (index.has(uid)) {
      index.delete(uid);
      ambiguous.add(uid);
    } else if (!ambiguous.has(uid)) {
      index.set(uid, address);
    }
  }
  if (!validUidRows) throw new Error("Camp API has no valid camp UIDs");
  return index;
}

/**
 * Fetches optional camp street addresses only on the server. This intentionally
 * does nothing without a configured API key, so public event data and official
 * map coordinates remain available in development and preview deployments.
 */
export async function getCampAddressIndex(
  fetchImpl = fetch,
  apiKey = process.env.BURNING_MAN_API_KEY,
  now = Date.now(),
) {
  if (typeof apiKey !== "string" || !apiKey.trim()) return null;
  if (cachedAddressIndex && now - cachedAddressAt < CAMP_CACHE_TTL_MS) return cachedAddressIndex;
  if (pendingAddressIndex) return pendingAddressIndex;

  pendingAddressIndex = (async () => {
    try {
      const response = await fetchImpl(CAMP_API_URL, {
        headers: { Accept: "application/json", "X-API-Key": apiKey },
      });
      if (!response.ok) throw new Error(`Camp API returned ${response.status}`);
      const index = createCampAddressIndex(await response.json());
      cachedAddressIndex = index;
      cachedAddressAt = now;
      return index;
    } catch (error) {
      // Addresses supplement the map. Keep the last valid data through a
      // transient failure, and otherwise let coordinates continue untouched.
      if (cachedAddressIndex) return cachedAddressIndex;
      throw error;
    } finally {
      pendingAddressIndex = null;
    }
  })();
  return pendingAddressIndex;
}

/**
 * Applies a UID-keyed address only to a placed camp that does not already have
 * a stronger address. The static lookups are intentionally server-side only;
 * the client receives just the address and provenance needed for display.
 */
export function addPlayaAddress(location, addressIndex, fallback = {}) {
  if (!addressIndex || location?.source !== "official_camp_placement" || typeof location.camp_uid !== "string" || location.playa_address) return location;
  const entry = addressIndex.get(location.camp_uid);
  if (!entry) return location;
  const isString = typeof entry === "string";
  const address = isString ? entry : entry.address;
  if (typeof address !== "string" || !address) return location;
  return {
    ...location,
    playa_address: address,
    playa_address_source: isString ? (fallback.source ?? "official_2026_camp_api") : entry.source,
    playa_address_confidence: isString ? (fallback.confidence ?? "high") : entry.confidence,
    ...(isString ? {} : {
      ...(Number.isFinite(entry.boundary_distance_m) ? { playa_address_distance_m: entry.boundary_distance_m } : {}),
      ...(typeof entry.verified_at === "string" ? { playa_address_checked_at: entry.verified_at } : {}),
    }),
  };
}

/** Exported for deterministic offline tests only. */
export function resetCampLocationCachesForTest() {
  cachedIndex = null;
  cachedAt = 0;
  pendingIndex = null;
  cachedAddressIndex = null;
  cachedAddressAt = 0;
  pendingAddressIndex = null;
}

export function createCampLocationResolver(geojson) {
  const features = Array.isArray(geojson?.features) ? geojson.features : [];
  const index = new Map();
  const ambiguous = new Set();

  for (const feature of features) {
    const name = feature?.properties?.Name;
    const uid = feature?.properties?.UID;
    if (!isPlacedCampFeature(feature)) continue;
    const key = normalizeCampName(name);
    if (!key) continue;
    if (index.has(key)) {
      index.delete(key);
      ambiguous.add(key);
    } else if (!ambiguous.has(key)) {
      const labelPoint = geometryLabelPoint(feature.geometry);
      if (labelPoint) index.set(key, { name, uid, labelPoint });
    }
  }

  return {
    resolve(camp) {
      const input = typeof camp === "string" ? camp : "";
      if (!input || input === "-") return unresolvedLocation();
      const match = index.get(normalizeCampName(input));
      if (!match) return unresolvedLocation();
      return {
        source: "official_camp_placement",
        camp_uid: match.uid,
        label_point: match.labelPoint,
      };
    },
  };
}

export async function getCampLocationResolver(fetchImpl = fetch) {
  if (cachedIndex && Date.now() - cachedAt < CAMP_CACHE_TTL_MS) return cachedIndex;
  if (pendingIndex) return pendingIndex;
  pendingIndex = (async () => {
    try {
      const response = await fetchImpl(CAMP_GEOJSON_URL, { headers: { Accept: "application/geo+json, application/json" } });
      if (!response.ok) throw new Error(`Camp GeoJSON returned ${response.status}`);
      const geojson = await response.json();
      validateCampGeojson(geojson);
      const resolver = createCampLocationResolver(geojson);
      cachedIndex = resolver;
      cachedAt = Date.now();
      return resolver;
    } catch (error) {
      // A stale official map is more useful than dropping all known placements
      // during a transient upstream outage.
      if (cachedIndex) return cachedIndex;
      throw error;
    } finally {
      pendingIndex = null;
    }
  })();
  return pendingIndex;
}

/** Enrich every event while keeping the original event fields untouched. */
export async function enrichEventsWithCampLocations(events, fetchImpl = fetch, apiKey = process.env.BURNING_MAN_API_KEY) {
  let resolvedEvents;
  try {
    const resolver = await getCampLocationResolver(fetchImpl);
    resolvedEvents = events.map((event) => ({ ...event, location: resolver.resolve(event.camp) }));
  } catch {
    // Camp placement is useful metadata, not a reason to hide the event guide.
    resolvedEvents = events.map((event) => ({ ...event, location: unresolvedLocation() }));
  }

  try {
    const addressIndex = await getCampAddressIndex(fetchImpl, apiKey);
    resolvedEvents = resolvedEvents.map((event) => ({ ...event, location: addPlayaAddress(event.location, addressIndex) }));
  } catch {
    // Do not let a private API outage remove already-resolved map points.
  }

  // Curated corrections are static, UID-keyed, and intentionally override the
  // geometry approximation—but never a live official API address. Geometry is
  // the final fallback and remains visibly prefixed with "Near".
  return resolvedEvents.map((event) => {
    const resolved = addPlayaAddress(addPlayaAddress(event.location, curatedCampAddressIndex2026), inferredCampAddressIndex2026);
    if (!resolved) {
      const originalEvent = { ...event };
      delete originalEvent.location;
      return originalEvent;
    }
    const address = { ...resolved };
    const labelPoint = address.label_point;
    delete address.source;
    delete address.camp_uid;
    delete address.label_point;
    return {
      ...event,
      location: {
        // The source discriminator and point are enough for client validation;
        // do not repeat resolver diagnostics or internal camp identifiers.
        source: "camp",
        label_point: { longitude: labelPoint.longitude, latitude: labelPoint.latitude },
        ...address,
      },
    };
  });
}
