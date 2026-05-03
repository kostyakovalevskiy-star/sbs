"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatRub, formatDate } from "@/lib/utils";
import type { CaseRecord, CorrectionStatus } from "@/types";
import { Download } from "lucide-react";

type CaseRow = CaseRecord & {
  correction: { id: string; status: CorrectionStatus } | null;
};

const EVENT_LABELS: Record<string, string> = {
  flood: "Залив",
  fire: "Пожар",
  theft: "Кража",
  natural: "Стихийное",
};

function CorrectionPill({ correction }: { correction: CaseRow["correction"] }) {
  if (!correction) {
    return (
      <span className="inline-flex items-center rounded-full bg-gray-100 text-gray-600 px-2 py-0.5 text-[11px] font-medium">
        оригинал
      </span>
    );
  }
  if (correction.status === "draft") {
    return (
      <span className="inline-flex items-center rounded-full bg-amber-50 text-amber-700 px-2 py-0.5 text-[11px] font-medium">
        в корректировке
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-emerald-50 text-emerald-700 px-2 py-0.5 text-[11px] font-medium">
      зафиксирован
    </span>
  );
}

export default function HistoryPage() {
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [tooltip, setTooltip] = useState<{ text: string; x: number; y: number } | null>(null);

  function showTooltip(e: React.MouseEvent<HTMLElement>, text: string) {
    if (!text) return;
    const r = e.currentTarget.getBoundingClientRect();
    setTooltip({ text, x: r.left, y: r.bottom + 4 });
  }

  useEffect(() => {
    fetch("/api/admin/cases")
      .then((r) => r.json())
      .then((data) => setCases(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = cases.filter((c) => {
    if (filterType !== "all" && c.context.event_type !== filterType) return false;
    if (filterStatus !== "all" && c.status !== filterStatus) return false;
    return true;
  });

  function exportCSV() {
    const header = "ID,Дата,Тип,Описание,Оценка,Статус\n";
    const rows = filtered.map((c) => {
      const desc = (c.report?.claude_output?.summary ?? "").replace(/[\r\n"]/g, " ").trim();
      return `${c.id.slice(0, 8)},${formatDate(c.created_at)},${EVENT_LABELS[c.context.event_type] ?? c.context.event_type},"${desc}",${c.report?.range.base ?? ""},${c.status}`;
    }).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "cases.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      {/* Summary tooltip — fixed-positioned so it's not clipped by table overflow */}
      {tooltip && (
        <div
          role="tooltip"
          className="fixed z-50 w-80 max-w-[90vw] rounded-lg border border-gray-200 bg-white p-3 text-xs leading-relaxed text-gray-700 shadow-lg pointer-events-none"
          style={{ left: `${tooltip.x}px`, top: `${tooltip.y}px` }}
        >
          <p className="mb-1 text-[10px] uppercase tracking-wide font-semibold text-gray-400">
            AI-заключение
          </p>
          <p className="whitespace-pre-wrap">{tooltip.text}</p>
        </div>
      )}

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-5">
        <div className="flex items-center justify-between px-1">
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-gray-900">История кейсов</h1>
          <Button variant="outline" size="sm" onClick={exportCSV} className="gap-1.5 rounded-xl">
            <Download className="w-4 h-4" /> CSV
          </Button>
        </div>

        {/* Filters */}
        <div className="flex gap-2 flex-wrap">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="text-sm rounded-xl px-4 py-2 bg-white text-gray-700"
          >
            <option value="all">Все типы</option>
            <option value="flood">Залив</option>
            <option value="fire">Пожар</option>
            <option value="theft">Кража</option>
            <option value="natural">Стихийное</option>
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="text-sm rounded-xl px-4 py-2 bg-white text-gray-700"
          >
            <option value="all">Все статусы</option>
            <option value="complete">Завершён</option>
            <option value="expert">На эксперте</option>
          </select>
          <span className="text-sm text-gray-400 self-center px-1">{filtered.length} кейсов</span>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-[#21A038] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-3xl text-gray-400">
            Кейсов не найдено
          </div>
        ) : (
          <div className="bg-white rounded-3xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="text-left px-4 py-3 text-gray-500 font-medium">Дата</th>
                    <th className="text-left px-4 py-3 text-gray-500 font-medium">Тип</th>
                    <th className="text-left px-4 py-3 text-gray-500 font-medium">Описание инцидента</th>
                    <th className="text-right px-4 py-3 text-gray-500 font-medium">Оценка</th>
                    <th className="text-center px-4 py-3 text-gray-500 font-medium">Статус</th>
                    <th className="text-center px-4 py-3 text-gray-500 font-medium">Корректировка</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => {
                    const summary = c.report?.claude_output?.summary ?? "";
                    const short = summary.length > 30 ? summary.slice(0, 30) + "…" : summary;
                    return (
                    <tr key={c.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-600">{formatDate(c.created_at)}</td>
                      <td className="px-4 py-3">{EVENT_LABELS[c.context.event_type] ?? c.context.event_type}</td>
                      <td className="px-4 py-3 text-gray-600 max-w-[240px]">
                        {summary ? (
                          <span
                            className="block truncate cursor-help"
                            onMouseEnter={(e) => showTooltip(e, summary)}
                            onMouseLeave={() => setTooltip(null)}
                          >
                            {short}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-medium">
                        {c.report ? formatRub(c.report.range.base) : "—"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant={c.status === "complete" ? "success" : "warning"}>
                          {c.status === "complete" ? "Завершён" : "Эксперт"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <CorrectionPill correction={c.correction} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/admin/cases/${c.id}`}
                          className="text-xs text-[#21A038] hover:underline font-medium"
                        >
                          Открыть →
                        </Link>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
