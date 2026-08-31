/**
 * Human-verified 2026 camp addresses, keyed by the stable UID in the official
 * 2026 camp GeoJSON. Add entries here when an inference needs correcting.
 *
 * Required fields per entry:
 *   uid, camp_name, address, source_url, source_note, confidence, verified_at
 *
 * `address` must be a reviewed location string (for example "4:45 & G" or a
 * named-street address), without the "Near" prefix. The app treats this list
 * as an optional supplement to official data.
 */
export const curatedCampAddresses2026 = [
  {
    uid: "a1XVI00000FP9Vh2AL",
    camp_name: "Alchemist Bazaar",
    address: "3:30 & D",
    source: "curated_2026_lookup",
    source_url: "https://gaianairship.org/",
    source_note: "2026 camp site lists the 3:30 & D placement; manually reviewed.",
    confidence: "reviewed",
    verified_at: "2026-08-30",
  },
  {
    uid: "a1XVI00000FK2Zh2AL",
    camp_name: "Rootpile",
    address: "8:15 & D",
    source: "curated_2026_lookup",
    source_url: "https://www.rootpile.com/camp-logistics",
    source_note: "2026 camp logistics page lists the 8:15 & D placement; manually reviewed.",
    confidence: "reviewed",
    verified_at: "2026-08-30",
  },
  {
    uid: "a1XVI00000FIZpt2AH",
    camp_name: "AdramaNation",
    address: "7:15 & Chomolungma",
    source: "curated_2026_lookup",
    source_url: "https://www.adramanation.com/",
    source_note: "2026 camp site names the 7:15 & Chomolungma placement; manually reviewed.",
    confidence: "reviewed",
    verified_at: "2026-08-30",
  },
  {
    uid: "a1XVI00000FPeUf2AL",
    camp_name: "Beaverton",
    address: "6:45 & E",
    source: "curated_2026_lookup",
    source_url: "https://campbeaverton.org/events/burning-man-2026/",
    source_note: "2026 camp event page lists the 6:45 & E placement; manually reviewed.",
    confidence: "reviewed",
    verified_at: "2026-08-30",
  },
  {
    uid: "a1XVI00000FMdtJ2AT",
    camp_name: "Shamandome",
    address: "6:45 & F",
    source: "curated_2026_lookup",
    source_url: "https://shamandome.info/burning-man",
    source_note: "2026 camp page lists the 6:45 & F placement; manually reviewed.",
    confidence: "reviewed",
    verified_at: "2026-08-30",
  },
  {
    uid: "a1XVI00000FLLlZ2AX",
    camp_name: "The Astral Social Club",
    address: "6:45 & B",
    source: "curated_2026_lookup",
    source_url: "https://burningman.org/arts-innovation/sustainability/the-green-corridor/",
    source_note: "Burning Man's Green Corridor information lists the 6:45 & B placement; manually reviewed.",
    confidence: "reviewed",
    verified_at: "2026-08-30",
  },
];
