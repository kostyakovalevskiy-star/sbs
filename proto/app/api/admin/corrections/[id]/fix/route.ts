import { NextRequest, NextResponse } from "next/server";
import { getCorrection, saveCorrection } from "@/lib/corrections";

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const c = await getCorrection(id);
  if (!c) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (c.status !== "draft") {
    return NextResponse.json({ error: "already_fixed" }, { status: 400 });
  }

  c.status = "fixed";
  c.fixedAt = new Date().toISOString();
  await saveCorrection(c);
  return NextResponse.json(c);
}
