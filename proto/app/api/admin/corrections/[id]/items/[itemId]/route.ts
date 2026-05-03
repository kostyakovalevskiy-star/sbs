import { NextRequest, NextResponse } from "next/server";
import {
  applyItemEdit,
  computeSummary,
  getCorrection,
  saveCorrection,
} from "@/lib/corrections";
import type { CorrectionItem } from "@/types";

interface Params {
  params: Promise<{ id: string; itemId: string }>;
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id, itemId } = await params;
  const c = await getCorrection(id);
  if (!c) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (c.status !== "draft") {
    return NextResponse.json({ error: "not_draft" }, { status: 400 });
  }

  const idx = c.items.findIndex((i) => i.id === itemId);
  if (idx < 0) return NextResponse.json({ error: "item_not_found" }, { status: 404 });

  const patch = (await req.json()) as Partial<CorrectionItem>;
  const item = c.items[idx];

  // Restore-from-original semantics: { restore: true } resets editable fields
  // back to the original snapshot.
  if ((patch as { restore?: boolean }).restore && item.originalSnapshot) {
    const orig = item.originalSnapshot;
    c.items[idx] = {
      ...item,
      name: orig.name,
      unit: orig.unit,
      qty: orig.qty,
      price: orig.price,
      amount: orig.amount,
      reason: undefined,
      changeType: "unchanged",
    };
  } else {
    c.items[idx] = applyItemEdit(item, {
      name: patch.name ?? item.name,
      unit: patch.unit ?? item.unit,
      qty: patch.qty !== undefined ? Number(patch.qty) : item.qty,
      price: patch.price !== undefined ? Number(patch.price) : item.price,
      reason: patch.reason ?? item.reason,
      room: patch.room ?? item.room,
      surface: patch.surface ?? item.surface,
    });
  }

  c.summary = computeSummary(c.items);
  await saveCorrection(c);
  return NextResponse.json(c.items[idx]);
}

// Soft-delete: flips changeType to "removed" so it stays visible in the diff.
// If the item was newly added, it's hard-removed (no original to diff against).
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id, itemId } = await params;
  const c = await getCorrection(id);
  if (!c) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (c.status !== "draft") {
    return NextResponse.json({ error: "not_draft" }, { status: 400 });
  }

  const idx = c.items.findIndex((i) => i.id === itemId);
  if (idx < 0) return NextResponse.json({ error: "item_not_found" }, { status: 404 });

  const item = c.items[idx];
  if (item.changeType === "added") {
    c.items.splice(idx, 1);
  } else {
    c.items[idx] = { ...item, changeType: "removed" };
  }

  c.summary = computeSummary(c.items);
  await saveCorrection(c);
  return NextResponse.json({ ok: true });
}
