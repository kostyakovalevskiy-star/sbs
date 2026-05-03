"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  Lock,
} from "lucide-react";
import { formatRub } from "@/lib/utils";
import type {
  CaseRecord,
  Correction,
  CorrectionItem,
  CorrectionSection,
} from "@/types";

const SECTION_LABELS: Record<CorrectionSection, string> = {
  work: "Работы",
  material: "Материалы",
  area: "Площади",
};

const SECTION_DEFAULT_UNIT: Record<CorrectionSection, string> = {
  work: "м²",
  material: "шт",
  area: "м²",
};

export default function EditorPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const caseId = params.id;
  const correctionId = search.get("correctionId");

  const [caseRecord, setCaseRecord] = useState<CaseRecord | null>(null);
  const [correction, setCorrection] = useState<Correction | null>(null);
  const [items, setItems] = useState<CorrectionItem[]>([]);
  const [section, setSection] = useState<CorrectionSection>("work");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [fixing, setFixing] = useState(false);

  useEffect(() => {
    if (!caseId || !correctionId) return;
    Promise.all([
      fetch(`/api/admin/cases/${caseId}`).then((r) => (r.ok ? r.json() : null)),
      fetch(`/api/admin/corrections/${correctionId}`).then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([c, corr]) => {
        setCaseRecord(c);
        setCorrection(corr);
        setItems(corr?.items ?? []);
      })
      .finally(() => setLoading(false));
  }, [caseId, correctionId]);

  // Group items by section for tabs.
  const grouped = useMemo(() => {
    const out: Record<CorrectionSection, CorrectionItem[]> = { work: [], material: [], area: [] };
    for (const it of items) out[it.section].push(it);
    return out;
  }, [items]);

  // Recompute summary client-side for live tile updates while editing.
  const summary = useMemo(() => {
    let total = 0;
    let originalTotal = 0;
    let edited = 0, added = 0, removed = 0;
    for (const it of items) {
      if (it.section === "area") continue;
      if (it.changeType !== "removed") total += Number(it.qty) * Number(it.price);
      if (it.originalSnapshot) originalTotal += it.originalSnapshot.amount;
      if (it.changeType === "edited") edited++;
      if (it.changeType === "added") added++;
      if (it.changeType === "removed") removed++;
    }
    const deltaAbs = Math.round(total - originalTotal);
    const deltaPct = originalTotal > 0 ? (deltaAbs / originalTotal) * 100 : 0;
    return {
      total: Math.round(total),
      originalTotal: Math.round(originalTotal),
      deltaAbs,
      deltaPct: Math.round(deltaPct * 10) / 10,
      edited, added, removed,
    };
  }, [items]);

  function patchItem(id: string, patch: Partial<CorrectionItem>) {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it;
        const next = { ...it, ...patch };
        const qty = Number(next.qty) || 0;
        const price = Number(next.price) || 0;
        next.amount = Math.round(qty * price);
        // Recompute changeType against original snapshot.
        if (it.changeType !== "added" && it.originalSnapshot) {
          const orig = it.originalSnapshot;
          const isEdited =
            next.name !== orig.name ||
            next.unit !== orig.unit ||
            Math.abs(qty - orig.qty) > 1e-6 ||
            Math.abs(price - orig.price) > 1e-6;
          next.changeType = isEdited ? "edited" : "unchanged";
        }
        return next;
      })
    );
  }

  function toggleRemove(id: string) {
    setItems((prev) =>
      prev.flatMap((it) => {
        if (it.id !== id) return [it];
        if (it.changeType === "added") return []; // hard-remove brand new rows
        if (it.changeType === "removed" && it.originalSnapshot) {
          return [{ ...it, changeType: "unchanged" as const, ...it.originalSnapshot }];
        }
        return [{ ...it, changeType: "removed" as const }];
      })
    );
  }

  function restoreOriginal(id: string) {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== id || !it.originalSnapshot) return it;
        return {
          ...it,
          name: it.originalSnapshot.name,
          unit: it.originalSnapshot.unit,
          qty: it.originalSnapshot.qty,
          price: it.originalSnapshot.price,
          amount: it.originalSnapshot.amount,
          changeType: "unchanged",
          reason: undefined,
        };
      })
    );
  }

  function addRow() {
    setItems((prev) => [
      ...prev,
      {
        id: `tmp-${Math.random().toString(36).slice(2, 10)}`,
        section,
        name: "",
        unit: SECTION_DEFAULT_UNIT[section],
        qty: 0,
        price: 0,
        amount: 0,
        originalItemId: null,
        changeType: "added",
        originalSnapshot: null,
      },
    ]);
  }

  async function handleSave() {
    if (!correction) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/corrections/${correction.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      if (!res.ok) throw new Error("save_failed");
      const updated = (await res.json()) as Correction;
      setCorrection(updated);
      setItems(updated.items);
      setSavedAt(new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }));
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  async function handleFix() {
    if (!correction) return;
    if (!confirm("Зафиксировать корректировку? После этого править её будет нельзя.")) return;
    setFixing(true);
    try {
      // Save first to flush any pending edits.
      await handleSave();
      const res = await fetch(`/api/admin/corrections/${correction.id}/fix`, { method: "POST" });
      if (!res.ok) throw new Error("fix_failed");
      router.push(`/admin/cases/${caseId}/report?correctionId=${correction.id}`);
    } catch (e) {
      console.error(e);
      setFixing(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 flex justify-center">
        <div className="w-8 h-8 border-2 border-[#21A038] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!caseRecord || !correction) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <p className="text-gray-500">Корректировка не найдена.</p>
        <Link href={`/admin/cases/${caseId}`} className="text-sm text-[#21A038]">← Вернуться к кейсу</Link>
      </div>
    );
  }

  const isLocked = correction.status !== "draft";

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-5 pb-32">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <Link href={`/admin/cases/${caseId}`} className="text-gray-500 hover:text-gray-800 inline-flex items-center gap-1">
          <ChevronLeft className="w-4 h-4" /> Кейс K-{caseId.slice(0, 8).toUpperCase()}
        </Link>
        <span className="text-gray-400">/</span>
        <span className="text-gray-800 font-medium">Корректировка</span>
      </div>

      {/* Header card */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-gray-900">
            Редактор корректировки
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {isLocked ? (
              <span className="inline-flex items-center gap-1.5 text-emerald-700">
                <Lock className="w-3.5 h-3.5" /> Зафиксирована {correction.fixedAt?.slice(0, 10)}
              </span>
            ) : savedAt ? (
              `Сохранено в ${savedAt}`
            ) : (
              "Черновик"
            )}
          </p>
        </div>
        {!isLocked && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={handleSave} disabled={saving} className="gap-2 rounded-xl">
              <Save className="w-4 h-4" /> {saving ? "Сохранение…" : "Сохранить черновик"}
            </Button>
            <Button onClick={handleFix} disabled={fixing} className="gap-2 rounded-xl">
              {fixing ? "Фиксируем…" : "Зафиксировать"}
            </Button>
          </div>
        )}
      </div>

      {/* Section tabs */}
      <div className="flex gap-1 bg-white rounded-2xl p-1 w-fit">
        {(Object.keys(SECTION_LABELS) as CorrectionSection[]).map((s) => {
          const active = s === section;
          const count = grouped[s].filter((i) => i.changeType !== "removed").length;
          return (
            <button
              key={s}
              onClick={() => setSection(s)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                active ? "bg-[#21A038] text-white" : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              {SECTION_LABELS[s]} · {count}
            </button>
          );
        })}
      </div>

      {/* Editor table */}
      <div className="bg-white rounded-3xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-[11px] uppercase tracking-wider text-gray-500 border-b border-gray-100">
                <th className="text-left px-3 py-2 font-medium w-10" />
                <th className="text-left px-3 py-2 font-medium">Наименование</th>
                <th className="text-left px-3 py-2 font-medium w-20">Ед.</th>
                <th className="text-right px-3 py-2 font-medium w-24">Кол-во</th>
                <th className="text-right px-3 py-2 font-medium w-28">Цена</th>
                <th className="text-right px-3 py-2 font-medium w-28">Сумма</th>
                <th className="px-3 py-2 w-20" />
              </tr>
            </thead>
            <tbody>
              {grouped[section].length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-gray-400 text-sm">
                    Пусто. Добавьте первую строку.
                  </td>
                </tr>
              ) : (
                grouped[section].map((it) => (
                  <EditorRow
                    key={it.id}
                    item={it}
                    locked={isLocked}
                    onPatch={(patch) => patchItem(it.id, patch)}
                    onRemove={() => toggleRemove(it.id)}
                    onRestore={() => restoreOriginal(it.id)}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
        {!isLocked && (
          <div className="border-t border-gray-100 px-3 py-2">
            <button
              onClick={addRow}
              className="inline-flex items-center gap-1.5 text-sm text-[#21A038] font-medium px-3 py-2 rounded-lg hover:bg-[#e8f5ea]"
            >
              <Plus className="w-4 h-4" /> Добавить строку
            </button>
          </div>
        )}
      </div>

      {/* Sticky footer summary */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 py-3 z-10">
        <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-gray-700 flex flex-wrap gap-x-4 gap-y-1">
            <span>
              Изменено: <strong>{summary.edited}</strong>
            </span>
            <span>
              Добавлено: <strong className="text-[#21A038]">{summary.added}</strong>
            </span>
            <span>
              Удалено: <strong className="text-red-600">{summary.removed}</strong>
            </span>
            <span className="text-gray-300">·</span>
            <span>
              Разница:{" "}
              <strong
                className={
                  summary.deltaAbs > 0
                    ? "text-amber-600"
                    : summary.deltaAbs < 0
                      ? "text-red-600"
                      : "text-gray-700"
                }
              >
                {summary.deltaAbs > 0 ? "+" : ""}
                {formatRub(summary.deltaAbs)} ({summary.deltaPct > 0 ? "+" : ""}
                {summary.deltaPct.toFixed(1)}%)
              </strong>
            </span>
          </div>
          {!isLocked && (
            <Button onClick={handleSave} disabled={saving} size="sm" className="gap-2 rounded-xl">
              <Save className="w-4 h-4" /> {saving ? "Сохранение…" : "Сохранить"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function EditorRow({
  item,
  locked,
  onPatch,
  onRemove,
  onRestore,
}: {
  item: CorrectionItem;
  locked: boolean;
  onPatch: (patch: Partial<CorrectionItem>) => void;
  onRemove: () => void;
  onRestore: () => void;
}) {
  const tone =
    item.changeType === "added"
      ? "border-l-4 border-l-emerald-400"
      : item.changeType === "removed"
        ? "border-l-4 border-l-red-300 bg-red-50/40 line-through text-gray-400"
        : item.changeType === "edited"
          ? "border-l-4 border-l-amber-300"
          : "border-l-4 border-l-transparent";
  return (
    <tr className={`border-b border-gray-100 last:border-b-0 ${tone}`}>
      <td className="px-3 py-2 text-xs text-gray-400 font-mono">
        {item.changeType === "added" && <span className="text-emerald-600">+</span>}
        {item.changeType === "edited" && <span className="text-amber-600">~</span>}
        {item.changeType === "removed" && <span className="text-red-500">×</span>}
      </td>
      <td className="px-3 py-2">
        <input
          value={item.name}
          disabled={locked || item.changeType === "removed"}
          onChange={(e) => onPatch({ name: e.target.value })}
          className="w-full bg-transparent outline-none focus:bg-[#e8f5ea]/40 rounded px-1 py-0.5 disabled:bg-transparent"
          placeholder="Наименование"
        />
      </td>
      <td className="px-3 py-2">
        <input
          value={item.unit}
          disabled={locked || item.changeType === "removed"}
          onChange={(e) => onPatch({ unit: e.target.value })}
          className="w-full bg-transparent outline-none focus:bg-[#e8f5ea]/40 rounded px-1 py-0.5 disabled:bg-transparent"
        />
      </td>
      <td className="px-3 py-2 text-right">
        <input
          type="number"
          step="0.1"
          value={item.qty}
          disabled={locked || item.changeType === "removed"}
          onChange={(e) => onPatch({ qty: Number(e.target.value) })}
          className="w-full text-right bg-transparent outline-none focus:bg-[#e8f5ea]/40 rounded px-1 py-0.5 disabled:bg-transparent"
        />
      </td>
      <td className="px-3 py-2 text-right">
        <input
          type="number"
          step="1"
          value={item.price}
          disabled={locked || item.changeType === "removed" || item.section === "area"}
          onChange={(e) => onPatch({ price: Number(e.target.value) })}
          className="w-full text-right bg-transparent outline-none focus:bg-[#e8f5ea]/40 rounded px-1 py-0.5 disabled:bg-transparent"
        />
      </td>
      <td className="px-3 py-2 text-right font-medium text-gray-900">
        {item.section === "area" ? "—" : formatRub(item.amount)}
      </td>
      <td className="px-3 py-2 text-right">
        {!locked && (
          <div className="inline-flex gap-1">
            {item.changeType === "edited" && item.originalSnapshot && (
              <button
                onClick={onRestore}
                title="Откатить к оригиналу"
                className="text-gray-400 hover:text-gray-700 p-1 rounded hover:bg-gray-100"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={onRemove}
              title={item.changeType === "removed" ? "Восстановить" : "Удалить"}
              className={`p-1 rounded hover:bg-gray-100 ${
                item.changeType === "removed" ? "text-emerald-600" : "text-gray-400 hover:text-red-600"
              }`}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}
