"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatRub } from "@/lib/utils";
import type { CaseRecord } from "@/types";
import { Download, FileText, Home, AlertTriangle, Pencil, Check, Save, ChevronDown, ChevronUp } from "lucide-react";

export default function ResultPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [caseRecord, setCaseRecord] = useState<CaseRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recalculating, setRecalculating] = useState(false);
  const [savedPriority, setSavedPriority] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [worksExpanded, setWorksExpanded] = useState(false);
  const [materialsExpanded, setMaterialsExpanded] = useState(false);

  useEffect(() => {
    async function load() {
      // Try localStorage first (same browser session)
      const raw = localStorage.getItem("claim_draft");
      if (raw) {
        const draft = JSON.parse(raw);
        if (draft.result?.id === id) {
          // Build partial record from draft
          const rec: CaseRecord = {
            id: draft.id,
            created_at: draft.created_at ?? new Date().toISOString(),
            context: {
              id: draft.id,
              ...(draft.intro ?? {}),
              ...(draft.flood ?? {}),
              event_type: "flood",
            } as CaseRecord["context"],
            report: draft.result.report,
            photos_count: draft.photos?.length ?? 0,
            status: draft.result.report?.routed_to_expert ? "expert" : "complete",
            photos: draft.photos?.map((p: { base64: string }) => p.base64),
          };
          setCaseRecord(rec);
          const usedPrio = rec.report?.area_pick?.candidates.find((c) => c.used)?.priority ?? null;
          setSavedPriority(usedPrio);
          setLoading(false);
          return;
        }
      }

      // Fetch from API
      try {
        const res = await fetch(`/api/admin/cases/${id}`);
        if (res.ok) {
          const rec: CaseRecord = await res.json();
          setCaseRecord(rec);
          const usedPrio = rec.report?.area_pick?.candidates.find((c) => c.used)?.priority ?? null;
          setSavedPriority(usedPrio);
        } else {
          setError("Кейс не найден");
        }
      } catch {
        setError("Ошибка загрузки");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  async function handleDownloadPDF() {
    if (!caseRecord?.report) return;
    const { generatePDF } = await import("@/lib/pdf");
    await generatePDF(caseRecord.report, caseRecord.context, caseRecord.photos ?? []);
  }

  function handleDownloadJSON() {
    if (!caseRecord) return;
    const { photos: _photos, ...withoutPhotos } = caseRecord;
    const blob = new Blob([JSON.stringify(withoutPhotos, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `claim-${id?.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleNewCase() {
    localStorage.removeItem("claim_draft");
    router.push("/");
  }

  function handleEditParams() {
    // Draft is already in localStorage — user edits it via /flow/flood, then
    // /flow/review will POST /api/analyze again and produce a new /result/{id}.
    router.push("/flow/flood");
  }

  async function handleSelectArea(priority: number) {
    if (!caseRecord?.report || recalculating) return;
    if (report.area_pick?.candidates.find((c) => c.priority === priority)?.used) return;

    setRecalculating(true);
    setJustSaved(false);
    try {
      const res = await fetch("/api/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          claudeOutput: caseRecord.report.claude_output,
          context: caseRecord.context,
          overridePriority: priority,
        }),
      });
      const data = await res.json();
      if (res.ok && data.report) {
        setCaseRecord({ ...caseRecord, report: data.report });
      }
    } catch (err) {
      console.error("recalc failed", err);
    } finally {
      setRecalculating(false);
    }
  }

  async function handleSaveSelection() {
    if (!caseRecord?.report || saving) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/cases/${id}/save-report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ report: caseRecord.report }),
      });

      // Always persist to localStorage draft — even if KV-write fails, the
      // browser view stays consistent with the chosen area.
      try {
        const raw = localStorage.getItem("claim_draft");
        if (raw) {
          const draft = JSON.parse(raw);
          if (draft.result?.id === id) {
            draft.result.report = caseRecord.report;
            localStorage.setItem("claim_draft", JSON.stringify(draft));
          }
        }
      } catch {}

      if (res.ok) {
        const usedPrio = caseRecord.report.area_pick?.candidates.find((c) => c.used)?.priority ?? null;
        setSavedPriority(usedPrio);
        setJustSaved(true);
        setTimeout(() => setJustSaved(false), 2500);
      }
    } catch (err) {
      console.error("save failed", err);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#21A038] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !caseRecord?.report) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 gap-4">
        <p className="text-gray-500">{error ?? "Нет данных"}</p>
        <Button onClick={() => router.push("/")} variant="outline">На главную</Button>
      </div>
    );
  }

  const { report } = caseRecord;
  const sigmaPct = Math.round(report.sigma * 100);

  return (
    <main className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-[#21A038] text-white px-4 py-6 relative">
        <button
          onClick={handleEditParams}
          className="absolute top-4 right-4 inline-flex items-center gap-1.5 bg-white/15 hover:bg-white/25 active:bg-white/30 transition-colors rounded-full px-3 py-1.5 text-xs font-medium"
        >
          <Pencil className="w-3.5 h-3.5" />
          Редактировать параметры
        </button>
        <p className="text-sm opacity-80 mb-1">Предварительная оценка ущерба</p>
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-bold">{formatRub(report.range.base)}</span>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-sm opacity-80">до ±15%</span>
          <span className="text-xs opacity-60">(±{sigmaPct}% по расчёту)</span>
        </div>
        <p className="text-xs opacity-60 mt-2">Кейс {id?.slice(0, 8).toUpperCase()}</p>
      </div>

      <div className="px-4 py-5 max-w-6xl mx-auto">
        {/* Expert routing */}
        {report.routed_to_expert && (
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-800">Кейс передан эксперту</p>
              <p className="text-xs text-amber-600 mt-0.5">
                Сумма превышает порог автоматического урегулирования. Эксперт рассмотрит ваш случай.
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
          {/* Left column: AI summary + area + actions */}
          <div className="space-y-5">
        {/* AI Summary */}
        <div className="bg-gray-50 rounded-xl p-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-2">AI-заключение</h2>
          <p className="text-sm text-gray-600 leading-relaxed">{report.claude_output.summary}</p>
          <div className="mt-2 flex items-center gap-1">
            <span className="text-xs text-gray-400">Уверенность AI:</span>
            <Badge variant={report.claude_output.average_confidence >= 0.7 ? "success" : "warning"} className="text-xs">
              {Math.round(report.claude_output.average_confidence * 100)}%
            </Badge>
          </div>
        </div>

        {/* Damage area — four estimates with priority */}
        {report.area_pick && report.area_pick.candidates.length > 0 && (
          <div className="rounded-xl p-4 border bg-blue-50 border-blue-200">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-700">Площадь повреждений</h2>
              <span className="text-xs text-gray-500">в расчёте: <strong className="text-gray-900">{report.area_pick.value} м²</strong></span>
            </div>
            <div className="space-y-2">
              {report.area_pick.candidates.map((c, i) => {
                const label =
                  c.priority === 1 ? "📐 Measure-скриншот"
                  : c.priority === 2 ? "💳 Масштаб (карта/монета)"
                  : c.priority === 3 ? "📝 Заявлено клиентом"
                  : "👁 AI визуальная оценка";
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleSelectArea(c.priority)}
                    disabled={recalculating || c.used}
                    aria-pressed={c.used}
                    className={`w-full text-left flex items-center justify-between p-2 rounded-lg text-sm transition-all ${
                      c.used
                        ? "bg-white border-2 border-[#21A038] cursor-default"
                        : "bg-gray-50 border border-gray-200 hover:border-[#21A038] hover:bg-white cursor-pointer"
                    } ${recalculating ? "opacity-60 cursor-wait" : ""}`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-700">{label}</p>
                      <p className="text-xs text-gray-500 truncate">{c.source}</p>
                    </div>
                    <div className="text-right shrink-0 ml-2">
                      <p className={`font-bold ${c.used ? "text-[#21A038]" : "text-gray-600"}`}>{c.value} м²</p>
                      {c.used ? (
                        <p className="text-xs text-[#21A038]">в расчёте</p>
                      ) : (
                        <p className="text-xs text-gray-400">выбрать</p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-gray-500 mt-3">
              По умолчанию: Measure &gt; масштабный объект &gt; клиент &gt; AI. Можно выбрать источник вручную — расчёт пересчитается. Диапазон оценок:
              от {Math.min(...report.area_pick.candidates.map((c) => c.value))} до
              {" "}{Math.max(...report.area_pick.candidates.map((c) => c.value))} м².
            </p>
            {(() => {
              const currentUsedPriority =
                report.area_pick?.candidates.find((c) => c.used)?.priority ?? null;
              const isDirty = currentUsedPriority !== null && currentUsedPriority !== savedPriority;
              if (!isDirty && !justSaved) return null;
              return (
                <div className="mt-3 flex items-center justify-between gap-3 pt-3 border-t border-blue-200">
                  {justSaved ? (
                    <p className="text-xs text-[#21A038] font-medium flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" /> Выбор сохранён — используется как финальный расчёт
                    </p>
                  ) : (
                    <p className="text-xs text-amber-700">
                      Выбор отличается от сохранённого. Сохраните, чтобы он попал в отчёт.
                    </p>
                  )}
                  {isDirty && (
                    <Button
                      size="sm"
                      onClick={handleSaveSelection}
                      disabled={saving || recalculating}
                      className="gap-1.5 shrink-0"
                    >
                      <Save className="w-3.5 h-3.5" />
                      {saving ? "Сохранение…" : "Сохранить выбор"}
                    </Button>
                  )}
                </div>
              );
            })()}
          </div>
        )}

            {/* Actions */}
            <div className="space-y-3">
              <Button onClick={handleDownloadPDF} className="w-full gap-2">
                <Download className="w-4 h-4" /> Скачать PDF-отчёт
              </Button>
              <Button onClick={handleDownloadJSON} variant="outline" className="w-full gap-2">
                <FileText className="w-4 h-4" /> Скачать JSON
              </Button>
              <Button onClick={handleNewCase} variant="ghost" className="w-full gap-2">
                <Home className="w-4 h-4" /> Начать новый кейс
              </Button>
            </div>
          </div>

          {/* Right column: works + materials with expand/collapse */}
          <div className="space-y-5 pb-8">
            {/* Works table */}
            {report.works.length > 0 && (() => {
              const visibleWorks = worksExpanded ? report.works : report.works.slice(0, 3);
              const hiddenCount = report.works.length - visibleWorks.length;
              return (
                <div>
                  <h2 className="text-sm font-semibold text-gray-700 mb-2">Работы</h2>
                  <div className="overflow-x-auto rounded-xl border">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-gray-50 border-b">
                          <th className="text-left px-3 py-2 text-gray-500 font-medium">Наименование</th>
                          <th className="text-right px-3 py-2 text-gray-500 font-medium">Объём</th>
                          <th className="text-right px-3 py-2 text-gray-500 font-medium">Итого</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleWorks.map((w, i) => (
                          <tr key={i} className="border-b last:border-b-0">
                            <td className="px-3 py-2 text-gray-700">{w.name}</td>
                            <td className="px-3 py-2 text-right text-gray-500">{w.volume} {w.unit}</td>
                            <td className="px-3 py-2 text-right font-medium">{formatRub(w.total)}</td>
                          </tr>
                        ))}
                        {report.works.length > 3 && (
                          <tr className="border-b last:border-b-0">
                            <td colSpan={3} className="px-3 py-2">
                              <button
                                type="button"
                                onClick={() => setWorksExpanded((v) => !v)}
                                className="inline-flex items-center gap-1 text-xs text-[#21A038] hover:underline font-medium"
                              >
                                {worksExpanded ? (
                                  <>
                                    <ChevronUp className="w-3.5 h-3.5" /> Свернуть
                                  </>
                                ) : (
                                  <>
                                    <ChevronDown className="w-3.5 h-3.5" /> Показать ещё {hiddenCount}
                                  </>
                                )}
                              </button>
                            </td>
                          </tr>
                        )}
                        <tr className="bg-gray-50">
                          <td colSpan={2} className="px-3 py-2 text-right text-xs font-semibold text-gray-600">Итого работы:</td>
                          <td className="px-3 py-2 text-right font-bold text-gray-900">
                            {formatRub(report.works.reduce((s, w) => s + w.total, 0))}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()}

            {/* Materials table */}
            {report.materials.length > 0 && (() => {
              const visibleMaterials = materialsExpanded ? report.materials : report.materials.slice(0, 3);
              const hiddenCount = report.materials.length - visibleMaterials.length;
              return (
                <div>
                  <h2 className="text-sm font-semibold text-gray-700 mb-2">Материалы</h2>
                  <div className="overflow-x-auto rounded-xl border">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-gray-50 border-b">
                          <th className="text-left px-3 py-2 text-gray-500 font-medium">Материал</th>
                          <th className="text-right px-3 py-2 text-gray-500 font-medium">Объём</th>
                          <th className="text-right px-3 py-2 text-gray-500 font-medium">Итого</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleMaterials.map((m, i) => (
                          <tr key={i} className="border-b last:border-b-0">
                            <td className="px-3 py-2 text-gray-700">{m.name}</td>
                            <td className="px-3 py-2 text-right text-gray-500">{m.volume} {m.unit}</td>
                            <td className="px-3 py-2 text-right font-medium">{formatRub(m.total)}</td>
                          </tr>
                        ))}
                        {report.materials.length > 3 && (
                          <tr className="border-b last:border-b-0">
                            <td colSpan={3} className="px-3 py-2">
                              <button
                                type="button"
                                onClick={() => setMaterialsExpanded((v) => !v)}
                                className="inline-flex items-center gap-1 text-xs text-[#21A038] hover:underline font-medium"
                              >
                                {materialsExpanded ? (
                                  <>
                                    <ChevronUp className="w-3.5 h-3.5" /> Свернуть
                                  </>
                                ) : (
                                  <>
                                    <ChevronDown className="w-3.5 h-3.5" /> Показать ещё {hiddenCount}
                                  </>
                                )}
                              </button>
                            </td>
                          </tr>
                        )}
                        <tr className="bg-gray-50">
                          <td colSpan={2} className="px-3 py-2 text-right text-xs font-semibold text-gray-600">Итого материалы:</td>
                          <td className="px-3 py-2 text-right font-bold text-gray-900">
                            {formatRub(report.materials.reduce((s, m) => s + m.total, 0))}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      </div>
    </main>
  );
}
