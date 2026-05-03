import { NextRequest, NextResponse } from "next/server";
import { getKV, setKV, listKV } from "@/lib/kv";
import { listCorrectionsForCase } from "@/lib/corrections";
import type { CaseRecord, CorrectionStatus } from "@/types";

export type CaseListItem = Omit<CaseRecord, "photos"> & {
  correction: { id: string; status: CorrectionStatus } | null;
};

export async function GET() {
  const keys = await listKV("case:");
  const cases: CaseListItem[] = [];

  for (const key of keys) {
    const record = await getKV<CaseRecord>(key);
    if (!record) continue;

    const corrections = await listCorrectionsForCase(record.id);
    // Pick the most recent meaningful correction: a draft beats a fixed,
    // fixed beats nothing.
    const draft = corrections.find((c) => c.status === "draft");
    const fixed = corrections.find((c) => c.status === "fixed");
    const correction = draft
      ? { id: draft.id, status: draft.status }
      : fixed
        ? { id: fixed.id, status: fixed.status }
        : null;

    const { photos: _photos, ...recordWithoutPhotos } = record;
    cases.push({ ...(recordWithoutPhotos as CaseRecord), correction });
  }

  cases.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  return NextResponse.json(cases);
}

export async function POST(req: NextRequest) {
  const body = await req.json() as CaseRecord;
  await setKV(`case:${body.id}`, body);
  const existingIndex = (await getKV<string[]>("cases:index")) ?? [];
  if (!existingIndex.includes(body.id)) {
    await setKV("cases:index", [...existingIndex, body.id]);
  }
  return NextResponse.json({ ok: true });
}
