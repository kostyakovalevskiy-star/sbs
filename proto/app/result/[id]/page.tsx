"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatRub } from "@/lib/utils";
import type { CaseRecord, Report } from "@/types";
import { Download, FileText, Home, AlertTriangle, Pencil, Check, Save, ChevronDown, ChevronUp, Info } from "lucide-react";

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
  const [confidenceOpen, setConfidenceOpen] = useState(false);
  const confidencePopoverRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!confidenceOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (confidencePopoverRef.current && !confidencePopoverRef.current.contains(e.target as Node)) {
        setConfidenceOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [confidenceOpen]);

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
    <main className="min-h-screen bg-[#f5f6f7]">
      {/* Header — sticky on scroll */}
      <div className="bg-[#21A038] text-white px-4 py-6 sticky top-0 z-20 shadow-md">
        <div className="flex items-start justify-between gap-3 mb-1">
          <p className="text-sm opacity-80">Предварительная оценка ущерба</p>
          <button
            onClick={handleEditParams}
            aria-label="Редактировать параметры"
            className="shrink-0 inline-flex items-center gap-1.5 bg-white/15 hover:bg-white/25 active:bg-white/30 transition-colors rounded-full px-3 py-1.5 text-xs font-medium"
          >
            <Pencil className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Редактировать параметры</span>
            <span className="sm:hidden">Изменить</span>
          </button>
        </div>
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
        {/* Reliability — high when an OCR'd act of competent authority
            confirms the event; standard for AI-only; low when above the
            auto-payment threshold and we're routing to expert. */}
        {report.reliability === "high" && (
          <div className="flex items-start gap-3 bg-emerald-50 border border-emerald-200 rounded-3xl p-4 mb-5">
            <Check className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-emerald-800">Высокая надёжность · автовыплата</p>
              <p className="text-xs text-emerald-700 mt-0.5">
                {report.reliability_reason ??
                  "Подтверждено актом компетентного органа — независимая экспертиза не требуется."}
                {report.claude_output.act_document?.issuing_authority &&
                  ` Орган: ${report.claude_output.act_document.issuing_authority}.`}
              </p>
            </div>
          </div>
        )}
        {report.routed_to_expert && (
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-3xl p-4 mb-5">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-800">Кейс передан эксперту</p>
              <p className="text-xs text-amber-600 mt-0.5">
                {report.reliability_reason ??
                  "Сумма превышает порог автоматического урегулирования. Эксперт рассмотрит ваш случай."}
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
          {/* Left column: AI summary + area + actions */}
          <div className="space-y-5">
        {/* AI Summary */}
        <div className="bg-white rounded-3xl p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-2">AI-заключение</h2>
          <p className="text-sm text-gray-600 leading-relaxed">{report.claude_output.summary}</p>
          {report.area_pick && (
            <p className="mt-2 text-xs text-gray-500 leading-relaxed">
              <span className="font-medium text-gray-700">Площадь повреждений:</span>{" "}
              {report.area_pick.value} м² — источник: {report.area_pick.source || "не указан"}
            </p>
          )}
          <div className="mt-2 flex items-center gap-1 relative">
            <span className="text-xs text-gray-400">Уверенность AI:</span>
            <Badge variant={report.claude_output.average_confidence >= 0.7 ? "success" : "warning"} className="text-xs">
              {Math.round(report.claude_output.average_confidence * 100)}%
            </Badge>
            <div ref={confidencePopoverRef} className="relative">
              <button
                type="button"
                onClick={() => setConfidenceOpen((v) => !v)}
                aria-label="Что такое уверенность AI"
                aria-expanded={confidenceOpen}
                className="inline-flex items-center justify-center w-5 h-5 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-200 transition-colors"
              >
                <Info className="w-3.5 h-3.5" />
              </button>
              {confidenceOpen && (
                <div
                  role="dialog"
                  className="absolute left-0 top-full mt-2 z-30 w-80 max-w-[90vw] rounded-lg border border-gray-200 bg-white p-4 text-xs leading-relaxed text-gray-700 shadow-lg"
                >
                  <p className="font-semibold text-gray-900 mb-2">Что такое «Уверенность AI»?</p>
                  <p className="mb-2">
                    AI анализирует каждое фото повреждений и для каждого выставляет оценку
                    собственной точности от 0% до 100%. Показатель в отчёте — это среднее
                    значение по всем фото.
                  </p>
                  <p className="mb-2">
                    На что влияет:
                  </p>
                  <ul className="list-disc pl-4 space-y-1 mb-2">
                    <li>≥ 70% — оценка считается надёжной (зелёный индикатор).</li>
                    <li>&lt; 70% — оценка требует внимания (жёлтый индикатор).</li>
                    <li>
                      &lt; 60% — к итоговой сумме применяется понижающий коэффициент ×0.85,
                      чтобы компенсировать возможную ошибку AI.
                    </li>
                  </ul>
                  <p className="text-gray-500">
                    Уверенность зависит от качества фото: освещения, резкости, ракурса
                    и наличия масштабной привязки (монета, карта, measure-скриншот).
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Damage area — four estimates with priority */}
        {report.area_pick && report.area_pick.candidates.length > 0 && (
          <div className="rounded-3xl p-5 bg-blue-50">
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
            {/* Per-room / per-surface breakdown — driven by chat-captured rooms */}
            {report.rooms_breakdown && report.rooms_breakdown.length > 0 && (
              <RoomsBreakdownPanel breakdown={report.rooms_breakdown} />
            )}
            {/* Works table */}
            {report.works.length > 0 && (() => {
              const visibleWorks = worksExpanded ? report.works : report.works.slice(0, 3);
              const hiddenCount = report.works.length - visibleWorks.length;
              return (
                <div>
                  <h2 className="text-sm font-semibold text-gray-700 mb-2">Работы</h2>
                  <div className="overflow-x-auto rounded-3xl bg-white">
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
                  <div className="overflow-x-auto rounded-3xl bg-white">
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

const SURFACE_LABEL: Record<string, string> = {
  ceiling: "Потолок",
  wall: "Стены",
  floor: "Пол",
  doorway: "Дверной проём",
  window: "Окно",
};

function RoomsBreakdownPanel({ breakdown }: { breakdown: NonNullable<Report["rooms_breakdown"]> }) {
  // Group rows by room — surfaces become inner sections.
  const byRoom = new Map<string, typeof breakdown>();
  for (const row of breakdown) {
    const list = byRoom.get(row.room) ?? [];
    list.push(row);
    byRoom.set(row.room, list);
  }

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-gray-700">По комнатам и поверхностям</h2>
      <div className="space-y-3">
        {Array.from(byRoom.entries()).map(([room, rows]) => {
          const roomTotal = rows.reduce((s, r) => s + r.subtotal, 0);
          return (
            <details key={room} open className="bg-white rounded-3xl overflow-hidden">
              <summary className="flex items-center justify-between px-4 py-3 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                <span className="text-sm font-semibold text-gray-900">{room}</span>
                <span className="text-sm font-bold text-gray-900">{formatRub(roomTotal)}</span>
              </summary>
              <div className="border-t border-gray-100 divide-y divide-gray-100">
                {rows.map((r, i) => (
                  <div key={`${r.room}-${r.surface}-${i}`} className="px-4 py-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                        {SURFACE_LABEL[r.surface] ?? r.surface} · {r.area_m2} м²
                      </span>
                      <span className="text-xs font-semibold text-gray-700">{formatRub(r.subtotal)}</span>
                    </div>
                    {r.works.length === 0 ? (
                      <p className="text-xs text-gray-400 italic">Работы не выделены — учтены в общем списке.</p>
                    ) : (
                      <table className="w-full text-xs">
                        <tbody>
                          {r.works.map((w, j) => (
                            <tr key={j}>
                              <td className="py-1 text-gray-700">{w.name}</td>
                              <td className="py-1 text-right text-gray-500 whitespace-nowrap">
                                {w.volume} {w.unit}
                              </td>
                              <td className="py-1 text-right text-gray-500 whitespace-nowrap pl-3">
                                {formatRub(w.unit_price)}
                              </td>
                              <td className="py-1 text-right font-medium text-gray-900 whitespace-nowrap pl-3">
                                {formatRub(w.total)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                ))}
              </div>
            </details>
          );
        })}
      </div>
    </div>
  );
}
