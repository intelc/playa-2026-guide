#!/usr/bin/env node
/*
 * Read-only experiment: infer familiar clock-and-street labels from the
 * official 2026 camp and street geometry, then compare against strict values
 * already present in the public event sheet.  It writes no data back to the
 * app or sheet.
 *
 * node analysis/camp-address-evaluation.mjs
 * node analysis/camp-address-evaluation.mjs /path/to/camps.geojson /path/to/street_lines.geojson /path/to/sheet.txt
 */
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { normalizeCampName, polygonLabelPoint } from "../lib/camp-location.mjs";

const CAMP_URL = "https://bm-innovate.s3.amazonaws.com/2026/public_camps.geojson";
const STREET_URL = "https://raw.githubusercontent.com/burningmantech/innovate-GIS-data/master/2026/GeoJSON/street_lines.geojson";
const SHEET_URL = "https://docs.google.com/spreadsheets/d/1cPbc5bkKwQ11aID9Xa4-fRyMLpFaX80bAcN3hMjo_DY/gviz/tq?tqx=out:json&sheet=English";
const EARTH_RADIUS_M = 6_371_008.8;
const strictAddress = /^\s*((?:[1-9]|1[0-2]):(?:00|15|30|45))\s*(?:\+|&)\s*([A-L])\s*$/i;

const loadJson = async (file, url) => {
  if (file) return JSON.parse(await fs.readFile(file, "utf8"));
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response.json();
};

const loadSheet = async (file) => {
  const text = file ? await fs.readFile(file, "utf8") : await (await fetch(SHEET_URL)).text();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < 0) throw new Error("Could not parse Google Visualization sheet response");
  return JSON.parse(text.slice(start, end + 1));
};

const address = (clock, street) => `${clock} & ${street}`;
const parseAddress = (value) => {
  const match = typeof value === "string" ? value.match(strictAddress) : null;
  return match ? address(match[1], match[2].toUpperCase()) : null;
};
const getRows = (sheet) => sheet.table.rows.map((row) => row.c?.map((cell) => cell?.v ?? "") ?? []);

function flattenLineCoordinates(geometry) {
  if (geometry?.type === "LineString") return [geometry.coordinates];
  if (geometry?.type === "MultiLineString") return geometry.coordinates;
  return [];
}
function exteriorRings(geometry) {
  if (geometry?.type === "Polygon") return geometry.coordinates.slice(0, 1);
  if (geometry?.type === "MultiPolygon") return geometry.coordinates.map((polygon) => polygon[0]);
  return [];
}
function ringCentroid(ring) {
  let twiceArea = 0; let x = 0; let y = 0;
  for (let i = 0; i < ring.length - 1; i += 1) {
    const [x1, y1] = ring[i]; const [x2, y2] = ring[i + 1]; const cross = x1 * y2 - x2 * y1;
    twiceArea += cross; x += (x1 + x2) * cross; y += (y1 + y2) * cross;
  }
  return Math.abs(twiceArea) < 1e-15 ? null : { point: [x / (3 * twiceArea), y / (3 * twiceArea)], area: Math.abs(twiceArea) / 2 };
}
function polygonCentroid(geometry) {
  const centroids = exteriorRings(geometry).map(ringCentroid).filter(Boolean);
  const weight = centroids.reduce((sum, item) => sum + item.area, 0);
  if (!weight) return null;
  return centroids.reduce((out, item) => [out[0] + item.point[0] * item.area / weight, out[1] + item.point[1] * item.area / weight], [0, 0]);
}
function segmentDistance(point, start, end) {
  const dx = end[0] - start[0]; const dy = end[1] - start[1];
  const denominator = dx * dx + dy * dy;
  const t = denominator ? Math.max(0, Math.min(1, ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) / denominator)) : 0;
  const projected = [start[0] + t * dx, start[1] + t * dy];
  return Math.hypot(point[0] - projected[0], point[1] - projected[1]);
}
function orientation(a, b, c) { return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]); }
function onSegment(a, b, p) { return Math.min(a[0], b[0]) - 1e-7 <= p[0] && p[0] <= Math.max(a[0], b[0]) + 1e-7 && Math.min(a[1], b[1]) - 1e-7 <= p[1] && p[1] <= Math.max(a[1], b[1]) + 1e-7; }
function segmentsIntersect(a, b, c, d) {
  const abC = orientation(a, b, c); const abD = orientation(a, b, d); const cdA = orientation(c, d, a); const cdB = orientation(c, d, b);
  return ((abC > 0 && abD < 0) || (abC < 0 && abD > 0)) && ((cdA > 0 && cdB < 0) || (cdA < 0 && cdB > 0))
    || (Math.abs(abC) < 1e-7 && onSegment(a, b, c)) || (Math.abs(abD) < 1e-7 && onSegment(a, b, d))
    || (Math.abs(cdA) < 1e-7 && onSegment(c, d, a)) || (Math.abs(cdB) < 1e-7 && onSegment(c, d, b));
}
function segmentSegmentDistance(a, b, c, d) {
  if (segmentsIntersect(a, b, c, d)) return 0;
  return Math.min(segmentDistance(a, c, d), segmentDistance(b, c, d), segmentDistance(c, a, b), segmentDistance(d, a, b));
}
function segmentIntersection(a, b, c, d) {
  const rx = b[0] - a[0]; const ry = b[1] - a[1]; const sx = d[0] - c[0]; const sy = d[1] - c[1];
  const denom = rx * sy - ry * sx;
  if (Math.abs(denom) < 1e-8) return null;
  const qpx = c[0] - a[0]; const qpy = c[1] - a[1];
  const t = (qpx * sy - qpy * sx) / denom; const u = (qpx * ry - qpy * rx) / denom;
  return t >= -1e-7 && t <= 1 + 1e-7 && u >= -1e-7 && u <= 1 + 1e-7 ? [a[0] + t * rx, a[1] + t * ry] : null;
}
function minPointToRoad(point, road) { return Math.min(...road.segments.map(([a, b]) => segmentDistance(point, a, b))); }
function minBoundaryToRoad(boundarySegments, road) { return Math.min(...boundarySegments.flatMap(([a, b]) => road.segments.map(([c, d]) => segmentSegmentDistance(a, b, c, d)))); }
function rankedRoads(metric, roads) { return roads.map((road) => ({ road, distance: metric(road) })).sort((a, b) => a.distance - b.distance); }
function predictionFromRoads(metric, radial, annular) {
  const r = rankedRoads(metric, radial); const a = rankedRoads(metric, annular);
  return { predicted: address(r[0].road.name, a[0].road.name), radialDistance: r[0].distance, annularDistance: a[0].distance, margin: Math.hypot(r[1].distance, a[1].distance) - Math.hypot(r[0].distance, a[0].distance), radialRank: r.map((item) => item.road.name), annularRank: a.map((item) => item.road.name) };
}
function rankIntersections(metric, intersections) {
  return intersections.map((item) => ({ ...item, distance: metric(item.point) })).sort((a, b) => a.distance - b.distance);
}
function percentile(values, fraction) { const ordered = [...values].sort((a, b) => a - b); return ordered[Math.min(ordered.length - 1, Math.floor((ordered.length - 1) * fraction))]; }
function accuracy(results, key) { return results.filter((row) => row[key]?.predicted === row.truth).length / results.length; }
function componentAccuracy(results, key, component) {
  const position = component === "radial" ? 0 : 1;
  return results.filter((row) => row[key]?.predicted.split(" & ")[position] === row.truth.split(" & ")[position]).length / results.length;
}
function topK(results, key, count) { return results.filter((row) => row[key].ranked.slice(0, count).some((item) => item.address === row.truth)).length / results.length; }
function fixed(value) { return Number.isFinite(value) ? value.toFixed(1) : "—"; }
function stableBucket(value) {
  let hash = 2166136261;
  for (const character of value) { hash ^= character.codePointAt(0); hash = Math.imul(hash, 16777619); }
  return (hash >>> 0) % 5;
}

const [campFile, streetFile, sheetFile] = process.argv.slice(2);
const [camps, streets, sheet] = await Promise.all([loadJson(campFile, CAMP_URL), loadJson(streetFile, STREET_URL), loadSheet(sheetFile)]);
const allCoordinates = streets.features.flatMap((feature) => flattenLineCoordinates(feature.geometry).flat());
const origin = allCoordinates.reduce((out, point) => [out[0] + point[0] / allCoordinates.length, out[1] + point[1] / allCoordinates.length], [0, 0]);
const toXY = ([longitude, latitude]) => [
  (longitude - origin[0]) * Math.PI / 180 * EARTH_RADIUS_M * Math.cos(origin[1] * Math.PI / 180),
  (latitude - origin[1]) * Math.PI / 180 * EARTH_RADIUS_M,
];

const streetFeatures = streets.features.flatMap((feature) => {
  const source = feature.properties?.source; const name = feature.properties?.name;
  if (!((source === "radial" || source === "annular") && typeof name === "string")) return [];
  return [{ source, name, segments: flattenLineCoordinates(feature.geometry).flatMap((line) => line.slice(1).map((point, index) => [toXY(line[index]), toXY(point)])) }];
});
const groupRoads = (source) => [...new Map([...new Set(streetFeatures.filter((item) => item.source === source).map((item) => item.name))].map((name) => [name, { name, segments: streetFeatures.filter((item) => item.source === source && item.name === name).flatMap((item) => item.segments) }])).values()];
const radial = groupRoads("radial"); const annular = groupRoads("annular");
const intersectionsByAddress = new Map();
for (const r of radial) for (const a of annular) for (const [r1, r2] of r.segments) for (const [a1, a2] of a.segments) {
  const point = segmentIntersection(r1, r2, a1, a2);
  if (point) {
    const key = address(r.name, a.name); const values = intersectionsByAddress.get(key) ?? [];
    values.push(point); intersectionsByAddress.set(key, values);
  }
}
const intersections = [...intersectionsByAddress].map(([addressValue, points]) => ({ address: addressValue, point: points.reduce((out, point) => [out[0] + point[0] / points.length, out[1] + point[1] / points.length], [0, 0]), duplicates: points.length }));

const campByName = new Map(); const ambiguousCamps = new Set();
for (const feature of camps.features) {
  const key = normalizeCampName(feature.properties?.Name);
  if (!key || !feature.geometry) continue;
  if (campByName.has(key)) { campByName.delete(key); ambiguousCamps.add(key); } else if (!ambiguousCamps.has(key)) campByName.set(key, feature);
}
const labelsByCamp = new Map();
for (const row of getRows(sheet).slice(1)) {
  const camp = typeof row[12] === "string" ? row[12] : ""; const truth = parseAddress(row[13]); const key = normalizeCampName(camp);
  if (!key || !truth || camp === "-") continue;
  const labels = labelsByCamp.get(key) ?? { camp, addresses: new Set(), eventCount: 0 };
  labels.addresses.add(truth); labels.eventCount += 1; labelsByCamp.set(key, labels);
}
const conflicts = [...labelsByCamp.entries()].filter(([, item]) => item.addresses.size > 1);
const groundTruth = [...labelsByCamp.entries()].flatMap(([key, item]) => item.addresses.size === 1 && campByName.has(key) ? [{ key, camp: item.camp, feature: campByName.get(key), truth: [...item.addresses][0], eventCount: item.eventCount }] : []);

const geometryLabelPoint = (geometry) => {
  if (geometry?.type === "Polygon") return polygonLabelPoint(geometry.coordinates);
  if (geometry?.type === "MultiPolygon") {
    for (const polygon of geometry.coordinates) {
      const point = polygonLabelPoint(polygon);
      if (point) return point;
    }
  }
  return null;
};
function inferGeometry(geometry) {
  const centroidLonLat = polygonCentroid(geometry);
  if (!centroidLonLat) return null;
  const representative = geometryLabelPoint(geometry) ?? { longitude: centroidLonLat[0], latitude: centroidLonLat[1], method: "centroid_fallback" };
  const centroid = toXY(centroidLonLat);
  const rep = toXY([representative.longitude, representative.latitude]);
  const boundary = exteriorRings(geometry).flatMap((ring) => ring.slice(1).map((point, index) => [toXY(ring[index]), toXY(point)]));
  if (!boundary.length) return null;
  const centroidRoads = predictionFromRoads((road) => minPointToRoad(centroid, road), radial, annular);
  const representativeRoads = predictionFromRoads((road) => minPointToRoad(rep, road), radial, annular);
  const boundaryRoads = predictionFromRoads((road) => minBoundaryToRoad(boundary, road), radial, annular);
  const centroidIntersections = rankIntersections((point) => Math.hypot(point[0] - centroid[0], point[1] - centroid[1]), intersections);
  const representativeIntersections = rankIntersections((point) => Math.hypot(point[0] - rep[0], point[1] - rep[1]), intersections);
  const boundaryIntersections = rankIntersections((point) => Math.min(...boundary.map(([a, b]) => segmentDistance(point, a, b))), intersections);
  return {
    centroidRoads,
    representativeRoads,
    boundaryRoads,
    centroidIntersection: { predicted: centroidIntersections[0].address, distance: centroidIntersections[0].distance, ranked: centroidIntersections },
    representativeIntersection: { predicted: representativeIntersections[0].address, distance: representativeIntersections[0].distance, ranked: representativeIntersections },
    boundaryIntersection: { predicted: boundaryIntersections[0].address, distance: boundaryIntersections[0].distance, ranked: boundaryIntersections },
  };
}
let representativeFallbacks = 0;
const results = groundTruth.map((row) => {
  const inferred = inferGeometry(row.feature.geometry);
  if (!geometryLabelPoint(row.feature.geometry)) representativeFallbacks += 1;
  return { ...row, ...inferred };
});
const inferredMapCamps = [...campByName.entries()].flatMap(([key, feature]) => {
  const inferred = inferGeometry(feature.geometry);
  return inferred ? [{ key, feature, ...inferred }] : [];
});
const inferredConservative = inferredMapCamps.filter((row) => row.boundaryIntersection.distance <= 10
  && row.boundaryIntersection.predicted === row.representativeRoads.predicted
  && row.boundaryIntersection.predicted === row.boundaryRoads.predicted);
const conservativeMapKeys = new Set(inferredConservative.map((row) => row.key));
const sheetEventRows = getRows(sheet).slice(1).filter((row) => typeof row[16] === "string" && row[16].startsWith("http"));
const sheetRowsAtConservativeCamps = sheetEventRows.filter((row) => conservativeMapKeys.has(normalizeCampName(row[13])));

console.log(`Sources:\n  camps: ${CAMP_URL}\n  streets: ${STREET_URL}\n  sheet: ${SHEET_URL}`);
console.log(`\nGeometry: ${camps.features.length} camp features; ${streets.features.length} street features; ${radial.length} distinct radial names; ${annular.length} distinct annular names; ${intersections.length} named radial/annular intersections.`);
const strictEventCount = [...labelsByCamp.values()].reduce((sum, item) => sum + item.eventCount, 0);
const unmatchedTruth = [...labelsByCamp.entries()].filter(([key]) => !campByName.has(key)).map(([, item]) => item.camp);
console.log(`Ground truth: ${strictEventCount} strict-address event rows across ${labelsByCamp.size} distinct camps; ${groundTruth.length} join unambiguously to a camp polygon; ${conflicts.length} camp-address conflicts; ${unmatchedTruth.length} strict-address camps missing/ambiguous on the map.`);
if (unmatchedTruth.length) console.log(`Unmatched strict-address camp(s): ${unmatchedTruth.join(", ")}`);
if (representativeFallbacks) console.log(`Representative-point fallback: ${representativeFallbacks} polygon(s) used their geometric centroid because no interior label point was available.`);
console.log(`Conservative-rule potential coverage before validation: ${inferredConservative.length}/${inferredMapCamps.length} uniquely named camp polygons (${(inferredConservative.length / inferredMapCamps.length * 100).toFixed(1)}%); ${sheetRowsAtConservativeCamps.length}/${sheetEventRows.length} event rows (${(sheetRowsAtConservativeCamps.length / sheetEventRows.length * 100).toFixed(1)}%) are at one of those camps.`);
if (conflicts.length) console.log("Conflicts:", conflicts.map(([, value]) => `${value.camp} = ${[...value.addresses].join(" | ")}`).join("; "));
console.log("\nExact camp-address accuracy (no fitted parameters):");
for (const [label, key] of [["centroid → nearest radial + annular", "centroidRoads"], ["interior label point → nearest radial + annular", "representativeRoads"], ["polygon boundary → nearest radial + annular", "boundaryRoads"], ["centroid → nearest named intersection", "centroidIntersection"], ["interior label point → nearest named intersection", "representativeIntersection"], ["polygon boundary → nearest named intersection", "boundaryIntersection"]]) {
  const rows = results.map((row) => key.includes("Roads") ? { ...row, [key]: { ...row[key], predicted: row[key].predicted } } : row);
  const radialValue = key.includes("Roads") ? componentAccuracy(rows, key, "radial") : null; const annularValue = key.includes("Roads") ? componentAccuracy(rows, key, "annular") : null;
  const top3Value = key.includes("Intersection") ? topK(rows, key, 3) : null;
  console.log(`  ${label}: ${(accuracy(rows, key) * 100).toFixed(1)}%${radialValue === null ? `; top-3 ${(top3Value * 100).toFixed(1)}%` : `; radial ${(radialValue * 100).toFixed(1)}%; annular ${(annularValue * 100).toFixed(1)}%`}`);
}
const bestKey = "boundaryIntersection";
console.log(`\nNearest-intersection confidence (boundary distance; ${bestKey}):`);
for (const fraction of [0.25, 0.5, 0.75, 1]) {
  const cutoff = percentile(results.map((row) => row[bestKey].distance), fraction);
  const subset = results.filter((row) => row[bestKey].distance <= cutoff);
  console.log(`  nearest ${Math.round(fraction * 100)}% (≤ ${fixed(cutoff)} m): ${subset.length}/${results.length}; exact ${(accuracy(subset, bestKey) * 100).toFixed(1)}%; top-3 ${(topK(subset, bestKey, 3) * 100).toFixed(1)}%`);
}
const conservative = results.filter((row) => row.boundaryIntersection.distance <= 10
  && row.boundaryIntersection.predicted === row.representativeRoads.predicted
  && row.boundaryIntersection.predicted === row.boundaryRoads.predicted);
console.log(`\nConservative, pre-specified rule: boundary is ≤10 m from the named intersection and all three geometry methods agree.`);
console.log(`  Coverage ${conservative.length}/${results.length} (${(conservative.length / results.length * 100).toFixed(1)}%); exact ${conservative.filter((row) => row.boundaryIntersection.predicted === row.truth).length}/${conservative.length} (${(accuracy(conservative, bestKey) * 100).toFixed(1)}%).`);
console.log("  Five deterministic camp-name buckets (not used to tune the rule):");
for (let bucket = 0; bucket < 5; bucket += 1) {
  const subset = conservative.filter((row) => stableBucket(row.key) === bucket);
  const matches = subset.filter((row) => row.boundaryIntersection.predicted === row.truth).length;
  console.log(`    bucket ${bucket}: ${matches}/${subset.length}${subset.length ? ` (${(matches / subset.length * 100).toFixed(1)}%)` : ""}`);
}
console.log("\nBoundary-nearest-intersection examples:");
for (const row of [...results].sort((a, b) => a[bestKey].distance - b[bestKey].distance).slice(0, 8)) console.log(`  ${row.camp}: truth ${row.truth}; predicted ${row[bestKey].predicted}; ${fixed(row[bestKey].distance)} m ${row.truth === row[bestKey].predicted ? "✓" : "✗"}`);
console.log("\nLargest boundary-nearest-intersection errors:");
for (const row of results.filter((row) => row[bestKey].predicted !== row.truth).sort((a, b) => b[bestKey].distance - a[bestKey].distance).slice(0, 12)) console.log(`  ${row.camp}: truth ${row.truth}; predicted ${row[bestKey].predicted}; ${fixed(row[bestKey].distance)} m`);

const output = path.join(os.tmpdir(), "playa-address-evaluation-results.json");
await fs.writeFile(output, JSON.stringify({ generatedAt: new Date().toISOString(), sources: { CAMP_URL, STREET_URL, SHEET_URL }, origin, conflicts: conflicts.map(([, item]) => ({ camp: item.camp, addresses: [...item.addresses] })), results, inferredConservative }, null, 2));
console.log(`\nDetailed machine-readable results: ${output}`);
