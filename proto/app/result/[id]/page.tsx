"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatRub } from "@/lib/utils";
import type { CaseRecord } from "@/types";
import { Download, FileText, Home, AlertTriangle } from "lucide-react";

export default function ResultPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [caseRecord, setCaseRecord] = useState<CaseRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      // Try localStorage first (same browser session)
      const raw = localStorage.getItem("claim_draft");
      if (raw) {
        const draft = JSON.parse(raw);
        if (draft.result?.id === id) {
          // Build partial record from draft
          setCaseRecord({
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
          });
          setLoading(false);
          return;
        }
      }

      // Fetch from API
      try {
        const res = await fetch(`/api/admin/cases/${id}`);
        if (res.ok) {
          setCaseRecord(await res.json());
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
      <div className="bg-[#21A038] text-white px-4 py-6">
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

      <div className="px-4 py-5 max-w-2xl mx-auto space-y-6">
        {/* Expert routing */}
        {report.routed_to_expert && (
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-800">Кейс передан эксперту</p>
              <p className="text-xs text-amber-600 mt-0.5">
                Сумма превышает порог автоматического урегулирования. Эксперт рассмотрит ваш случай.
              </p>
            </div>
          </div>
        )}

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

        {/* Damage area comparison */}
        {(() => {
          const declared = caseRecord.context.affected_area_m2 ?? 0;
          const ai = report.claude_output.total_damaged_area_m2 ?? 0;
          if (declared === 0 && ai === 0) return null;
          const ratio = declared > 0 ? ai / declared : 0;
          const hasDiscrepancy = declared > 0 && ai > 0 && (ratio > 1.4 || ratio < 0.6);
          return (
            <div className={`rounded-xl p-4 border ${hasDiscrepancy ? "bg-amber-50 border-amber-200" : "bg-blue-50 border-blue-200"}`}>
              <h2 className="text-sm font-semibold text-gray-700 mb-3">Площадь повреждений</h2>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-gray-500">Заявлено клиентом</p>
                  <p className="text-xl font-bold text-gray-900">{declared} м²</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Оценка AI по фото</p>
                  <p className="text-xl font-bold text-gray-900">{ai} м²</p>
                </div>
              </div>
              {hasDiscrepancy && (
                <p className="text-xs text-amber-700 mt-3">
                  ⚠️ Расхождение более 40%. Кейс будет проверен экспертом.
                </p>
              )}
              {!hasDiscrepancy && declared > 0 && ai > 0 && (
                <p className="text-xs text-gray-500 mt-3">
                  Оценки согласованы. В расчёте использована заявленная площадь.
                </p>
              )}
            </div>
          );
        })()}

        {/* Works table */}
        {report.works.length > 0 && (
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
                  {report.works.map((w, i) => (
                    <tr key={i} className="border-b last:border-b-0">
                      <td className="px-3 py-2 text-gray-700">{w.name}</td>
                      <td className="px-3 py-2 text-right text-gray-500">{w.volume} {w.unit}</td>
                      <td className="px-3 py-2 text-right font-medium">{formatRub(w.total)}</td>
                    </tr>
                  ))}
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
        )}

        {/* Materials table */}
        {report.materials.length > 0 && (
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
                  {report.materials.map((m, i) => (
                    <tr key={i} className="border-b last:border-b-0">
                      <td className="px-3 py-2 text-gray-700">{m.name}</td>
                      <td className="px-3 py-2 text-right text-gray-500">{m.volume} {m.unit}</td>
                      <td className="px-3 py-2 text-right font-medium">{formatRub(m.total)}</td>
                    </tr>
                  ))}
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
        )}

        {/* Actions */}
        <div className="space-y-3 pt-2 pb-8">
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
    </main>
  );
}
