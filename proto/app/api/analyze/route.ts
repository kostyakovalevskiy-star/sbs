import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getKV, setKV } from "@/lib/kv";
import { SYSTEM_PROMPT, buildUserMessage, parseClaudeResponse, ClaudeParseError } from "@/lib/prompts";
import { calculate } from "@/lib/calculator";
import { generateId } from "@/lib/utils";
import type {
  IncidentContext,
  CalibrationConfig,
  CalibrationValues,
  WorksCatalog,
  MaterialsCatalog,
  RegionCoefficients,
  CaseRecord,
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
  };
}

async function callClaude(
  client: Anthropic,
  context: IncidentContext,
  photos: Array<{ base64: string }>,
  workCodes: Array<{ code: string; name: string }>
): Promise<string> {
  const userContent = buildUserMessage(context, photos, workCodes);

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: userContent as Anthropic.MessageParam["content"],
      },
    ],
  });

  const block = response.content[0];
  if (block.type !== "text") throw new ClaudeParseError("No text in response");
  return block.text;
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    const contextStr = formData.get("context") as string | null;
    if (!contextStr) {
      return NextResponse.json({ error: "context is required" }, { status: 400 });
    }

    let context: IncidentContext;
    try {
      context = JSON.parse(contextStr);
    } catch {
      return NextResponse.json({ error: "Invalid context JSON" }, { status: 400 });
    }

    const photoFiles = formData.getAll("photos") as File[];
    if (photoFiles.length === 0) {
      return NextResponse.json({ error: "At least 1 photo required" }, { status: 400 });
    }
    if (photoFiles.length > 10) {
      return NextResponse.json({ error: "Maximum 10 photos" }, { status: 400 });
    }

    // Convert photos to base64
    const photos: Array<{ base64: string }> = [];
    const photosBase64: string[] = [];
    for (const file of photoFiles) {
      const buffer = await file.arrayBuffer();
      const base64 = Buffer.from(buffer).toString("base64");
      photos.push({ base64 });
      photosBase64.push(base64);
    }

    // Load calibration
    const savedCalibration = await getKV<CalibrationValues>("calibration");
    let calibration: CalibrationValues;
    if (savedCalibration) {
      calibration = savedCalibration;
    } else {
      calibration = extractCalibrationValues(calibrationDefaults as CalibrationConfig);
    }

    // Load catalogs
    const savedWorks = await getKV<WorksCatalog>("works_catalog");
    const savedMaterials = await getKV<MaterialsCatalog>("materials_catalog");

    const worksCatalog = savedWorks ?? (worksCatalogDefault as WorksCatalog);
    const materialsCatalog = savedMaterials ?? (materialsCatalogDefault as MaterialsCatalog);
    const regionCoefficients = regionCoefficientsDefault as RegionCoefficients;

    const workCodes = worksCatalog.works.map((w) => ({ code: w.code, name: w.name }));

    // Call Claude
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    let claudeText: string;
    try {
      claudeText = await callClaude(client, context, photos, workCodes);
    } catch (err) {
      return NextResponse.json(
        { error: "anthropic_error", message: String(err) },
        { status: 502 }
      );
    }

    let claudeOutput;
    try {
      claudeOutput = parseClaudeResponse(claudeText);
    } catch {
      // Retry once
      try {
        claudeText = await callClaude(client, context, photos, workCodes);
        claudeOutput = parseClaudeResponse(claudeText);
      } catch {
        return NextResponse.json({ error: "ai_parse_failed" }, { status: 422 });
      }
    }

    // Calculate report
    const report = calculate(claudeOutput, context, calibration, {
      works: worksCatalog.works,
      materials: materialsCatalog.materials,
      regions: regionCoefficients,
    });

    // Save case
    const caseId = context.id || generateId();
    const caseRecord: CaseRecord = {
      id: caseId,
      created_at: new Date().toISOString(),
      context: { ...context, id: caseId },
      report,
      photos_count: photos.length,
      status: report.routed_to_expert ? "expert" : "complete",
      photos: photosBase64,
    };

    await setKV(`case:${caseId}`, caseRecord);

    // Update cases index
    const existingIndex = (await getKV<string[]>("cases:index")) ?? [];
    if (!existingIndex.includes(caseId)) {
      await setKV("cases:index", [...existingIndex, caseId]);
    }

    return NextResponse.json({ id: caseId, report });
  } catch (err) {
    console.error("analyze error:", err);
    return NextResponse.json({ error: "internal_error", message: String(err) }, { status: 500 });
  }
}
