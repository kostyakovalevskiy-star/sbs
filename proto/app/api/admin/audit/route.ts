import { NextRequest, NextResponse } from "next/server";
import { getKV } from "@/lib/kv";
import type { CatalogAuditEntry } from "@/types";

const AUDIT_KEY = "audit:catalogs";

export async function GET(req: NextRequest) {
  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") ?? 50), 500);
  const all = (await getKV<CatalogAuditEntry[]>(AUDIT_KEY)) ?? [];
  const entries = all.slice(-limit).reverse();
  return NextResponse.json({ entries });
}
