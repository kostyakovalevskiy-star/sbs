import { NextRequest, NextResponse } from "next/server";
import { getKV, setKV, listKV } from "@/lib/kv";
import type { CaseRecord } from "@/types";

export async function GET() {
  const keys = await listKV("case:");
  const cases: CaseRecord[] = [];

  for (const key of keys) {
    const record = await getKV<CaseRecord>(key);
    if (record) {
      // Return without photos to save bandwidth
      const { photos: _photos, ...recordWithoutPhotos } = record;
      cases.push(recordWithoutPhotos as CaseRecord);
    }
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
