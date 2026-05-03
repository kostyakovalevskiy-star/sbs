"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ChevronLeft, FileEdit, FileText, ExternalLink } from "lucide-react";
import { formatRub, formatDate } from "@/lib/utils";
import type { CaseRecord, Correction } from "@/types";

const EVENT_LABELS: Record<string, string> = {
  flood: "Залив",
  fire: "Пожар",
  theft: "Кража",
  natural: "Стихийное",
};

export default function CaseDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [caseRecord, setCaseRecord] = useState<CaseRecord | null>(null);
  const [corrections, setCorrections] = useState<Correction[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      fetch(`/api/admin/cases/${id}`).then((r) => (r.ok ? r.json() : null)),
      fetch(`/api/admin/cases/${id}/corrections`).then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([c, corr]) => {
        setCaseRecord(c);
        setCorrections(Array.isArray(corr) ? corr : []);
      })
      .finally(() => setLoading(false));
  }, [id]);

  async function handleCreateCorrection() {
    setCreating(true);
    try {
      const res = await fetch(`/api/admin/cases/${id}/corrections`, { method: "POST" });
      if (!res.ok) throw new Error("create_failed");
      const c = (await res.json()) as Correction;
      router.push(`/admin/cases/${id}/edit?correctionId=${c.id}`);
    } catch (e) {
      console.error(e);
      setCreating(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-[#21A038] border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!caseRecord) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <p className="text-gray-500">Кейс не найден.</p>
        <Link href="/admin/history" className="text-sm text-[#21A038]">← Вернуться к истории</Link>
      </div>
    );
  }

  const ctx = caseRecord.context;
  const draft = corrections.find((c) => c.status === "draft");
  const fixed = corrections.find((c) => c.status === "fixed");
  const activeCorrection = draft ?? fixed;
  const originalTotal = caseRecord.report?.range.base ?? 0;
  const correctedTotal = activeCorrection?.summary.total ?? originalTotal;
  const deltaAbs = activeCorrection?.summary.deltaAbs ?? 0;
  const deltaPct = activeCorrection?.summary.deltaPct ?? 0;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-5">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <Link href="/admin/history" className="text-gray-500 hover:text-gray-800 inline-flex items-center gap-1">
          <ChevronLeft className="w-4 h-4" /> История
        </Link>
        <span className="text-gray-400">/</span>
        <span className="text-gray-800 font-medium">K-{caseRecord.id.slice(0, 8).toUpperCase()}</span>
      </div>

      {/* Header */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="space-y-1">
            <p className="font-mono text-xs text-gray-400 uppercase tracking-wider">
              Кейс K-{caseRecord.id.slice(0, 8).toUpperCase()}
            </p>
            <h1 className="font-display text-2xl font-bold text-gray-900">
              {ctx.name || "Без имени"}
            </h1>
            <p className="text-sm text-gray-500">
              {EVENT_LABELS[ctx.event_type] ?? ctx.event_type}
              {ctx.event_date ? ` · ${ctx.event_date}` : ""} · {ctx.address}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link href={`/result/${caseRecord.id}`} target="_blank">
              <Button variant="outline" className="gap-2 rounded-xl">
                <ExternalLink className="w-4 h-4" /> Оригинал
              </Button>
            </Link>
            {draft ? (
              <Link href={`/admin/cases/${caseRecord.id}/edit?correctionId=${draft.id}`}>
                <Button className="gap-2 rounded-xl">
                  <FileEdit className="w-4 h-4" /> Открыть корректировку
                </Button>
              </Link>
            ) : (
              <Button onClick={handleCreateCorrection} disabled={creating} className="gap-2 rounded-xl">
                <FileEdit className="w-4 h-4" />
                {creating ? "Создаём…" : "Создать корректировку"}
              </Button>
            )}
            {activeCorrection && (
              <Link href={`/admin/cases/${caseRecord.id}/report?correctionId=${activeCorrection.id}`}>
                <Button variant="outline" className="gap-2 rounded-xl">
                  <FileText className="w-4 h-4" /> Скорректированный отчёт
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Cost summary side-panel folded into a 3-tile grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <SummaryTile
          label="Оригинал"
          value={originalTotal ? formatRub(originalTotal) : "—"}
          sub={caseRecord.report ? `${caseRecord.report.works.length} работ · ${caseRecord.report.materials.length} материалов` : undefined}
        />
        <SummaryTile
          label="С учётом корректировки"
          value={activeCorrection ? formatRub(correctedTotal) : "—"}
          sub={
            activeCorrection
              ? `изм. ${activeCorrection.summary.edited} · доб. ${activeCorrection.summary.added} · уд. ${activeCorrection.summary.removed}`
              : undefined
          }
          tone={activeCorrection ? "accent" : "muted"}
        />
        <SummaryTile
          label="Разница"
          value={
            activeCorrection
              ? `${deltaAbs > 0 ? "+" : ""}${formatRub(deltaAbs)}`
              : "—"
          }
          sub={activeCorrection ? `${deltaPct > 0 ? "+" : ""}${deltaPct.toFixed(1)}%` : undefined}
          tone={
            activeCorrection
              ? deltaAbs > 0
                ? "warn"
                : deltaAbs < 0
                  ? "danger"
                  : "muted"
              : "muted"
          }
        />
      </div>

      {/* Original report at a glance */}
      {caseRecord.report && (
        <div className="bg-white rounded-3xl p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-gray-900">Оригинал расчёта</h2>
            <span className="text-xs text-gray-400 font-mono">
              {formatDate(caseRecord.created_at)}
            </span>
          </div>

          <Section title="Работы" rows={caseRecord.report.works.map((w) => ({
            name: w.name, qty: w.volume, unit: w.unit, price: w.unit_price, amount: w.total,
          }))} />

          <Section title="Материалы" rows={caseRecord.report.materials.map((m) => ({
            name: m.name, qty: m.volume, unit: m.unit, price: m.unit_price, amount: m.total,
          }))} />
        </div>
      )}
    </div>
  );
}

function SummaryTile({
  label,
  value,
  sub,
  tone = "default",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "default" | "accent" | "warn" | "danger" | "muted";
}) {
  const valueColor =
    tone === "accent"
      ? "text-[#21A038]"
      : tone === "warn"
        ? "text-amber-600"
        : tone === "danger"
          ? "text-red-600"
          : tone === "muted"
            ? "text-gray-400"
            : "text-gray-900";
  return (
    <div className="bg-white rounded-3xl p-5">
      <p className="text-xs text-gray-400 font-medium">{label}</p>
      <p className={`font-display text-2xl font-bold mt-2 ${valueColor}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

interface Row { name: string; qty: number; unit: string; price: number; amount: number; }

function Section({ title, rows }: { title: string; rows: Row[] }) {
  if (rows.length === 0) return null;
  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-700 mb-2">{title} · {rows.length}</h3>
      <div className="overflow-x-auto rounded-xl border border-gray-100">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-[11px] uppercase tracking-wider text-gray-500">
              <th className="text-left px-3 py-2 font-medium">Наименование</th>
              <th className="text-right px-3 py-2 font-medium">Кол-во</th>
              <th className="text-right px-3 py-2 font-medium">Цена</th>
              <th className="text-right px-3 py-2 font-medium">Сумма</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t border-gray-100">
                <td className="px-3 py-2 text-gray-800">{r.name}</td>
                <td className="px-3 py-2 text-right text-gray-600">{r.qty} {r.unit}</td>
                <td className="px-3 py-2 text-right text-gray-600">{formatRub(r.price)}</td>
                <td className="px-3 py-2 text-right font-medium text-gray-900">{formatRub(r.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
