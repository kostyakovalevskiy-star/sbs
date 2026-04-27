import { NextRequest, NextResponse } from "next/server";
import { getKV, setKV } from "@/lib/kv";
import type { CalibrationValues } from "@/types";
import calibrationDefaults from "@/data/calibration_defaults.json";

export async function GET() {
  const saved = await getKV<CalibrationValues>("calibration");
  if (saved) return NextResponse.json(saved);

  // Return extracted defaults
  const w = calibrationDefaults.weights;
  const defaults: CalibrationValues = {
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
  return NextResponse.json(defaults);
}

export async function PUT(req: NextRequest) {
  const body = await req.json() as CalibrationValues;
  await setKV("calibration", body);
  return NextResponse.json({ ok: true });
}
