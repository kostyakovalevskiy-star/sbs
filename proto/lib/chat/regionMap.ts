// DaData ISO region code → internal region key (matches data/region_coefficients.json).
// Internal region pool is small (9 entries: moscow, spb, ekb, nsk, kazan, voronezh,
// krasnodar, other_central, other_far). Anything outside the named cities falls back
// to "other_central" or "other_far" by federal district.

const NAMED: Record<string, string> = {
  "RU-MOW": "moscow",
  "RU-SPE": "spb",
  "RU-SVE": "ekb",
  "RU-NVS": "nsk",
  "RU-TA": "kazan",
  "RU-VOR": "voronezh",
  "RU-KDA": "krasnodar",
};

// Far regions (Сибирь + Дальний Восток) → other_far. Everything else → other_central.
const FAR: Set<string> = new Set([
  "RU-AL",  "RU-ALT", "RU-IRK", "RU-KEM", "RU-KHA", "RU-KGN",
  "RU-KK",  "RU-KYA", "RU-OMS", "RU-TOM", "RU-TYU", "RU-TY",
  "RU-AMU", "RU-BU",  "RU-CHU", "RU-KAM", "RU-MAG", "RU-PRI",
  "RU-SA",  "RU-SAK", "RU-YEV", "RU-ZAB",
]);

export function regionFromIso(iso: string | undefined | null): string {
  if (!iso) return "moscow";
  const named = NAMED[iso];
  if (named) return named;
  if (FAR.has(iso)) return "other_far";
  return "other_central";
}
