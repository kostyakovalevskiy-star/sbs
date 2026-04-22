import { NextRequest, NextResponse } from "next/server";
import { getKV, setKV } from "@/lib/kv";
import type { WorksCatalog, MaterialsCatalog } from "@/types";
import worksCatalogDefault from "@/data/works_catalog.json";
import materialsCatalogDefault from "@/data/materials_catalog.json";

export async function GET() {
  const works = await getKV<WorksCatalog>("works_catalog") ?? worksCatalogDefault;
  const materials = await getKV<MaterialsCatalog>("materials_catalog") ?? materialsCatalogDefault;
  return NextResponse.json({ works, materials });
}

export async function PUT(req: NextRequest) {
  const { type, data } = await req.json() as { type: "works" | "materials"; data: unknown };
  if (type === "works") {
    await setKV("works_catalog", data);
  } else if (type === "materials") {
    await setKV("materials_catalog", data);
  } else {
    return NextResponse.json({ error: "invalid type" }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
