import type {
  ClaudeOutput,
  IncidentContext,
  CalibrationValues,
  WorkCatalogEntry,
  MaterialCatalogEntry,
  RegionCoefficients,
  Report,
  WorkItem,
  MaterialItem,
  AreaEstimate,
} from "@/types";

// Authoritative area source, priority-ordered: measure > reference > declared > visual
// Returns the picked value + the full list of candidates for the UI to display.
export interface AreaPick {
  value: number;
  source: string;
  candidates: Array<AreaEstimate & { priority: number; used: boolean }>;
}

export function pickAuthoritativeArea(
  claude: ClaudeOutput,
  declaredAreaM2: number | undefined
): AreaPick {
  const candidates: Array<AreaEstimate & { priority: number; used: boolean }> = [];

  if (claude.area_from_measure && claude.area_from_measure.value > 0) {
    candidates.push({ ...claude.area_from_measure, priority: 1, used: false });
  }
  if (claude.area_from_reference && claude.area_from_reference.value > 0) {
    candidates.push({ ...claude.area_from_reference, priority: 2, used: false });
  }
  if (declaredAreaM2 && declaredAreaM2 > 0) {
    candidates.push({ value: declaredAreaM2, source: "заявлено клиентом", priority: 3, used: false });
  }
  if (claude.area_visual && claude.area_visual.value > 0) {
    candidates.push({ ...claude.area_visual, priority: 4, used: false });
  }

  // Sort by priority ascending (1 wins)
  candidates.sort((a, b) => a.priority - b.priority);
  if (candidates.length === 0) {
    return { value: 1, source: "нет данных (fallback 1 м²)", candidates: [] };
  }

  const winner = candidates[0];
  winner.used = true;
  return { value: winner.value, source: winner.source, candidates };
}

interface Catalogs {
  works: WorkCatalogEntry[];
  materials: MaterialCatalogEntry[];
  regions: RegionCoefficients;
}

function getFinishFactor(finishLevel: string | undefined, calibration: CalibrationValues): number {
  switch (finishLevel) {
    case "econom": return calibration.finish_econom_factor;
    case "standard": return calibration.finish_standard_factor;
    case "comfort": return calibration.finish_comfort_factor;
    case "premium": return calibration.finish_premium_factor;
    default: return calibration.finish_standard_factor;
  }
}

// Compute volume of a work item. `A` = damaged area (user-declared), `P` = approx perimeter.
// Area-based works (paint, level, wallpaper, floor) use A directly.
// Linear works (plinths, door/window casings) use P. Doors use count.
function computeVolume(code: string, A: number, P: number): number {
  const category = code.split("-")[0];

  switch (category) {
    case "DEM":
      if (code === "DEM-001" || code === "DEM-002") return P;
      if (code === "DEM-003") return Math.max(1, Math.round(P / 6));
      return A;

    case "PREP":
    case "LEVEL":
    case "PAINT":
    case "WALL":
    case "FLOOR":
      return A;

    case "DOOR":
      return Math.max(1, Math.round(P / 6));

    case "TRIM":
      return code === "TRIM-003" ? Math.max(1, Math.round(P / 6)) : P;

    default:
      return A;
  }
}

// Map work codes (from works_catalog.json) to material codes (from materials_catalog.json)
const WORK_TO_MATERIALS: Record<string, string[]> = {
  "PREP-001": ["MAT-ANTI-01", "MAT-PRIMER-01"],
  "PREP-002": ["MAT-PRIMER-01"],
  "LEVEL-001": ["MAT-PLAST-01"],
  "LEVEL-002": ["MAT-PLAST-01"],
  "LEVEL-003": ["MAT-PLAST-01"],
  "LEVEL-004": ["MAT-FILL-01"],
  "LEVEL-005": ["MAT-FILL-01"],
  "PAINT-001": ["MAT-PAINT-01"],
  "PAINT-002": ["MAT-PAINT-01"],
  "WALL-001":  ["MAT-WALL-01"],
  "WALL-002":  ["MAT-WALL-01"],
  "WALL-003":  ["MAT-TILE-WALL-01", "MAT-TILE-GLUE-01"],
  "FLOOR-001": ["MAT-LAM-01", "MAT-UNDER-01"],
  "FLOOR-002": ["MAT-LINO-01"],
  "FLOOR-003": ["MAT-TILE-01", "MAT-TILE-GLUE-01"],
  "FLOOR-004": ["MAT-HEAT-FLOOR-01"],
  "FLOOR-005": ["MAT-CARPET-01"],
  "DOOR-001":  ["MAT-DOOR-01"],
  "TRIM-001":  ["MAT-PLINTH-01"],
  "TRIM-002":  ["MAT-PLINTH-02"],
};

export function calculate(
  claudeOutput: ClaudeOutput,
  context: IncidentContext,
  calibration: CalibrationValues,
  catalogs: Catalogs
): Report {
  const areaPick = pickAuthoritativeArea(claudeOutput, context.affected_area_m2);
  const S = areaPick.value;
  const h = context.ceiling_height
    ? typeof context.ceiling_height === "number"
      ? context.ceiling_height
      : calibration.default_ceiling_height_m
    : calibration.default_ceiling_height_m;

  // Approximate perimeter (for linear works: plinths, casings)
  // S here is the user-declared damaged area — we only need P for non-area works.
  const P = 2 * Math.sqrt(Math.max(S, 4) * 1.2);
  void h;

  const regionKey = context.region || "moscow";
  const regionData = catalogs.regions.regions[regionKey] ?? catalogs.regions.regions["moscow"];
  const worksCoef = regionData.works_coefficient;
  const materialsCoef = regionData.materials_coefficient;
  const finishFactor = getFinishFactor(context.finish_level, calibration);

  const currentYear = new Date().getFullYear();
  const renovationAge = currentYear - (context.last_renovation_year ?? currentYear - 10);

  // Filter out LOG (мусорный контейнер / вынос мусора) for small damage — not economical under 20 m²
  const SMALL_AREA_THRESHOLD_M2 = 20;
  const effectiveWorks = claudeOutput.recommended_works.filter((code) => {
    if (S < SMALL_AREA_THRESHOLD_M2 && (code === "LOG-001" || code === "LOG-002")) return false;
    return true;
  });

  // Build work items
  const workItems: WorkItem[] = [];
  for (const code of effectiveWorks) {
    const catalogEntry = catalogs.works.find((w) => w.code === code);
    if (!catalogEntry) continue;

    const volume = computeVolume(code, S, P);
    const unitPrice = Math.round(catalogEntry.base_price_rub * worksCoef * finishFactor);
    const total = Math.round(volume * unitPrice);

    workItems.push({
      code,
      name: catalogEntry.name,
      unit: catalogEntry.unit,
      volume: Math.round(volume * 100) / 100,
      unit_price: unitPrice,
      total,
    });
  }

  // Build material items — volume derived from each linked work's computed volume
  const materialItems: MaterialItem[] = [];
  const usedMaterialCodes = new Set<string>();

  for (const work of workItems) {
    const matCodes = WORK_TO_MATERIALS[work.code] ?? [];
    for (const matCode of matCodes) {
      if (usedMaterialCodes.has(matCode)) continue;
      usedMaterialCodes.add(matCode);

      const matEntry = catalogs.materials.find((m) => m.code === matCode);
      if (!matEntry) continue;

      // consumption_m2_per_package: coverage per 1 package
      // (field name is historical — also means "п.м. на упаковку" for плинтус, "шт" for двери)
      const coveredPerPackage = matEntry.consumption_m2_per_package ?? 1;
      const packages = Math.max(1, Math.ceil(work.volume / coveredPerPackage));
      const volume = packages;
      let unitPrice = Math.round(matEntry.base_price_rub * materialsCoef);
      let total = Math.round(volume * unitPrice);

      // Apply wear coefficient per ВСН 53-86(р)
      if (calibration.wear_apply && matEntry.service_life_years > 0) {
        const wearK = Math.min(1, renovationAge / matEntry.service_life_years);
        total = Math.round(total * (1 - wearK));
        unitPrice = volume > 0 ? Math.round(total / volume) : unitPrice;
      }

      materialItems.push({
        code: matCode,
        name: matEntry.name,
        unit: matEntry.package_unit,
        volume: Math.round(volume * 100) / 100,
        unit_price: unitPrice,
        total,
      });
    }
  }

  const worksTotal = workItems.reduce((acc, w) => acc + w.total, 0);
  const materialsTotal = materialItems.reduce((acc, m) => acc + m.total, 0);
  let base = worksTotal + materialsTotal;

  // Discount for low confidence
  if (claudeOutput.average_confidence < 0.6) {
    base = Math.round(base * calibration.vision_low_confidence_discount);
  }

  const sigma = calibration.range_sigma;

  return {
    range: {
      min: Math.round(base * (1 - sigma)),
      base: Math.round(base),
      max: Math.round(base * (1 + sigma)),
    },
    sigma,
    works: workItems,
    materials: materialItems,
    routed_to_expert: base > calibration.stp_threshold_rub,
    claude_output: claudeOutput,
    area_pick: areaPick,
  };
}
