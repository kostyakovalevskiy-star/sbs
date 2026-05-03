import { NextRequest, NextResponse } from "next/server";
import { getKV } from "@/lib/kv";
import { getCorrection } from "@/lib/corrections";
import type { CaseRecord, CorrectionItem } from "@/types";

interface Params {
  params: Promise<{ id: string }>;
}

// GET /api/admin/corrections/:id/export?mode=clean|draft&format=json
//
// `mode=clean` (чистовик): only final values, removed items hidden.
// `mode=draft` (черновик): full diff payload with old + new + changeType.
//
// Only `format=json` is implemented here; PDF rendering happens client-side
// via window.print() over the report page (which already styles itself for
// print). XLSX skipped for the prototype.

export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const url = new URL(req.url);
  const mode = (url.searchParams.get("mode") ?? "clean") as "clean" | "draft";
  const format = url.searchParams.get("format") ?? "json";

  const correction = await getCorrection(id);
  if (!correction) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const caseRecord = await getKV<CaseRecord>(`case:${correction.caseId}`);
  if (!caseRecord) return NextResponse.json({ error: "case_not_found" }, { status: 404 });

  if (format !== "json") {
    return NextResponse.json(
      { error: "format_not_supported", hint: "use format=json or window.print() the report page" },
      { status: 400 }
    );
  }

  const number = caseRecord.id.slice(0, 8).toUpperCase();
  const dateIso = (correction.fixedAt ?? correction.createdAt).slice(0, 10);
  const filename = `K-${number}_отчёт_${mode === "clean" ? "чистовик" : "черновик"}_${dateIso}.json`;

  const head = {
    case_id: caseRecord.id,
    case_number: number,
    client: caseRecord.context.name,
    address: caseRecord.context.address,
    event_type: caseRecord.context.event_type,
    event_date: caseRecord.context.event_date,
    correction_id: correction.id,
    correction_status: correction.status,
    correction_created_at: correction.createdAt,
    correction_fixed_at: correction.fixedAt ?? null,
    mode,
  };

  const items =
    mode === "clean"
      ? correction.items
          .filter((i) => i.changeType !== "removed")
          .map((i: CorrectionItem) => ({
            section: i.section,
            name: i.name,
            unit: i.unit,
            qty: i.qty,
            price: i.price,
            amount: i.amount,
          }))
      : correction.items.map((i) => ({
          section: i.section,
          name: i.name,
          unit: i.unit,
          qty: i.qty,
          price: i.price,
          amount: i.amount,
          changeType: i.changeType,
          reason: i.reason ?? null,
          original: i.originalSnapshot
            ? {
                name: i.originalSnapshot.name,
                unit: i.originalSnapshot.unit,
                qty: i.originalSnapshot.qty,
                price: i.originalSnapshot.price,
                amount: i.originalSnapshot.amount,
              }
            : null,
        }));

  const totals =
    mode === "clean"
      ? { total: correction.summary.total }
      : {
          original_total: correction.summary.originalTotal,
          corrected_total: correction.summary.total,
          delta_abs: correction.summary.deltaAbs,
          delta_pct: correction.summary.deltaPct,
          edited: correction.summary.edited,
          added: correction.summary.added,
          removed: correction.summary.removed,
        };

  const body = JSON.stringify({ head, items, totals }, null, 2);

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  });
}
