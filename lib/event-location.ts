/** A resolved 2026 placed-camp location returned alongside an event. */
export type EventLocation = {
  source: "camp";
  label_point: {
    longitude: number;
    latitude: number;
  };
  /** Official 2026 camp address (for example, "4:45 & G") when available. */
  playa_address?: string;
  playa_address_source?: "official_2026_camp_api" | "curated_2026_lookup" | "official_2026_gis_inference";
  playa_address_confidence?: "high" | "reviewed" | "approximate";
  playa_address_distance_m?: number;
  playa_address_checked_at?: string;
};

type LocationRecord = Record<string, unknown>;

export type OfficialCampCoordinates = {
  longitude: number;
  latitude: number;
};

/** The two-line location treatment used anywhere an event is presented. */
export type EventLocationDisplay = {
  /** The address only when it is a complete clock-and-street playa address. */
  playaAddress: string | null;
  /** The raw, non-placeholder location supplied by the event source. */
  listedLocation: string;
  /** Camp first when a camp and playa address are both known. */
  primary: string;
  /** The corresponding playa address, when it adds new information. */
  secondary: string | null;
  /** Whether the camp name is already visible in the location block. */
  campInLocation: boolean;
};

export type EventAddressProvenance = {
  kind: "reviewed" | "map_derived";
  checkedAt: string | null;
};

function isRecord(value: unknown): value is LocationRecord {
  return typeof value === "object" && value !== null;
}

/**
 * Returns coordinates only for a validated 2026 official camp label point.
 * API data is treated as untrusted here so malformed values cannot be shown or linked.
 */
export function getOfficialCampCoordinates(location: unknown): OfficialCampCoordinates | null {
  if (!isRecord(location) || location.source !== "camp") return null;

  const labelPoint = location.label_point;
  if (!isRecord(labelPoint)) return null;

  const { longitude, latitude } = labelPoint;
  if (
    typeof longitude !== "number" || !Number.isFinite(longitude) || longitude < -180 || longitude > 180
    || typeof latitude !== "number" || !Number.isFinite(latitude) || latitude < -90 || latitude > 90
  ) return null;

  return { longitude, latitude };
}

/** Produces a map URL for the same validated official camp point. */
export function getOfficialCampMapUrl(location: unknown): string | null {
  const point = getOfficialCampCoordinates(location);
  if (!point) return null;

  const lat = point.latitude.toString();
  const lon = point.longitude.toString();
  return `https://www.openstreetmap.org/?mlat=${encodeURIComponent(lat)}&mlon=${encodeURIComponent(lon)}#map=18/${encodeURIComponent(lat)}/${encodeURIComponent(lon)}`;
}

function isOfficialCampLocation(location: unknown): location is LocationRecord {
  return getOfficialCampCoordinates(location) !== null;
}

function formatClockStreetAddress(value: string): string | null {
  const match = value.trim().match(/^(?:([1-9]|1[0-2]):(00|15|30|45))\s*(?:\+|&)\s*([A-L]|ESP|ESPLANADE)$/i);
  if (!match) return null;
  const street = /^esp(?:lanade)?$/i.test(match[3]) ? "Esplanade" : match[3].toUpperCase();
  return `${match[1]}:${match[2]} & ${street}`;
}

/**
 * Returns an official street address when supplied by Burning Man's camp API.
 * If that optional API is unavailable, accept only a complete clock/street
 * value already present in the event sheet; free text and "Open Playa" never
 * become an inferred address.
 */
export function getEventPlayaAddress(location: unknown, where: unknown): string | null {
  // A strict address entered for this specific event wins over any camp-level
  // lookup. This is especially important for camps with multiple venues.
  if (typeof where === "string") {
    const sheetAddress = formatClockStreetAddress(where);
    if (sheetAddress) return sheetAddress;
  }

  if (isOfficialCampLocation(location) && typeof location.playa_address === "string") {
    const official = location.playa_address.replace(/\s+/g, " ").trim();
    if (official && official.length <= 160) return formatClockStreetAddress(official) ?? official;
  }

  return null;
}

/** Provenance is only shown for an address that is actually being displayed. */
export function getEventAddressProvenance(location: unknown, where: unknown): EventAddressProvenance | null {
  if (typeof where === "string" && formatClockStreetAddress(where)) return null;
  if (!isOfficialCampLocation(location)) return null;
  const source = location.playa_address_source;
  const checkedAt = typeof location.playa_address_checked_at === "string" ? location.playa_address_checked_at : null;
  if (source === "curated_2026_lookup") return { kind: "reviewed", checkedAt };
  if (source === "official_2026_gis_inference") return { kind: "map_derived", checkedAt };
  return null;
}

function cleanLocationText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/\s+/g, " ").trim();
  return cleaned && cleaned !== "-" ? cleaned : null;
}

function isSameLocation(left: string, right: string): boolean {
  return left.replace(/\+/g, "&").replace(/\s+/g, " ").trim().toLocaleLowerCase()
    === right.replace(/\+/g, "&").replace(/\s+/g, " ").trim().toLocaleLowerCase();
}

/**
 * Keeps the familiar free-text location when no reliable playa address exists.
 * When both are available, camp is the headline and the clock/street address
 * is the supporting line, so neither one overwrites the other.
 */
export function getEventLocationDisplay(location: unknown, camp: unknown, where: unknown): EventLocationDisplay {
  const campName = cleanLocationText(camp);
  const whereText = cleanLocationText(where);
  const playaAddress = getEventPlayaAddress(location, where);

  if (playaAddress && campName && !isSameLocation(campName, playaAddress)) {
    return {
      playaAddress,
      listedLocation: whereText ?? campName,
      primary: campName,
      secondary: playaAddress,
      campInLocation: true,
    };
  }

  const primary = playaAddress ?? whereText ?? campName ?? "—";
  return {
    playaAddress,
    listedLocation: whereText ?? campName ?? "—",
    primary,
    secondary: null,
    campInLocation: Boolean(campName && isSameLocation(campName, primary)),
  };
}
