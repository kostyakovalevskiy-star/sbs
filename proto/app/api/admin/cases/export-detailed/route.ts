import { NextResponse } from "next/server";
import { getKV, listKV } from "@/lib/kv";
import { listCorrectionsForCase } from "@/lib/corrections";
import type {
  CaseRecord,
  Correction,
  CorrectionItem,
  MaterialItem,
  WorkItem,
} from "@/types";

// One row per (case, item) — long format. Aimed at being fed back to
// Claude for calibration tuning: for each case the row shows what the
// original AI produced (qty/price/total) AND what the administrator
// corrected, plus all the upstream context (event type, area_pick source,
// finish level, region, photo count, claude summary). Diff signal lives
// in `change_type`; rows without an active correction get `change_type =
// оригинал` and identical original/corrected columns.

const COLUMNS = [
  "case_id",
  "case_short",
  "created_at",
  "event_type",
  "region",
  "address",
  "apartment_area_m2",
  "finish_level",
  "ceiling_height_m",
  "wall_material",
  "last_renovation_year",
  "has_uk_act",
  "claude_summary",
  "claude_avg_confidence",
  "photos_count",
  "area_pick_value",
  "area_pick_source",
  "original_base_rub",
  "corrected_total_rub",
  "correction_status",
  "version",
  "section",
  "item_code",
  "item_name",
  "item_unit",
  "original_qty",
  "corrected_qty",
  "original_unit_price_rub",
  "corrected_unit_price_rub",
  "original_total_rub",
  "corrected_total_rub_item",
  "change_type",
  "room",
  "surface",
  "reason",
];

function csvField(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n;]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function num(v: number | undefined | null): string {
  if (v === undefined || v === null || Number.isNaN(v)) return "";
  return String(v);
}

interface BaseCaseFields {
  case_id: string;
  case_short: string;
  created_at: string;
  event_type: string;
  region: string;
  address: string;
  apartment_area_m2: string;
  finish_level: string;
  ceiling_height_m: string;
  wall_material: string;
  last_renovation_year: string;
  has_uk_act: string;
  claude_summary: string;
  claude_avg_confidence: string;
  photos_count: string;
  area_pick_value: string;
  area_pick_source: string;
  original_base_rub: string;
  corrected_total_rub: string;
  correction_status: string;
}

function baseFields(c: CaseRecord, correction: Correction | null): BaseCaseFields {
  const ctx = c.context;
  const r = c.report;
  return {
    case_id: c.id,
    case_short: `K-${c.id.slice(0, 8).toUpperCase()}`,
    created_at: c.created_at,
    event_type: ctx.event_type ?? "",
    region: ctx.region ?? "",
    address: ctx.address ?? "",
    apartment_area_m2: num(ctx.apartment_area_m2),
    finish_level: ctx.finish_level ?? "",
    ceiling_height_m:
      typeof ctx.ceiling_height === "number" ? String(ctx.ceiling_height) : "",
    wall_material: ctx.wall_material ?? "",
    last_renovation_year: num(ctx.last_renovation_year),
    has_uk_act: ctx.has_uk_act === undefined ? "" : ctx.has_uk_act ? "yes" : "no",
    claude_summary: r?.claude_output?.summary?.replace(/\s+/g, " ").trim() ?? "",
    claude_avg_confidence: num(r?.claude_output?.average_confidence),
    photos_count: num(c.photos_count),
    area_pick_value: num(r?.area_pick?.value),
    area_pick_source: r?.area_pick?.source ?? "",
    original_base_rub: num(r?.range.base),
    corrected_total_rub: correction ? String(correction.summary.total) : "",
    correction_status: correction ? correction.status : "оригинал",
  };
}

function rowFor(
  base: BaseCaseFields,
  version: "оригинал" | "корректировка",
  section: "work" | "material",
  details: {
    code: string;
    name: string;
    unit: string;
    original_qty?: number;
    corrected_qty?: number;
    original_unit_price?: number;
    corrected_unit_price?: number;
    original_total?: number;
    corrected_total_item?: number;
    change_type: string;
    room?: string;
    surface?: string;
    reason?: string;
  }
): string {
  const cols: Record<(typeof COLUMNS)[number], string> = {
    ...base,
    version,
    section,
    item_code: details.code,
    item_name: details.name,
    item_unit: details.unit,
    original_qty: num(details.original_qty),
    corrected_qty: num(details.corrected_qty),
    original_unit_price_rub: num(details.original_unit_price),
    corrected_unit_price_rub: num(details.corrected_unit_price),
    original_total_rub: num(details.original_total),
    corrected_total_rub_item: num(details.corrected_total_item),
    change_type: details.change_type,
    room: details.room ?? "",
    surface: details.surface ?? "",
    reason: details.reason ?? "",
  };
  return COLUMNS.map((k) => csvField(cols[k])).join(",");
}

function emitItemFromCorrection(
  base: BaseCaseFields,
  it: CorrectionItem
): string {
  const orig = it.originalSnapshot;
  return rowFor(base, "корректировка", it.section === "material" ? "material" : "work", {
    code: orig?.name === it.name ? "" : "", // correction items don't carry the catalog code
    name: it.name,
    unit: it.unit,
    original_qty: orig?.qty,
    corrected_qty: it.changeType === "removed" ? undefined : it.qty,
    original_unit_price: orig?.price,
    corrected_unit_price: it.changeType === "removed" ? undefined : it.price,
    original_total: orig?.amount,
    corrected_total_item: it.changeType === "removed" ? 0 : it.amount,
    change_type: it.changeType,
    room: it.room,
    surface: it.surface,
    reason: it.reason,
  });
}

function emitItemFromOriginal(
  base: BaseCaseFields,
  section: "work" | "material",
  item: WorkItem | MaterialItem
): string {
  return rowFor(base, "оригинал", section, {
    code: item.code,
    name: item.name,
    unit: item.unit,
    original_qty: item.volume,
    corrected_qty: item.volume,
    original_unit_price: item.unit_price,
    corrected_unit_price: item.unit_price,
    original_total: item.total,
    corrected_total_item: item.total,
    change_type: "оригинал",
    room: item.room,
    surface: item.surface,
  });
}

export async function GET() {
  const keys = await listKV("case:");
  const lines: string[] = [COLUMNS.join(",")];

  for (const key of keys) {
    const c = await getKV<CaseRecord>(key);
    if (!c) continue;

    const corrections = await listCorrectionsForCase(c.id);
    const fixed = corrections.find((x) => x.status === "fixed");
    const draft = corrections.find((x) => x.status === "draft");
    const correction = fixed ?? draft ?? null;
    const base = baseFields(c, correction);

    if (correction) {
      // Emit one row per correction item — original snapshot side-by-side
      // with the corrected values lets the consumer compute the delta
      // without needing to join two tables.
      for (const it of correction.items) {
        lines.push(emitItemFromCorrection(base, it));
      }
    } else if (c.report) {
      for (const w of c.report.works) {
        lines.push(emitItemFromOriginal(base, "work", w));
      }
      for (const m of c.report.materials) {
        lines.push(emitItemFromOriginal(base, "material", m));
      }
    } else {
      // Routed-to-expert case with no report — emit a single placeholder row
      // so the consumer still sees the case existed.
      lines.push(
        rowFor(base, "оригинал", "work", {
          code: "",
          name: "(без расчёта — кейс ушёл эксперту)",
          unit: "",
          change_type: "expert",
        })
      );
    }
  }

  // BOM so Excel opens UTF-8 cleanly.
  const body = "﻿" + lines.join("\n");
  const today = new Date().toISOString().slice(0, 10);
  const filename = `cases_detailed_${today}.csv`;

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  });
}
