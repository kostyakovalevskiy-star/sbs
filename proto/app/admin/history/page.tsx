"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatRub, formatDate } from "@/lib/utils";
import type { CaseRecord } from "@/types";
import { BarChart3, Settings, Book, History, Download, ExternalLink } from "lucide-react";

const EVENT_LABELS: Record<string, string> = {
  flood: "Залив",
  fire: "Пожар",
  theft: "Кража",
  natural: "Стихийное",
};

export default function HistoryPage() {
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [selectedCase, setSelectedCase] = useState<CaseRecord | null>(null);
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

  async function openCase(id: string) {
    const res = await fetch(`/api/admin/cases/${id}`);
    if (res.ok) setSelectedCase(await res.json());
  }

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

  const navItems = [
    { href: "/admin", label: "Дашборд", icon: BarChart3 },
    { href: "/admin/calibration", label: "Калибровка", icon: Settings },
    { href: "/admin/catalogs", label: "Справочники", icon: Book },
    { href: "/admin/history", label: "История", icon: History, active: true },
  ];

  return (
    <main className="min-h-screen bg-gray-50">
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
      <header className="bg-white border-b px-4 py-4">
        <span className="font-semibold text-gray-900">Claim Assistant Admin</span>
      </header>
      <nav className="flex gap-1 px-4 py-2 bg-white border-b overflow-x-auto">
        {navItems.map(({ href, label, icon: Icon, active }) => (
          <Link key={href} href={href} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap ${active ? "bg-[#e8f5ea] text-[#21A038]" : "text-gray-500 hover:text-gray-700"}`}>
            <Icon className="w-4 h-4" />{label}
          </Link>
        ))}
      </nav>

      {/* Case detail modal */}
      {selectedCase && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-5 py-4 flex items-center justify-between">
              <h2 className="font-semibold">Кейс {selectedCase.id.slice(0, 8).toUpperCase()}</h2>
              <button onClick={() => setSelectedCase(null)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <span className="text-gray-500">ФИО</span><span>{selectedCase.context.name}</span>
                <span className="text-gray-500">Телефон</span><span>{selectedCase.context.phone}</span>
                <span className="text-gray-500">Регион</span><span>{selectedCase.context.region}</span>
                <span className="text-gray-500">Дата события</span><span>{selectedCase.context.event_date ?? "—"}</span>
              </div>
              {selectedCase.report && (
                <>
                  <div className="bg-green-50 rounded-xl p-3">
                    <p className="text-xs text-gray-500">Базовая оценка</p>
                    <p className="text-2xl font-bold text-[#21A038]">{formatRub(selectedCase.report.range.base)}</p>
                    <p className="text-xs text-gray-500 mt-1">{selectedCase.report.claude_output.summary}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-gray-600">Работы ({selectedCase.report.works.length})</p>
                    {selectedCase.report.works.map((w, i) => (
                      <div key={i} className="flex justify-between text-xs">
                        <span className="text-gray-600">{w.name}</span>
                        <span className="font-medium">{formatRub(w.total)}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
              {selectedCase.photos && selectedCase.photos.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-600 mb-2">Фото ({selectedCase.photos.length})</p>
                  <div className="grid grid-cols-3 gap-1">
                    {selectedCase.photos.slice(0, 6).map((p, i) => (
                      <img key={i} src={`data:image/jpeg;base64,${p}`} alt="" className="aspect-square object-cover rounded-lg" />
                    ))}
                  </div>
                </div>
              )}
              <Link href={`/result/${selectedCase.id}`} target="_blank">
                <Button variant="outline" className="w-full gap-2">
                  <ExternalLink className="w-4 h-4" /> Открыть отчёт
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}

      <div className="px-4 py-6 max-w-4xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">История кейсов</h1>
          <Button variant="outline" size="sm" onClick={exportCSV} className="gap-1.5">
            <Download className="w-4 h-4" /> CSV
          </Button>
        </div>

        {/* Filters */}
        <div className="flex gap-2 flex-wrap">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="text-sm border rounded-lg px-3 py-1.5 bg-white text-gray-700"
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
            className="text-sm border rounded-lg px-3 py-1.5 bg-white text-gray-700"
          >
            <option value="all">Все статусы</option>
            <option value="complete">Завершён</option>
            <option value="expert">На эксперте</option>
          </select>
          <span className="text-sm text-gray-400 self-center">{filtered.length} кейсов</span>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-[#21A038] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border text-gray-400">
            Кейсов не найдено
          </div>
        ) : (
          <div className="bg-white rounded-xl border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="text-left px-4 py-3 text-gray-500 font-medium">Дата</th>
                    <th className="text-left px-4 py-3 text-gray-500 font-medium">Тип</th>
                    <th className="text-left px-4 py-3 text-gray-500 font-medium">Описание инцидента</th>
                    <th className="text-right px-4 py-3 text-gray-500 font-medium">Оценка</th>
                    <th className="text-center px-4 py-3 text-gray-500 font-medium">Статус</th>
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
                      <td className="px-4 py-3">
                        <button
                          onClick={() => openCase(c.id)}
                          className="text-xs text-[#21A038] hover:underline font-medium"
                        >
                          Открыть
                        </button>
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
    </main>
  );
}
