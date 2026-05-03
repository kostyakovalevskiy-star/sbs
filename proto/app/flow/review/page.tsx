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
        rooms: draft.flood?.rooms ?? draft.intro?.rooms,
        ceiling_height: draft.flood?.ceiling_height,
        finish_level: (draft.intro?.finish_level ?? draft.flood?.finish_level) as "econom" | "standard" | "comfort" | "premium",
        wall_material: draft.flood?.wall_material,
        has_uk_act: draft.flood?.has_uk_act,
      };

      const formData = new FormData();
      formData.append("context", JSON.stringify(context));

      // Capture sceneIds parallel to photos so the analyze endpoint can
      // identify the act-document photo for OCR / reliability boost.
      const sceneIds: string[] = [];
      for (const photo of draft.photos ?? []) {
        const blob = await (async () => {
          const res = await fetch(`data:image/jpeg;base64,${photo.base64}`);
          return res.blob();
        })();
        formData.append("photos", blob, "photo.jpg");
        sceneIds.push(photo.sceneId ?? "");
      }
      formData.append("scene_ids", JSON.stringify(sceneIds));

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

  const wallMaterialLabels: Record<string, string> = {
    panel: "Панельный",
    brick: "Кирпич",
    monolith: "Монолит",
    drywall: "Гипсокартон",
  };

  const surfaceLabels: Record<string, string> = {
    ceiling: "потолок",
    wall: "стены",
    floor: "пол",
    doorway: "проём",
    window: "окно",
  };

  function areaSummary(f: typeof flood): string | null {
    if (f.rooms && f.rooms.length > 0) {
      const total = f.rooms.reduce((s, r) => {
        const surfaces = r.affected_surfaces ?? [];
        const fc = r.length_m * r.width_m;
        const wa = 2 * (r.length_m + r.width_m) * r.height_m;
        let a = 0;
        if (surfaces.includes("ceiling")) a += fc;
        if (surfaces.includes("floor")) a += fc;
        if (surfaces.includes("wall")) a += wa;
        return s + a;
      }, 0);
      return `${Math.round(total * 10) / 10} м² (по ${f.rooms.length} комнатам)`;
    }
    return f.affected_area_m2 ? `${f.affected_area_m2} м²` : null;
  }

  function formatPhoneDisplay(digits: string): string {
    const d = digits.replace(/\D/g, "");
    if (d.length === 11 && d.startsWith("7")) {
      return `+7 (${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7, 9)}-${d.slice(9, 11)}`;
    }
    if (d.length === 10) {
      return `+7 (${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6, 8)}-${d.slice(8, 10)}`;
    }
    return digits;
  }

  return (
    <main className="min-h-screen bg-[#f5f6f7]">
      {/* Loading overlay */}
      {loading && (
        <div className="fixed inset-0 bg-white/95 flex flex-col items-center justify-center z-50 gap-4">
          <Loader2 className="w-10 h-10 text-[#21A038] animate-spin" />
          <p className="text-lg font-medium text-gray-800">Анализируем повреждения…</p>
          <p className="text-sm text-gray-500">Обычно занимает 10–20 секунд</p>
        </div>
      )}

      <div className="sticky top-0 z-20 bg-white pt-safe">
        <div className="bg-[#21A038] h-1.5">
          <div className="bg-white/40 h-full" style={{ width: "0%" }} />
        </div>
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-3">
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
      </div>

      <div className="px-4 py-6 max-w-lg mx-auto space-y-6">
        <h1 className="font-display text-2xl font-bold text-gray-900 px-1">Проверьте данные</h1>

        {/* Summary — full chat detail so the user can verify everything before
            submitting. Rooms, movable property, and payout are all surfaced. */}
        <div className="bg-white rounded-3xl p-5 sm:p-6 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-gray-700">Данные об инциденте</h2>
            <button
              onClick={() => router.push("/flow/chat")}
              className="text-xs text-[#21A038] font-medium whitespace-nowrap"
            >
              Внести изменения
            </button>
          </div>
          <ReviewGrid
            rows={[
              ["Имя", intro.name],
              ["Телефон", intro.phone ? formatPhoneDisplay(intro.phone) : null],
              ["Адрес", intro.address],
              ["Регион", intro.region],
              ["Площадь квартиры", intro.apartment_area_m2 ? `${intro.apartment_area_m2} м²` : null],
              ["Отделка", finishLabels[intro.finish_level ?? ""] ?? intro.finish_level ?? null],
              ["Этаж", flood.floor !== undefined ? String(flood.floor) : null],
              ["Дата события", flood.event_date],
              ["Площадь повреждений", areaSummary(flood)],
              ["Материал стен", wallMaterialLabels[flood.wall_material ?? ""] ?? flood.wall_material ?? null],
              ["Акт от УК", flood.has_uk_act === undefined ? null : flood.has_uk_act ? "Да" : "Нет"],
              ["Полис", intro.policy_number_manual ?? null],
            ]}
          />

          {/* Rooms — explicit section, one card per room */}
          {flood.rooms && flood.rooms.length > 0 && (
            <div className="pt-2 border-t border-gray-200 space-y-2">
              <span className="block text-xs font-semibold text-gray-700">
                Пострадавшие комнаты ({flood.rooms.length})
              </span>
              <div className="space-y-1.5">
                {flood.rooms.map((r) => (
                  <div key={r.id} className="text-sm bg-gray-50 rounded-lg px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-gray-900">{r.name}</span>
                      <span className="text-xs text-gray-500 tabular-nums">
                        {r.length_m}×{r.width_m}×{r.height_m} м
                      </span>
                    </div>
                    {r.affected_surfaces && r.affected_surfaces.length > 0 && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        Пострадало: {r.affected_surfaces.map((s) => surfaceLabels[s]).join(", ")}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {intro.movable_property && (
            <div className="pt-2 border-t border-gray-200 space-y-1">
              <span className="block text-xs font-semibold text-gray-700">Пострадавшее имущество</span>
              <p className="text-sm text-gray-900 whitespace-pre-wrap">{intro.movable_property}</p>
            </div>
          )}

          {draft.payout?.method && (
            <div className="pt-2 border-t border-gray-200 space-y-1">
              <span className="block text-xs font-semibold text-gray-700">Способ выплаты</span>
              <p className="text-sm text-gray-900">
                {draft.payout.method === "sbp"
                  ? `СБП${draft.payout.sbp_phone ? ` · +7 ${formatPhoneDisplay(draft.payout.sbp_phone)}` : ""}`
                  : `Карта · •••• ${draft.payout.card_last4 ?? ""}`}
              </p>
            </div>
          )}

          {intro.incident_description && (
            <div className="pt-2 border-t border-gray-200 space-y-1">
              <span className="block text-xs font-semibold text-gray-700">Описание клиента</span>
              <p className="text-sm text-gray-900 whitespace-pre-wrap">{intro.incident_description}</p>
            </div>
          )}
        </div>

        {/* Photos */}
        <div className="bg-white rounded-3xl p-5 sm:p-6 space-y-3">
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

        <div className="pt-2 flex gap-3" style={{ paddingBottom: 'max(3rem, env(safe-area-inset-bottom, 3rem))' }}>
          <Button variant="outline" onClick={() => router.back()} className="flex-1 rounded-2xl">
            Назад
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={photos.length === 0 || loading}
            className="flex-1 rounded-2xl"
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

// Two-column label/value grid; rows with null/empty values are dropped so
// the user only sees what was actually answered.
function ReviewGrid({ rows }: { rows: Array<[string, string | null | undefined]> }) {
  const visible = rows.filter(([, v]) => v !== null && v !== undefined && v !== "");
  if (visible.length === 0) return null;
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
      {visible.map(([k, v]) => (
        <span key={k} className="contents">
          <span className="text-gray-500">{k}</span>
          <span className="text-gray-900 break-words">{v}</span>
        </span>
      ))}
    </div>
  );
}
