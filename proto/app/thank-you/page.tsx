"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CheckCircle, FileText } from "lucide-react";
import type { DraftState } from "@/types";
import { generateId } from "@/lib/utils";

const EVENT_LABELS: Record<string, string> = {
  fire: "Пожар",
  theft: "Взлом / кража",
  natural: "Стихийное бедствие",
};

export default function ThankYouPage() {
  const router = useRouter();
  const [draft, setDraft] = useState<DraftState | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem("claim_draft");
    if (raw) {
      const d = JSON.parse(raw) as DraftState;
      setDraft(d);
      // Save case to API
      saveCaseToKV(d);
    }
  }, []);

  async function saveCaseToKV(d: DraftState) {
    try {
      await fetch("/api/admin/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: d.id || generateId(),
          created_at: d.created_at ?? new Date().toISOString(),
          context: { id: d.id, ...(d.intro ?? {}), event_type: d.intro?.event_type },
          report: null,
          photos_count: 0,
          status: "expert",
        }),
      });
    } catch {}
  }

  function handleDownloadJSON() {
    if (!draft) return;
    const blob = new Blob([JSON.stringify(draft.intro, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `claim-expert-${(draft.id ?? "").slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-8 bg-white">
      <div className="w-full max-w-sm space-y-6 text-center">
        <div className="flex justify-center">
          <div className="w-20 h-20 bg-[#e8f5ea] rounded-full flex items-center justify-center">
            <CheckCircle className="w-10 h-10 text-[#21A038]" />
          </div>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Спасибо! Заявка принята</h1>
          <p className="mt-2 text-gray-500 text-sm leading-relaxed">
            Для данного типа события автоматический расчёт пока недоступен. Эксперт рассмотрит ваш кейс в ближайшее время.
          </p>
        </div>

        {draft?.intro && (
          <div className="bg-gray-50 rounded-xl p-4 text-left space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase">Ваши данные сохранены</p>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">ФИО</span>
                <span className="text-gray-900">{draft.intro.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Телефон</span>
                <span className="text-gray-900">{draft.intro.phone}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Тип события</span>
                <span className="text-gray-900">
                  {EVENT_LABELS[String(draft.intro.event_type)] ?? draft.intro.event_type}
                </span>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-3">
          <Button onClick={handleDownloadJSON} variant="outline" className="w-full gap-2">
            <FileText className="w-4 h-4" /> Скачать JSON-пакет
          </Button>
          <Button
            onClick={() => {
              localStorage.removeItem("claim_draft");
              router.push("/");
            }}
            className="w-full"
          >
            Начать новый кейс
          </Button>
        </div>
      </div>
    </main>
  );
}
