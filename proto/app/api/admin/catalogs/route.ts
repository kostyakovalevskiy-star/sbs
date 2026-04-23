import { NextRequest, NextResponse } from "next/server";
import { getKV, setKV } from "@/lib/kv";
import type {
  WorksCatalog,
  MaterialsCatalog,
  WorkCatalogEntry,
  MaterialCatalogEntry,
  CatalogAuditEntry,
  CatalogAuditChange,
} from "@/types";
import worksCatalogDefault from "@/data/works_catalog.json";
import materialsCatalogDefault from "@/data/materials_catalog.json";

const MIN_PRICE_RUB = 1;
const MAX_PRICE_RUB = 1_000_000;
const AUDIT_KEY = "audit:catalogs";
const AUDIT_CAP = 500;

interface PriceRow { code: string; base_price_rub: number }

function validateRows(rows: PriceRow[]): { ok: true } | { ok: false; invalid: Array<{ code: string; value: unknown; reason: string }> } {
  const invalid: Array<{ code: string; value: unknown; reason: string }> = [];
  for (const r of rows) {
    const v = r.base_price_rub;
    if (typeof v !== "number" || !Number.isFinite(v)) {
      invalid.push({ code: r.code, value: v, reason: "не число" });
      continue;
    }
    if (v < MIN_PRICE_RUB) {
      invalid.push({ code: r.code, value: v, reason: `минимум ${MIN_PRICE_RUB} ₽` });
      continue;
    }
    if (v > MAX_PRICE_RUB) {
      invalid.push({ code: r.code, value: v, reason: `максимум ${MAX_PRICE_RUB} ₽` });
      continue;
    }
  }
  return invalid.length ? { ok: false, invalid } : { ok: true };
}

function diffPrices<T extends PriceRow>(oldRows: T[], newRows: T[]): {
  changes: CatalogAuditChange[];
  added: string[];
  removed: string[];
} {
  const oldMap = new Map(oldRows.map((r) => [r.code, r.base_price_rub]));
  const newMap = new Map(newRows.map((r) => [r.code, r.base_price_rub]));
  const changes: CatalogAuditChange[] = [];
  const added: string[] = [];
  const removed: string[] = [];
  for (const [code, newPrice] of newMap) {
    if (!oldMap.has(code)) {
      added.push(code);
      continue;
    }
    const oldPrice = oldMap.get(code)!;
    if (oldPrice !== newPrice) {
      changes.push({ code, field: "base_price_rub", old: oldPrice, new: newPrice });
    }
  }
  for (const code of oldMap.keys()) {
    if (!newMap.has(code)) removed.push(code);
  }
  return { changes, added, removed };
}

async function appendAudit(entry: CatalogAuditEntry): Promise<void> {
  const existing = (await getKV<CatalogAuditEntry[]>(AUDIT_KEY)) ?? [];
  existing.push(entry);
  const trimmed = existing.length > AUDIT_CAP ? existing.slice(existing.length - AUDIT_CAP) : existing;
  await setKV(AUDIT_KEY, trimmed);
}

function actorFromRequest(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  const ip = fwd ? fwd.split(",")[0].trim() : req.headers.get("x-real-ip") ?? "unknown";
  const session = req.cookies.get("admin_session")?.value ?? "anon";
  return `${ip} · session=${session}`;
}

export async function GET() {
  const works = await getKV<WorksCatalog>("works_catalog") ?? worksCatalogDefault;
  const materials = await getKV<MaterialsCatalog>("materials_catalog") ?? materialsCatalogDefault;
  return NextResponse.json({ works, materials });
}

export async function PUT(req: NextRequest) {
  const { type, data } = await req.json() as { type: "works" | "materials"; data: unknown };

  if (type !== "works" && type !== "materials") {
    return NextResponse.json({ error: "invalid type" }, { status: 400 });
  }

  const rows: PriceRow[] = type === "works"
    ? ((data as WorksCatalog)?.works ?? []).map((w) => ({ code: w.code, base_price_rub: w.base_price_rub }))
    : ((data as MaterialsCatalog)?.materials ?? []).map((m) => ({ code: m.code, base_price_rub: m.base_price_rub }));

  if (rows.length === 0) {
    return NextResponse.json({ error: "empty catalog" }, { status: 400 });
  }

  const validation = validateRows(rows);
  if (!validation.ok) {
    return NextResponse.json({ error: "validation_failed", invalid: validation.invalid }, { status: 400 });
  }

  const prev = type === "works"
    ? (await getKV<WorksCatalog>("works_catalog") ?? (worksCatalogDefault as WorksCatalog))
    : (await getKV<MaterialsCatalog>("materials_catalog") ?? (materialsCatalogDefault as unknown as MaterialsCatalog));
  const prevRows: PriceRow[] = type === "works"
    ? (prev as WorksCatalog).works.map((w: WorkCatalogEntry) => ({ code: w.code, base_price_rub: w.base_price_rub }))
    : (prev as MaterialsCatalog).materials.map((m: MaterialCatalogEntry) => ({ code: m.code, base_price_rub: m.base_price_rub }));

  const { changes, added, removed } = diffPrices(prevRows, rows);

  if (type === "works") {
    await setKV("works_catalog", data);
  } else {
    await setKV("materials_catalog", data);
  }

  if (changes.length || added.length || removed.length) {
    await appendAudit({
      ts: Date.now(),
      type,
      actor: actorFromRequest(req),
      userAgent: req.headers.get("user-agent") ?? undefined,
      changes,
      added,
      removed,
    });
  }

  return NextResponse.json({ ok: true, diff: { changed: changes.length, added: added.length, removed: removed.length } });
}
