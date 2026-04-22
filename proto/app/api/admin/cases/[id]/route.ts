import { NextRequest, NextResponse } from "next/server";
import { getKV } from "@/lib/kv";
import type { CaseRecord } from "@/types";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const record = await getKV<CaseRecord>(`case:${id}`);
  if (!record) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json(record);
}
