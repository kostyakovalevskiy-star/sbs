"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ChevronLeft, X, Loader2 } from "lucide-react";
import type { DraftState, IncidentContext } from "@/types";

export default function ReviewPage() {
  const router = useRouter();
  const [draft, setDraft] = useState<DraftState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem("claim_draft");
    if (raw) setDraft(JSON.parse(raw));
  }, []);

  function removePhoto(idx: number) {
    if (!draft) return;
    const updated = { ...draft, photos: (draft.photos ?? []).filter((_, i) => i !== idx) };
    setDraft(updated);
    localStorage.setItem("claim_draft", JSON.stringify(updated));
  }

  async function handleSubmit() {
    if (!draft) return;
    setLoading(true);
    setError(null);

    try {
      const context: IncidentContext = {
        id: draft.id,
        name: draft.intro?.name ?? "",
        phone: draft.intro?.phone ?? "",
        region: draft.intro?.region ?? "moscow",
        address: draft.intro?.address ?? "",
        apartment_area_m2: draft.intro?.apartment_area_m2 ?? 0,
        last_renovation_year: draft.intro?.last_renovation_year ?? 2015,
        event_type: "flood",
        floor: draft.flood?.floor,
        source_floor: draft.flood?.source_floor,
        event_date: draft.flood?.event_date,
        affected_area_m2: draft.flood?.affected_area_m2,
        ceiling_height: draft.flood?.ceiling_height,
        finish_level: (draft.intro?.finish_level ?? draft.flood?.finish_level) as "econom" | "standard" | "comfort" | "premium",
        wall_material: draft.flood?.wall_material,
        has_uk_act: draft.flood?.has_uk_act,
      };

      const formData = new FormData();
      formData.append("context", JSON.stringify(context));

      for (const photo of draft.photos ?? []) {
        const blob = await (async () => {
          const res = await fetch(`data:image/jpeg;base64,${photo.base64}`);
          return res.blob();
        })();
        formData.append("photos", blob, "photo.jpg");
      }

      const res = await fetch("/api/analyze", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok || data.error) {
        if (data.error === "ai_parse_failed") {
          setError("AI не смог обработать фотографии. Попробуйте ещё раз.");
        } else {
          setError(data.message ?? "Ошибка анализа. Попробуйте ещё раз.");
        }
        return;
      }

      // Save result to draft
      const updatedDraft = { ...draft, current_step: "result" as const, result: { id: data.id, report: data.report } };
      localStorage.setItem("claim_draft", JSON.stringify(updatedDraft));
      router.push(`/result/${data.id}`);
    } catch (err) {
      setError("Ошибка соединения. Проверьте интернет и попробуйте ещё раз.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  if (!draft) return null;

  const photos = draft.photos ?? [];
  const intro = draft.intro ?? {};
  const flood = draft.flood ?? {};

  const finishLabels: Record<string, string> = {
    econom: "Эконом",
    standard: "Стандарт",
    comfort: "Комфорт",
    premium: "Премиум",
  };

  return (
    <main className="min-h-screen bg-white pt-safe">
      {/* Loading overlay */}
      {loading && (
        <div className="fixed inset-0 bg-white/95 flex flex-col items-center justify-center z-50 gap-4">
          <Loader2 className="w-10 h-10 text-[#21A038] animate-spin" />
          <p className="text-lg font-medium text-gray-800">Анализируем повреждения…</p>
          <p className="text-sm text-gray-500">Обычно занимает 10–20 секунд</p>
        </div>
      )}

      <div className="bg-[#21A038] h-1.5">
        <div className="bg-white/40 h-full" style={{ width: "0%" }} />
      </div>
      <div className="px-4 py-3 border-b flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-600 p-1 -ml-1">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <p className="text-xs text-gray-500">Шаг 4 из 5 — Проверка</p>
        </div>
        <button
          onClick={() => router.push("/thank-you?abandoned=1")}
          className="text-xs text-[#21A038] font-medium whitespace-nowrap"
        >
          Завершить
        </button>
      </div>

      <div className="px-4 py-6 max-w-lg mx-auto space-y-6">
        <h1 className="text-xl font-bold text-gray-900">Проверьте данные</h1>

        {/* Summary */}
        <div className="bg-gray-50 rounded-xl p-4 space-y-2">
          <h2 className="text-sm font-semibold text-gray-700">Данные об инциденте</h2>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <span className="text-gray-500">Регион</span>
            <span className="text-gray-900">{intro.region}</span>
            <span className="text-gray-500">Адрес</span>
            <span className="text-gray-900 break-all">{intro.address}</span>
            <span className="text-gray-500">Площадь повреждений</span>
            <span className="text-gray-900">{flood.affected_area_m2} м²</span>
            <span className="text-gray-500">Отделка</span>
            <span className="text-gray-900">{finishLabels[intro.finish_level ?? ""] ?? intro.finish_level}</span>
            <span className="text-gray-500">Дата события</span>
            <span className="text-gray-900">{flood.event_date}</span>
          </div>
        </div>

        {/* Photos */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">
              Фотографии ({photos.length})
            </h2>
            <button
              onClick={() => router.push("/flow/camera")}
              className="text-xs text-[#21A038] font-medium"
            >
              + Добавить
            </button>
          </div>
          {photos.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4 border border-dashed rounded-lg">
              Нет фотографий. Добавьте хотя бы одну.
            </p>
          )}
          <div className="grid grid-cols-3 gap-2">
            {photos.map((p, i) => (
              <div key={i} className="relative aspect-square">
                <img
                  src={`data:image/jpeg;base64,${p.base64}`}
                  alt={`Фото ${i + 1}`}
                  className="w-full h-full object-cover rounded-lg"
                />
                <button
                  onClick={() => removePhoto(i)}
                  className="absolute -top-1.5 -right-1.5 bg-red-500 rounded-full w-5 h-5 flex items-center justify-center"
                >
                  <X className="w-3 h-3 text-white" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <div className="pt-4 flex gap-3" style={{ paddingBottom: 'max(3rem, env(safe-area-inset-bottom, 3rem))' }}>
          <Button variant="outline" onClick={() => router.back()} className="flex-1">
            Назад
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={photos.length === 0 || loading}
            className="flex-1"
          >
            {loading ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Анализ…</>
            ) : (
              "Отправить на анализ"
            )}
          </Button>
        </div>
      </div>
    </main>
  );
}
