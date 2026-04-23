import { NextRequest, NextResponse } from "next/server";
import { getKV, setKV } from "@/lib/kv";
import type { CaseRecord, Report } from "@/types";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const report = body?.report as Report | undefined;

  if (!report || !report.area_pick) {
    return NextResponse.json({ error: "report required" }, { status: 400 });
  }

  const record = await getKV<CaseRecord>(`case:${id}`);
  if (!record) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const updated: CaseRecord = {
    ...record,
    report,
    status: report.routed_to_expert ? "expert" : "complete",
  };
  await setKV(`case:${id}`, updated);

  return NextResponse.json({ ok: true });
}
