import { NextRequest, NextResponse } from "next/server";
import { getKV } from "@/lib/kv";
import { calculate } from "@/lib/calculator";
import type {
  IncidentContext,
  ClaudeOutput,
  CalibrationConfig,
  CalibrationValues,
  WorksCatalog,
  MaterialsCatalog,
  RegionCoefficients,
} from "@/types";

import calibrationDefaults from "@/data/calibration_defaults.json";
import worksCatalogDefault from "@/data/works_catalog.json";
import materialsCatalogDefault from "@/data/materials_catalog.json";
import regionCoefficientsDefault from "@/data/region_coefficients.json";

function extractCalibrationValues(config: CalibrationConfig): CalibrationValues {
  const w = config.weights;
  return {
    range_sigma: w.range_sigma.default as number,
    finish_econom_factor: w.finish_econom_factor.default as number,
    finish_standard_factor: w.finish_standard_factor.default as number,
    finish_comfort_factor: w.finish_comfort_factor.default as number,
    finish_premium_factor: w.finish_premium_factor.default as number,
    vision_low_confidence_discount: w.vision_low_confidence_discount.default as number,
    stp_threshold_rub: w.stp_threshold_rub.default as number,
    critical_crack_mm: w.critical_crack_mm.default as number,
    mold_area_threshold_m2: w.mold_area_threshold_m2.default as number,
    wear_apply: w.wear_apply.default as boolean,
    default_ceiling_height_m: w.default_ceiling_height_m.default as number,
    tier_econom_multiplier: (w.tier_econom_multiplier?.default as number | undefined) ?? 0.6,
    tier_standard_multiplier: (w.tier_standard_multiplier?.default as number | undefined) ?? 1.0,
    tier_comfort_multiplier: (w.tier_comfort_multiplier?.default as number | undefined) ?? 1.5,
    tier_premium_multiplier: (w.tier_premium_multiplier?.default as number | undefined) ?? 2.5,
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { claudeOutput, context, overridePriority } = body as {
      claudeOutput: ClaudeOutput;
      context: IncidentContext;
      overridePriority?: number;
    };

    if (!claudeOutput || !context) {
      return NextResponse.json({ error: "claudeOutput and context required" }, { status: 400 });
    }

    const savedCalibration = await getKV<CalibrationValues>("calibration");
    const calibration = savedCalibration ?? extractCalibrationValues(calibrationDefaults as CalibrationConfig);

    const savedWorks = await getKV<WorksCatalog>("works_catalog");
    const savedMaterials = await getKV<MaterialsCatalog>("materials_catalog");

    const worksCatalog = savedWorks ?? (worksCatalogDefault as WorksCatalog);
    const materialsCatalog = savedMaterials ?? (materialsCatalogDefault as MaterialsCatalog);
    const regionCoefficients = regionCoefficientsDefault as RegionCoefficients;

    const report = calculate(
      claudeOutput,
      context,
      calibration,
      {
        works: worksCatalog.works,
        materials: materialsCatalog.materials,
        regions: regionCoefficients,
      },
      overridePriority
    );

    return NextResponse.json({ report });
  } catch (err) {
    return NextResponse.json({ error: "internal_error", message: String(err) }, { status: 500 });
  }
}
