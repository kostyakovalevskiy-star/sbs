// Correction lifecycle helpers — KV-backed, immutable original.
//
// Storage layout:
//   correction:{id}                 → Correction
//   correction-by-case:{caseId}     → string[] of correction ids (newest first)

import { v4 as uuidv4 } from "uuid";
import { getKV, setKV, deleteKV } from "@/lib/kv";
import type {
  CaseRecord,
  Correction,
  CorrectionItem,
  CorrectionSummary,
  Surface,
} from "@/types";

const KEY_CORRECTION = (id: string) => `correction:${id}`;
const KEY_INDEX = (caseId: string) => `correction-by-case:${caseId}`;

export async function getCorrection(id: string): Promise<Correction | null> {
  return getKV<Correction>(KEY_CORRECTION(id));
}

export async function listCorrectionsForCase(caseId: string): Promise<Correction[]> {
  const ids = (await getKV<string[]>(KEY_INDEX(caseId))) ?? [];
  const out: Correction[] = [];
  for (const id of ids) {
    const c = await getKV<Correction>(KEY_CORRECTION(id));
    if (c) out.push(c);
  }
  return out;
}

export async function saveCorrection(c: Correction): Promise<void> {
  await setKV(KEY_CORRECTION(c.id), c);
  const ids = (await getKV<string[]>(KEY_INDEX(c.caseId))) ?? [];
  if (!ids.includes(c.id)) {
    await setKV(KEY_INDEX(c.caseId), [c.id, ...ids]);
  }
}

export async function deleteCorrection(c: Correction): Promise<void> {
  await deleteKV(KEY_CORRECTION(c.id));
  const ids = (await getKV<string[]>(KEY_INDEX(c.caseId))) ?? [];
  await setKV(KEY_INDEX(c.caseId), ids.filter((x) => x !== c.id));
}

// Build a fresh draft correction by snapshotting the case's original report.
// Areas are pulled from the incident context (apartment + affected) so
// administrators can edit them as a separate "Площади" section.
export function buildDraftFromCase(caseRecord: CaseRecord): Correction {
  const items: CorrectionItem[] = [];

  for (const w of caseRecord.report?.works ?? []) {
    const id = uuidv4();
    items.push({
      id,
      section: "work",
      name: w.name,
      unit: w.unit,
      qty: w.volume,
      price: w.unit_price,
      amount: w.total,
      originalItemId: id, // 1:1 with original — same stable id
      changeType: "unchanged",
      originalSnapshot: {
        name: w.name,
        unit: w.unit,
        qty: w.volume,
        price: w.unit_price,
        amount: w.total,
      },
    });
  }

  for (const m of caseRecord.report?.materials ?? []) {
    const id = uuidv4();
    items.push({
      id,
      section: "material",
      name: m.name,
      unit: m.unit,
      qty: m.volume,
      price: m.unit_price,
      amount: m.total,
      originalItemId: id,
      changeType: "unchanged",
      originalSnapshot: {
        name: m.name,
        unit: m.unit,
        qty: m.volume,
        price: m.unit_price,
        amount: m.total,
      },
    });
  }

  // Areas — synthesised rows; price/amount left at 0 (areas aren't billable).
  const ctx = caseRecord.context;
  const areaRows: Array<{ name: string; qty: number; surface?: Surface }> = [];
  if (ctx.apartment_area_m2 > 0) {
    areaRows.push({ name: "Квартира — общая площадь", qty: ctx.apartment_area_m2 });
  }
  if (ctx.affected_area_m2 && ctx.affected_area_m2 > 0) {
    areaRows.push({ name: "Зона повреждений", qty: ctx.affected_area_m2, surface: "wall" });
  }
  for (const a of areaRows) {
    const id = uuidv4();
    items.push({
      id,
      section: "area",
      name: a.name,
      unit: "м²",
      qty: a.qty,
      price: 0,
      amount: 0,
      originalItemId: id,
      changeType: "unchanged",
      surface: a.surface,
      originalSnapshot: { name: a.name, unit: "м²", qty: a.qty, price: 0, amount: 0 },
    });
  }

  return {
    id: uuidv4(),
    caseId: caseRecord.id,
    status: "draft",
    createdAt: new Date().toISOString(),
    items,
    summary: computeSummary(items),
  };
}

// Recompute correction summary (total, deltas, counts) from items.
export function computeSummary(items: CorrectionItem[]): CorrectionSummary {
  let total = 0;
  let originalTotal = 0;
  let edited = 0;
  let added = 0;
  let removed = 0;

  for (const it of items) {
    if (it.section === "area") continue; // areas aren't billable
    if (it.changeType !== "removed") total += it.amount;
    if (it.originalSnapshot) originalTotal += it.originalSnapshot.amount;
    if (it.changeType === "edited") edited += 1;
    if (it.changeType === "added") added += 1;
    if (it.changeType === "removed") removed += 1;
  }

  const deltaAbs = total - originalTotal;
  const deltaPct = originalTotal > 0 ? (deltaAbs / originalTotal) * 100 : 0;

  return {
    total: Math.round(total),
    originalTotal: Math.round(originalTotal),
    deltaAbs: Math.round(deltaAbs),
    deltaPct: Math.round(deltaPct * 10) / 10,
    edited,
    added,
    removed,
  };
}

// Apply an edit patch to an item; recompute amount + changeType.
export function applyItemEdit(
  item: CorrectionItem,
  patch: Partial<Pick<CorrectionItem, "name" | "unit" | "qty" | "price" | "reason" | "room" | "surface">>
): CorrectionItem {
  const next: CorrectionItem = { ...item, ...patch };
  next.amount = Math.round(next.qty * next.price);

  const orig = item.originalSnapshot;
  if (item.changeType === "added") return next; // added rows stay "added"
  if (!orig) return next;

  const isEdited =
    next.name !== orig.name ||
    next.unit !== orig.unit ||
    Math.abs(next.qty - orig.qty) > 1e-6 ||
    Math.abs(next.price - orig.price) > 1e-6;

  next.changeType = isEdited ? "edited" : "unchanged";
  return next;
}
