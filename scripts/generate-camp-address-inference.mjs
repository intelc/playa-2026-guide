#!/usr/bin/env node
/**
 * Generate the conservative, static 2026 camp-address fallback. This uses
 * only public camp polygons and street geometry—never event-sheet addresses.
 *
 * node scripts/generate-camp-address-inference.mjs
 * node scripts/generate-camp-address-inference.mjs --check
 */
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { polygonLabelPoint } from "../lib/camp-location.mjs";
import { inferredCampAddressManifest2026 as expectedManifest } from "../data/camp-address-inferred-2026.mjs";

const campsUrl = "https://bm-innovate.s3.amazonaws.com/2026/public_camps.geojson";
const githubCommitUrl = "https://api.github.com/repos/burningmantech/innovate-GIS-data/commits/master";
const earthRadiusM = 6_371_008.8;
const maxBoundaryDistanceM = 10;
const ruleVersion = "2026-gis-intersection-v1";
const target = path.resolve("data/camp-address-inferred-2026.mjs");
const checkOnly = process.argv.includes("--check");
const acceptSourceUpdate = process.argv.includes("--accept-source-update");

function fail(message) { throw new Error(message); }
function lines(geometry) { return geometry?.type === "LineString" ? [geometry.coordinates] : geometry?.type === "MultiLineString" ? geometry.coordinates : []; }
function exteriorRings(geometry) { return geometry?.type === "Polygon" ? geometry.coordinates.slice(0, 1) : geometry?.type === "MultiPolygon" ? geometry.coordinates.map((polygon) => polygon[0]) : []; }
function centroidRing(ring) {
  let twiceArea = 0; let x = 0; let y = 0;
  for (let index = 0; index < ring.length - 1; index += 1) {
    const [x1, y1] = ring[index]; const [x2, y2] = ring[index + 1]; const cross = x1 * y2 - x2 * y1;
    twiceArea += cross; x += (x1 + x2) * cross; y += (y1 + y2) * cross;
  }
  return Math.abs(twiceArea) < 1e-15 ? null : { point: [x / (3 * twiceArea), y / (3 * twiceArea)], area: Math.abs(twiceArea) / 2 };
}
function polygonCentroid(geometry) {
  const centroids = exteriorRings(geometry).map(centroidRing).filter(Boolean);
  const totalArea = centroids.reduce((sum, value) => sum + value.area, 0);
  return totalArea ? centroids.reduce((point, value) => [point[0] + value.point[0] * value.area / totalArea, point[1] + value.point[1] * value.area / totalArea], [0, 0]) : null;
}
function pointDistance(point, start, end) {
  const dx = end[0] - start[0]; const dy = end[1] - start[1]; const divisor = dx * dx + dy * dy;
  const t = divisor ? Math.max(0, Math.min(1, ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) / divisor)) : 0;
  return Math.hypot(point[0] - (start[0] + t * dx), point[1] - (start[1] + t * dy));
}
function orientation(a, b, c) { return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]); }
function onSegment(a, b, point) { return Math.min(a[0], b[0]) - 1e-7 <= point[0] && point[0] <= Math.max(a[0], b[0]) + 1e-7 && Math.min(a[1], b[1]) - 1e-7 <= point[1] && point[1] <= Math.max(a[1], b[1]) + 1e-7; }
function intersects(a, b, c, d) {
  const abC = orientation(a, b, c); const abD = orientation(a, b, d); const cdA = orientation(c, d, a); const cdB = orientation(c, d, b);
  return ((abC > 0 && abD < 0) || (abC < 0 && abD > 0)) && ((cdA > 0 && cdB < 0) || (cdA < 0 && cdB > 0)) || (Math.abs(abC) < 1e-7 && onSegment(a, b, c)) || (Math.abs(abD) < 1e-7 && onSegment(a, b, d)) || (Math.abs(cdA) < 1e-7 && onSegment(c, d, a)) || (Math.abs(cdB) < 1e-7 && onSegment(c, d, b));
}
function segmentDistance(a, b, c, d) { return intersects(a, b, c, d) ? 0 : Math.min(pointDistance(a, c, d), pointDistance(b, c, d), pointDistance(c, a, b), pointDistance(d, a, b)); }
function intersection(a, b, c, d) {
  const rx = b[0] - a[0]; const ry = b[1] - a[1]; const sx = d[0] - c[0]; const sy = d[1] - c[1]; const denominator = rx * sy - ry * sx;
  if (Math.abs(denominator) < 1e-8) return null;
  const qpx = c[0] - a[0]; const qpy = c[1] - a[1]; const t = (qpx * sy - qpy * sx) / denominator; const u = (qpx * ry - qpy * rx) / denominator;
  return t >= -1e-7 && t <= 1 + 1e-7 && u >= -1e-7 && u <= 1 + 1e-7 ? [a[0] + t * rx, a[1] + t * ry] : null;
}
function nearestRoad(point, roads) { return roads.map((road) => ({ name: road.name, distance: Math.min(...road.segments.map(([a, b]) => pointDistance(point, a, b)) ) })).sort((a, b) => a.distance - b.distance)[0]; }
function nearestRoadToBoundary(boundary, roads) { return roads.map((road) => ({ name: road.name, distance: Math.min(...boundary.flatMap(([a, b]) => road.segments.map(([c, d]) => segmentDistance(a, b, c, d))) ) })).sort((a, b) => a.distance - b.distance)[0]; }
function address(radial, annular) { return `${radial} & ${annular}`; }
function geometryLabelPoint(geometry) {
  if (geometry?.type === "Polygon") return polygonLabelPoint(geometry.coordinates);
  if (geometry?.type === "MultiPolygon") for (const polygon of geometry.coordinates) { const point = polygonLabelPoint(polygon); if (point) return point; }
  return null;
}
function representativePoint(geometry, centroid) { const point = geometryLabelPoint(geometry); return point ? [point.longitude, point.latitude] : centroid; }
function sourceHash(text) { return createHash("sha256").update(text).digest("hex"); }
async function fetchText(url) { const response = await fetch(url, { headers: { Accept: "application/json" } }); if (!response.ok) fail(`${url} returned ${response.status}`); return response.text(); }
function sourceChanged(label, actual, expected) {
  return !expected
    || actual.url !== expected.url
    || actual.sha256 !== expected.sha256
    || actual.feature_count !== expected.feature_count
    || JSON.stringify(actual.schema) !== JSON.stringify(expected.schema);
}
function enforcePinnedSource(label, actual, expected) {
  if (!sourceChanged(label, actual, expected)) return;
  if (acceptSourceUpdate) return;
  fail(`${label} source differs from the checked-in manifest. Review the geometry change, then rerun with --accept-source-update to deliberately regenerate and update data/camp-address-inferred-2026.mjs.`);
}
function campSchema(campData) {
  const placed = campData.features.filter((feature) => typeof feature?.properties?.UID === "string" && typeof feature?.properties?.Name === "string" && (feature?.geometry?.type === "Polygon" || feature?.geometry?.type === "MultiPolygon"));
  return { type: campData.type, required_properties: ["UID", "Name"], allowed_geometry_types: ["Polygon", "MultiPolygon"], placed_feature_count: placed.length };
}
function streetSchema(streetData) {
  const radial = streetData.features.filter((feature) => feature?.properties?.source === "radial" && typeof feature?.properties?.name === "string");
  const annular = streetData.features.filter((feature) => feature?.properties?.source === "annular" && typeof feature?.properties?.name === "string");
  return { type: streetData.type, required_properties: ["source", "name"], allowed_geometry_types: ["LineString", "MultiLineString"], radial_feature_count: radial.length, annular_feature_count: annular.length };
}

const expectedStreetsUrl = expectedManifest?.sources?.streets?.url;
let streetsUrl = expectedStreetsUrl;
if (acceptSourceUpdate || typeof streetsUrl !== "string") {
  const commit = JSON.parse(await fetchText(githubCommitUrl)).sha;
  if (typeof commit !== "string" || !/^[0-9a-f]{40}$/i.test(commit)) fail("Could not resolve street-data commit");
  streetsUrl = `https://raw.githubusercontent.com/burningmantech/innovate-GIS-data/${commit}/2026/GeoJSON/street_lines.geojson`;
}
const [campsText, streetsText] = await Promise.all([fetchText(campsUrl), fetchText(streetsUrl)]);
const camps = JSON.parse(campsText); const streets = JSON.parse(streetsText);
if (camps?.type !== "FeatureCollection" || streets?.type !== "FeatureCollection" || !Array.isArray(camps.features) || !Array.isArray(streets.features)) fail("Expected GeoJSON FeatureCollections");
const campSource = { url: campsUrl, sha256: sourceHash(campsText), feature_count: camps.features.length, schema: campSchema(camps) };
const streetSource = { url: streetsUrl, sha256: sourceHash(streetsText), feature_count: streets.features.length, schema: streetSchema(streets) };
enforcePinnedSource("Camp placement", campSource, expectedManifest?.sources?.camps);
enforcePinnedSource("Street geometry", streetSource, expectedManifest?.sources?.streets);

const allCoordinates = streets.features.flatMap((feature) => lines(feature.geometry).flat());
const origin = allCoordinates.reduce((result, point) => [result[0] + point[0] / allCoordinates.length, result[1] + point[1] / allCoordinates.length], [0, 0]);
const toXY = ([longitude, latitude]) => [(longitude - origin[0]) * Math.PI / 180 * earthRadiusM * Math.cos(origin[1] * Math.PI / 180), (latitude - origin[1]) * Math.PI / 180 * earthRadiusM];
const streetParts = streets.features.flatMap((feature) => {
  const { source, name } = feature.properties ?? {};
  return (source === "radial" || source === "annular") && typeof name === "string" ? [{ source, name, segments: lines(feature.geometry).flatMap((line) => line.slice(1).map((point, index) => [toXY(line[index]), toXY(point)])) }] : [];
});
function groupRoads(source) {
  const names = [...new Set(streetParts.filter((road) => road.source === source).map((road) => road.name))];
  return names.map((name) => ({ name, segments: streetParts.filter((road) => road.source === source && road.name === name).flatMap((road) => road.segments) }));
}
const radial = groupRoads("radial"); const annular = groupRoads("annular");
const intersections = [];
for (const radialRoad of radial) for (const annularRoad of annular) for (const [a, b] of radialRoad.segments) for (const [c, d] of annularRoad.segments) {
  const point = intersection(a, b, c, d); if (point) intersections.push({ address: address(radialRoad.name, annularRoad.name), point });
}
if (!radial.length || !annular.length || !intersections.length) fail("Street geometry has no named radial/annular intersections");

const rows = camps.features.flatMap((feature) => {
  const uid = feature?.properties?.UID; const campName = feature?.properties?.Name; const geometry = feature?.geometry;
  if (typeof uid !== "string" || typeof campName !== "string" || !geometry) return [];
  const centroid = polygonCentroid(geometry); if (!centroid) return [];
  const representative = representativePoint(geometry, centroid); const boundary = exteriorRings(geometry).flatMap((ring) => ring.slice(1).map((point, index) => [toXY(ring[index]), toXY(point)]));
  if (!boundary.length) return [];
  const centroidXY = toXY(centroid); const representativeXY = toXY(representative);
  const centroidAddress = address(nearestRoad(centroidXY, radial).name, nearestRoad(centroidXY, annular).name);
  const representativeAddress = address(nearestRoad(representativeXY, radial).name, nearestRoad(representativeXY, annular).name);
  const boundaryAddress = address(nearestRoadToBoundary(boundary, radial).name, nearestRoadToBoundary(boundary, annular).name);
  const nearestIntersection = intersections.map((item) => ({ ...item, distance: Math.min(...boundary.map(([a, b]) => pointDistance(item.point, a, b))) })).sort((a, b) => a.distance - b.distance)[0];
  if (nearestIntersection.distance > maxBoundaryDistanceM || nearestIntersection.address !== representativeAddress || nearestIntersection.address !== boundaryAddress || centroidAddress !== representativeAddress) return [];
  return [{ uid, camp_name: campName, address: `Near ${nearestIntersection.address}`, source: "official_2026_gis_inference", confidence: "approximate", boundary_distance_m: Number(nearestIntersection.distance.toFixed(1)), source_url: campsUrl, source_note: "Derived from official 2026 camp polygons and pinned official street lines; centroid, representative-point, and boundary road methods agree; polygon boundary is within 10 m of the named intersection.", verified_at: new Date().toISOString().slice(0, 10) }];
});
const manifest = { version: ruleVersion, generated_at: new Date().toISOString(), rule: "nearest named intersection ≤10m from polygon boundary; centroid, representative-point, and boundary nearest-road addresses agree", sources: { camps: campSource, streets: streetSource }, inferred_count: rows.length };
const output = `// Generated by scripts/generate-camp-address-inference.mjs. Do not edit by hand.\nexport const inferredCampAddressManifest2026 = ${JSON.stringify(manifest, null, 2)};\n\nexport const inferredCampAddresses2026 = ${JSON.stringify(rows, null, 2)};\n`;
if (checkOnly) {
  const current = await fs.readFile(target, "utf8").catch(() => "");
  // `generated_at` is intentionally informational rather than a source
  // input, so it must not make an otherwise identical lookup look stale.
  const normalizeGeneratedAt = (value) => value.replace(/"generated_at": "[^"]+"/, '"generated_at": "<generated>"');
  if (normalizeGeneratedAt(current) !== normalizeGeneratedAt(output)) fail("Inferred camp address lookup is stale; run node scripts/generate-camp-address-inference.mjs");
  console.log(`Validated ${rows.length} inferred addresses against pinned geometry.`);
} else {
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, output);
  console.log(`Wrote ${rows.length} inferred addresses to ${target}`);
}
