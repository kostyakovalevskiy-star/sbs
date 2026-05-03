import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import {
  applyItemEdit,
  computeSummary,
  getCorrection,
  saveCorrection,
} from "@/lib/corrections";
import type { CorrectionItem } from "@/types";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const c = await getCorrection(id);
  if (!c) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(c);
}

// Add a brand-new line. Body: Partial<CorrectionItem> with at least
// `section`, `name`, `unit`, `qty`, `price`.
export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const c = await getCorrection(id);
  if (!c) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (c.status !== "draft") {
    return NextResponse.json({ error: "not_draft" }, { status: 400 });
  }

  const body = (await req.json()) as Partial<CorrectionItem> & {
    section: CorrectionItem["section"];
    name: string;
    unit: string;
    qty: number;
    price: number;
  };
  const qty = Number(body.qty) || 0;
  const price = Number(body.price) || 0;

  const newItem: CorrectionItem = {
    id: uuidv4(),
    section: body.section,
    name: body.name,
    unit: body.unit,
    qty,
    price,
    amount: Math.round(qty * price),
    originalItemId: null,
    changeType: "added",
    reason: body.reason,
    room: body.room,
    surface: body.surface,
    originalSnapshot: null,
  };

  c.items.push(newItem);
  c.summary = computeSummary(c.items);
  await saveCorrection(c);
  return NextResponse.json(newItem);
}

// PUT — bulk replace items (used by editor on save). Body: { items: CorrectionItem[] }
export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const c = await getCorrection(id);
  if (!c) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (c.status !== "draft") {
    return NextResponse.json({ error: "not_draft" }, { status: 400 });
  }

  const { items } = (await req.json()) as { items: CorrectionItem[] };

  // Recompute changeType + amount per item against its frozen original
  // snapshot — clients can't be trusted to set changeType correctly.
  const next = items.map((it) => {
    if (it.changeType === "removed") {
      return { ...it, amount: Math.round(it.qty * it.price) };
    }
    if (!it.originalSnapshot) {
      return {
        ...it,
        changeType: "added" as const,
        amount: Math.round(it.qty * it.price),
      };
    }
    return applyItemEdit(it, {
      name: it.name,
      unit: it.unit,
      qty: Number(it.qty) || 0,
      price: Number(it.price) || 0,
      reason: it.reason,
      room: it.room,
      surface: it.surface,
    });
  });

  c.items = next;
  c.summary = computeSummary(c.items);
  await saveCorrection(c);
  return NextResponse.json(c);
}
