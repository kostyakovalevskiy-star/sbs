"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft,
  Download,
  FileEdit,
  Printer,
} from "lucide-react";
import { formatRub } from "@/lib/utils";
import type {
  CaseRecord,
  Correction,
  CorrectionItem,
  CorrectionSection,
} from "@/types";

type ViewMode = "full" | "changes" | "compare";
type ExportMode = "clean" | "draft";

const SECTION_LABELS: Record<CorrectionSection, string> = {
  work: "Работы",
  material: "Материалы",
  area: "Площади",
};

const EVENT_LABELS: Record<string, string> = {
  flood: "Залив",
  fire: "Пожар",
  theft: "Кража",
  natural: "Стихийное",
};

export default function ReportPage() {
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const caseId = params.id;
  const correctionId = search.get("correctionId");

  const [caseRecord, setCaseRecord] = useState<CaseRecord | null>(null);
  const [correction, setCorrection] = useState<Correction | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("full");
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [exportMode, setExportMode] = useState<ExportMode>("draft");

  useEffect(() => {
    if (!caseId || !correctionId) return;
    Promise.all([
      fetch(`/api/admin/cases/${caseId}`).then((r) => (r.ok ? r.json() : null)),
      fetch(`/api/admin/corrections/${correctionId}`).then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([c, corr]) => {
        setCaseRecord(c);
        setCorrection(corr);
      })
      .finally(() => setLoading(false));
  }, [caseId, correctionId]);

  const grouped = useMemo(() => {
    const out: Record<CorrectionSection, CorrectionItem[]> = { work: [], material: [], area: [] };
    if (!correction) return out;
    for (const it of correction.items) {
      if (viewMode === "changes" && it.changeType === "unchanged") continue;
      if (exportMode === "clean" && it.changeType === "removed") continue;
      out[it.section].push(it);
    }
    return out;
  }, [correction, viewMode, exportMode]);

  function downloadJSON(mode: ExportMode) {
    if (!correctionId) return;
    const url = `/api/admin/corrections/${correctionId}/export?mode=${mode}&format=json`;
    window.open(url, "_blank");
  }

  function printPDF(mode: ExportMode) {
    setExportMode(mode);
    // The page restyles itself for print via the @media print rules below.
    // window.print() opens the system dialog; user picks "Save as PDF".
    setTimeout(() => window.print(), 50);
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

  const ctx = caseRecord.context;
  const number = caseRecord.id.slice(0, 8).toUpperCase();
  const isFixed = correction.status === "fixed";

  return (
    <div className="report-shell max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-5">
      {/* Toolbar — hidden on print */}
      <div className="report-toolbar flex items-center justify-between gap-3 print:hidden">
        <Link href={`/admin/cases/${caseId}`} className="text-gray-500 hover:text-gray-800 inline-flex items-center gap-1 text-sm">
          <ChevronLeft className="w-4 h-4" /> К кейсу
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          {/* View mode */}
          <div className="flex bg-white rounded-2xl p-1 gap-1">
            {[
              { v: "full" as const, l: "Полный" },
              { v: "changes" as const, l: "Только изменения" },
              { v: "compare" as const, l: "Сравнение" },
            ].map((m) => (
              <button
                key={m.v}
                onClick={() => setViewMode(m.v)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                  viewMode === m.v ? "bg-[#21A038] text-white" : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                {m.l}
              </button>
            ))}
          </div>

          {/* Render-mode toggle (controls what's printed) */}
          <div className="flex bg-white rounded-2xl p-1 gap-1">
            {[
              { v: "draft" as const, l: "Черновик" },
              { v: "clean" as const, l: "Чистовик" },
            ].map((m) => (
              <button
                key={m.v}
                onClick={() => setExportMode(m.v)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                  exportMode === m.v ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                {m.l}
              </button>
            ))}
          </div>

          {!isFixed && (
            <Link href={`/admin/cases/${caseId}/edit?correctionId=${correction.id}`}>
              <Button variant="outline" size="sm" className="gap-1.5 rounded-xl">
                <FileEdit className="w-4 h-4" /> Редактировать
              </Button>
            </Link>
          )}

          <Button size="sm" className="gap-1.5 rounded-xl" onClick={() => printPDF(exportMode)}>
            <Printer className="w-4 h-4" /> PDF
          </Button>

          <div className="relative">
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 rounded-xl"
              onClick={() => setExportMenuOpen((v) => !v)}
            >
              <Download className="w-4 h-4" /> JSON
            </Button>
            {exportMenuOpen && (
              <div className="absolute right-0 mt-1 bg-white border border-gray-100 rounded-xl shadow-lg overflow-hidden z-20 min-w-[160px]">
                <button
                  onClick={() => { downloadJSON("clean"); setExportMenuOpen(false); }}
                  className="block w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                >
                  Чистовик
                </button>
                <button
                  onClick={() => { downloadJSON("draft"); setExportMenuOpen(false); }}
                  className="block w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                >
                  Черновик
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Watermark for draft prints */}
      {exportMode === "draft" && (
        <div aria-hidden className="watermark">ЧЕРНОВИК · сравнение версий</div>
      )}

      {/* Report header */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-mono text-xs text-gray-400 uppercase tracking-wider">
              {exportMode === "draft" ? "Скорректированный отчёт" : "Финальный отчёт"} · K-{number}
            </p>
            <h1 className="font-display text-2xl font-bold text-gray-900 mt-1">
              {ctx.name || "Без имени"}
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {EVENT_LABELS[ctx.event_type] ?? ctx.event_type}
              {ctx.event_date ? ` · ${ctx.event_date}` : ""} · {ctx.address}
            </p>
          </div>
          <div className="text-right text-xs text-gray-500">
            <p>
              <span className="text-gray-400">Создано:</span>{" "}
              {correction.createdAt.slice(0, 10)}
            </p>
            {correction.fixedAt && (
              <p className="mt-0.5">
                <span className="text-gray-400">Зафиксировано:</span>{" "}
                {correction.fixedAt.slice(0, 10)}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Summary tiles */}
      {exportMode === "draft" && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <SummaryTile label="Изменено" value={String(correction.summary.edited)} tone="amber" />
          <SummaryTile label="Добавлено" value={String(correction.summary.added)} tone="emerald" />
          <SummaryTile label="Удалено" value={String(correction.summary.removed)} tone="red" />
          <SummaryTile
            label="Итог"
            value={`${correction.summary.deltaAbs > 0 ? "+" : ""}${formatRub(correction.summary.deltaAbs)}`}
            sub={`${correction.summary.deltaPct > 0 ? "+" : ""}${correction.summary.deltaPct.toFixed(1)}%`}
            tone={correction.summary.deltaAbs > 0 ? "amber" : correction.summary.deltaAbs < 0 ? "red" : "muted"}
          />
        </div>
      )}

      {/* Sections */}
      {(["work", "material", "area"] as CorrectionSection[]).map((s) => {
        const rows = grouped[s];
        if (rows.length === 0) return null;
        return (
          <div key={s} className="bg-white rounded-3xl p-5 sm:p-6 space-y-3">
            <h2 className="font-display text-lg font-bold text-gray-900">
              {SECTION_LABELS[s]} · {rows.length}
            </h2>
            {viewMode === "compare" ? (
              <CompareTable rows={rows} hideRemoved={exportMode === "clean"} />
            ) : (
              <DiffTable rows={rows} mode={exportMode} />
            )}
          </div>
        );
      })}

      {/* Final totals */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 space-y-2">
        <h2 className="font-display text-lg font-bold text-gray-900">Итог</h2>
        {exportMode === "draft" ? (
          <>
            <Row label="Стоимость по оригиналу" value={formatRub(correction.summary.originalTotal)} muted />
            <Row label="Стоимость по корректировке" value={formatRub(correction.summary.total)} bold />
            <Row
              label="Разница"
              value={`${correction.summary.deltaAbs > 0 ? "+" : ""}${formatRub(correction.summary.deltaAbs)} (${correction.summary.deltaPct > 0 ? "+" : ""}${correction.summary.deltaPct.toFixed(1)}%)`}
              bold
              tone={correction.summary.deltaAbs > 0 ? "amber" : correction.summary.deltaAbs < 0 ? "red" : "default"}
            />
          </>
        ) : (
          <Row label="Стоимость по отчёту" value={formatRub(correction.summary.total)} bold />
        )}
      </div>

      {/* Print rules */}
      <style jsx global>{`
        @media print {
          body { background: white !important; }
          .report-toolbar { display: none !important; }
          .watermark {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) rotate(-30deg);
            font-size: 96px;
            color: rgba(185, 56, 26, 0.08);
            font-weight: 700;
            pointer-events: none;
            z-index: 0;
            white-space: nowrap;
          }
          .report-shell > * { box-shadow: none !important; }
        }
        .watermark { display: none; }
        @media print {
          .watermark { display: block; }
        }
      `}</style>
    </div>
  );
}

function SummaryTile({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone: "amber" | "emerald" | "red" | "muted";
}) {
  const valueColor = {
    amber: "text-amber-600",
    emerald: "text-[#21A038]",
    red: "text-red-600",
    muted: "text-gray-700",
  }[tone];
  return (
    <div className="bg-white rounded-3xl p-4">
      <p className="text-xs text-gray-400 font-medium">{label}</p>
      <p className={`font-display text-2xl font-bold mt-1 ${valueColor}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function DiffTable({ rows, mode }: { rows: CorrectionItem[]; mode: ExportMode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-100">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 text-[11px] uppercase tracking-wider text-gray-500">
            <th className="text-left px-3 py-2 font-medium">Наименование</th>
            <th className="text-right px-3 py-2 font-medium">Кол-во</th>
            <th className="text-right px-3 py-2 font-medium">Цена</th>
            <th className="text-right px-3 py-2 font-medium">Сумма</th>
            {mode === "draft" && <th className="text-center px-3 py-2 font-medium">Статус</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <DiffRow key={r.id} item={r} mode={mode} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DiffRow({ item, mode }: { item: CorrectionItem; mode: ExportMode }) {
  const isArea = item.section === "area";
  const orig = item.originalSnapshot;
  const showDiff = mode === "draft" && item.changeType !== "unchanged" && item.changeType !== "added" && orig;

  // Clean mode collapses everything to current values, no markup.
  if (mode === "clean" || item.changeType === "unchanged") {
    return (
      <tr className="border-t border-gray-100">
        <td className="px-3 py-2 text-gray-800">{item.name}</td>
        <td className="px-3 py-2 text-right text-gray-600">{item.qty} {item.unit}</td>
        <td className="px-3 py-2 text-right text-gray-600">{isArea ? "—" : formatRub(item.price)}</td>
        <td className="px-3 py-2 text-right font-medium text-gray-900">{isArea ? "—" : formatRub(item.amount)}</td>
        {mode === "draft" && (
          <td className="px-3 py-2 text-center">
            <StatusPill kind="unchanged" />
          </td>
        )}
      </tr>
    );
  }

  // Draft mode — diff renderings.
  if (item.changeType === "added") {
    return (
      <tr className="border-t border-gray-100 bg-diff-new-bg/40">
        <td className="px-3 py-2 font-medium text-diff-new-ink">+ {item.name}</td>
        <td className="px-3 py-2 text-right text-diff-new-ink">{item.qty} {item.unit}</td>
        <td className="px-3 py-2 text-right text-diff-new-ink">{isArea ? "—" : formatRub(item.price)}</td>
        <td className="px-3 py-2 text-right font-medium text-diff-new-ink">{isArea ? "—" : `+ ${formatRub(item.amount)}`}</td>
        <td className="px-3 py-2 text-center"><StatusPill kind="added" /></td>
      </tr>
    );
  }
  if (item.changeType === "removed") {
    return (
      <tr className="border-t border-gray-100 bg-diff-old-bg/30 line-through text-gray-400">
        <td className="px-3 py-2">{item.name}</td>
        <td className="px-3 py-2 text-right">{(orig?.qty ?? item.qty)} {item.unit}</td>
        <td className="px-3 py-2 text-right">{isArea ? "—" : formatRub(orig?.price ?? item.price)}</td>
        <td className="px-3 py-2 text-right">{isArea ? "—" : formatRub(orig?.amount ?? item.amount)}</td>
        <td className="px-3 py-2 text-center"><StatusPill kind="removed" /></td>
      </tr>
    );
  }
  // edited
  return (
    <tr className="border-t border-gray-100">
      <td className="px-3 py-2 text-gray-800">
        {showDiff && orig && orig.name !== item.name ? (
          <>
            <span className="line-through text-diff-old-ink mr-1">{orig.name}</span>
            <span className="text-diff-new-ink font-medium">{item.name}</span>
          </>
        ) : (
          item.name
        )}
      </td>
      <td className="px-3 py-2 text-right">
        {showDiff && orig && Math.abs(orig.qty - item.qty) > 1e-6 ? (
          <>
            <span className="bg-diff-old-bg text-diff-old-ink line-through px-1 rounded mr-1 text-xs">{orig.qty}</span>
            <span className="bg-diff-new-bg text-diff-new-ink px-1 rounded text-xs font-semibold">{item.qty}</span>
            <span className="text-gray-500 ml-1">{item.unit}</span>
          </>
        ) : (
          <span className="text-gray-600">{item.qty} {item.unit}</span>
        )}
      </td>
      <td className="px-3 py-2 text-right">
        {showDiff && orig && Math.abs(orig.price - item.price) > 1e-6 ? (
          <>
            <span className="bg-diff-old-bg text-diff-old-ink line-through px-1 rounded mr-1 text-xs">{formatRub(orig.price)}</span>
            <span className="bg-diff-new-bg text-diff-new-ink px-1 rounded text-xs font-semibold">{formatRub(item.price)}</span>
          </>
        ) : (
          <span className="text-gray-600">{isArea ? "—" : formatRub(item.price)}</span>
        )}
      </td>
      <td className="px-3 py-2 text-right font-medium">
        {showDiff && orig && orig.amount !== item.amount ? (
          <>
            <span className="bg-diff-old-bg text-diff-old-ink line-through px-1 rounded mr-1 text-xs">{formatRub(orig.amount)}</span>
            <span className="bg-diff-new-bg text-diff-new-ink px-1 rounded text-xs font-semibold">{formatRub(item.amount)}</span>
          </>
        ) : (
          isArea ? "—" : formatRub(item.amount)
        )}
      </td>
      <td className="px-3 py-2 text-center"><StatusPill kind="edited" /></td>
    </tr>
  );
}

function StatusPill({ kind }: { kind: "unchanged" | "edited" | "added" | "removed" }) {
  const map: Record<typeof kind, { label: string; bg: string; ink: string }> = {
    unchanged: { label: "без изменений", bg: "bg-gray-100", ink: "text-gray-500" },
    edited: { label: "изменено", bg: "bg-amber-50", ink: "text-amber-700" },
    added: { label: "добавлено", bg: "bg-diff-new-bg", ink: "text-diff-new-ink" },
    removed: { label: "удалено", bg: "bg-diff-old-bg", ink: "text-diff-old-ink" },
  };
  const t = map[kind];
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${t.bg} ${t.ink}`}>
      {t.label}
    </span>
  );
}

function CompareTable({ rows, hideRemoved }: { rows: CorrectionItem[]; hideRemoved: boolean }) {
  const list = hideRemoved ? rows.filter((r) => r.changeType !== "removed") : rows;
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-100">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 text-[11px] uppercase tracking-wider text-gray-500">
            <th className="text-left px-3 py-2 font-medium">Позиция</th>
            <th className="text-left px-3 py-2 font-medium">Оригинал</th>
            <th className="text-left px-3 py-2 font-medium">Скорректированный</th>
          </tr>
        </thead>
        <tbody>
          {list.map((r) => {
            const orig = r.originalSnapshot;
            const formatLine = (n?: { name: string; qty: number; unit: string; price: number; amount: number }) =>
              n ? `${n.name} · ${n.qty} ${n.unit} · ${formatRub(n.price)} = ${formatRub(n.amount)}` : "—";
            return (
              <tr key={r.id} className="border-t border-gray-100">
                <td className="px-3 py-2 text-gray-700">{r.name}</td>
                <td className={`px-3 py-2 ${orig ? "text-gray-600" : "text-gray-400 italic"}`}>
                  {formatLine(orig ?? undefined)}
                </td>
                <td className={`px-3 py-2 ${r.changeType === "removed" ? "line-through text-gray-400" : "text-gray-800"}`}>
                  {formatLine({ name: r.name, qty: r.qty, unit: r.unit, price: r.price, amount: r.amount })}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Row({
  label,
  value,
  bold,
  muted,
  tone,
}: {
  label: string;
  value: string;
  bold?: boolean;
  muted?: boolean;
  tone?: "default" | "amber" | "red";
}) {
  const valueColor = tone === "amber"
    ? "text-amber-600"
    : tone === "red"
      ? "text-red-600"
      : muted ? "text-gray-500" : "text-gray-900";
  return (
    <div className="flex justify-between py-1">
      <span className="text-sm text-gray-500">{label}</span>
      <span className={`text-sm ${bold ? "font-bold" : "font-medium"} ${valueColor}`}>{value}</span>
    </div>
  );
}
