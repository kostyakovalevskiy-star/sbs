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
} from "@/types";

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

// Compute volume of a work item based on code and context geometry
function computeVolume(
  code: string,
  S: number,
  S_walls: number,
  P: number,
  h: number,
  claudeOutput: ClaudeOutput
): number {
  const category = code.split("-")[0];

  switch (category) {
    case "DEM":
      // Demolition - mostly wall/floor area
      if (code === "DEM-001" || code === "DEM-002") return P; // linear meters
      if (code === "DEM-003") return Math.max(1, Math.round(P / 6)); // doors count
      return S_walls; // m2

    case "PREP":
      // Preparation - surface area
      if (code.includes("CEIL") || code.includes("POT")) return S; // ceiling
      return S_walls; // walls

    case "LEVEL":
      // Leveling - walls or ceiling
      if (code.includes("POT") || code.includes("CEIL")) return S;
      return S_walls;

    case "PAINT":
      // Painting
      if (code.includes("POT") || code.includes("CEIL")) return S;
      return S_walls;

    case "WALL":
      // Wallpaper
      return S_walls;

    case "FLOOR":
      // Floor works
      return S;

    case "DOOR":
      return Math.max(1, Math.round(P / 6));

    case "TRIM":
      // TRIM-001 (floor), TRIM-002 (ceiling), TRIM-003 (door casing)
      return code === "TRIM-003" ? Math.max(1, Math.round(P / 6)) : P;

    default: {
      // Fallback: use average area estimate from Claude photos
      const avgArea = claudeOutput.photos.reduce(
        (acc, p) => acc + (p.area_estimate_m2 || 0), 0
      ) / Math.max(1, claudeOutput.photos.length);
      return Math.max(1, avgArea || S);
    }
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
  "FLOOR-001": ["MAT-LAM-01", "MAT-UNDER-01"],
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
  const S = context.affected_area_m2 ?? 10;
  const h = context.ceiling_height
    ? typeof context.ceiling_height === "number"
      ? context.ceiling_height
      : calibration.default_ceiling_height_m
    : calibration.default_ceiling_height_m;

  // Approximate perimeter and wall area
  const P = 2 * Math.sqrt(S * 1.2);
  const S_walls = Math.max(0, P * h - 2.0); // subtract one 2m² doorway

  const regionKey = context.region || "moscow";
  const regionData = catalogs.regions.regions[regionKey] ?? catalogs.regions.regions["moscow"];
  const worksCoef = regionData.works_coefficient;
  const materialsCoef = regionData.materials_coefficient;
  const finishFactor = getFinishFactor(context.finish_level, calibration);

  const currentYear = new Date().getFullYear();
  const renovationAge = currentYear - (context.last_renovation_year ?? currentYear - 10);

  // Build work items
  const workItems: WorkItem[] = [];
  for (const code of claudeOutput.recommended_works) {
    const catalogEntry = catalogs.works.find((w) => w.code === code);
    if (!catalogEntry) continue;

    const volume = computeVolume(code, S, S_walls, P, h, claudeOutput);
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
  };
}
