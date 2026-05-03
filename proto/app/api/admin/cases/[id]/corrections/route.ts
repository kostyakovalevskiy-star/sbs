import { NextRequest, NextResponse } from "next/server";
import { getKV } from "@/lib/kv";
import {
  buildDraftFromCase,
  listCorrectionsForCase,
  saveCorrection,
} from "@/lib/corrections";
import type { CaseRecord } from "@/types";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const corrections = await listCorrectionsForCase(id);
  return NextResponse.json(corrections);
}

export async function POST(_req: NextRequest, { params }: Params) {
  const { id } = await params;

  // Reuse an existing draft if one already exists — admins should never
  // accidentally fork their own work.
  const existing = await listCorrectionsForCase(id);
  const draft = existing.find((c) => c.status === "draft");
  if (draft) return NextResponse.json(draft);

  const caseRecord = await getKV<CaseRecord>(`case:${id}`);
  if (!caseRecord) {
    return NextResponse.json({ error: "case_not_found" }, { status: 404 });
  }
  if (!caseRecord.report) {
    return NextResponse.json({ error: "case_has_no_report" }, { status: 400 });
  }

  const correction = buildDraftFromCase(caseRecord);
  await saveCorrection(correction);
  return NextResponse.json(correction);
}
