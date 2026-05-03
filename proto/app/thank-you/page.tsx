"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CheckCircle, FileText, XCircle, ArrowLeft, Phone } from "lucide-react";
import type { DraftState } from "@/types";
import { generateId } from "@/lib/utils";

const EVENT_LABELS: Record<string, string> = {
  fire: "Пожар",
  theft: "Взлом / кража",
  natural: "Стихийное бедствие",
};

function ThankYouContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const abandoned = searchParams.get("abandoned") === "1";
  const routedToExpert = searchParams.get("routed") === "expert";

  const [draft, setDraft] = useState<DraftState | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem("claim_draft");
    if (raw) {
      const d = JSON.parse(raw) as DraftState;
      setDraft(d);
      // Only persist the case when submission is completed (non-flood flow).
      // Abandoned drafts stay in localStorage so user can return to them.
      if (!abandoned) saveCaseToKV(d);
    }
  }, [abandoned]);

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

  function handleReturnToDraft() {
    if (!draft) {
      router.push("/");
      return;
    }
    const stepRoutes: Record<string, string> = {
      chat: "/flow/chat",
      intro: "/flow/chat",
      flood: "/flow/chat",
      camera: "/flow/camera",
      review: "/flow/review",
      result: `/result/${draft.result?.id ?? ""}`,
    };
    router.push(stepRoutes[draft.current_step] ?? "/flow/chat");
  }

  // Abandoned flow — user hit "Завершить" before finishing
  if (abandoned) {
    return (
      <main
        className="min-h-screen flex flex-col items-center justify-center px-4 py-8 bg-[#f5f6f7] pt-safe"
        style={{ paddingBottom: 'max(2rem, env(safe-area-inset-bottom, 2rem))' }}
      >
        <div className="w-full max-w-sm bg-white rounded-3xl p-6 sm:p-8 space-y-6 text-center">
          <div className="flex justify-center">
            <div className="w-20 h-20 bg-amber-50 rounded-2xl flex items-center justify-center">
              <XCircle className="w-10 h-10 text-amber-500" />
            </div>
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-gray-900">Заявка не завершена</h1>
            <p className="mt-3 text-gray-600 text-sm leading-relaxed">
              Сожалеем, что вам не удалось оформить заявление об убытке. Вы всегда сможете вернуться к заявке или связаться с нами по номеру <strong>900</strong>.
            </p>
          </div>

          <div className="space-y-3 pt-1">
            <Button onClick={handleReturnToDraft} className="w-full gap-2 rounded-2xl">
              <ArrowLeft className="w-4 h-4" /> Вернуться к заявке
            </Button>
            <Button asChild variant="outline" className="w-full gap-2 rounded-2xl">
              <a href="tel:900">
                <Phone className="w-4 h-4" /> Позвонить 900
              </a>
            </Button>
            <Button
              onClick={() => {
                localStorage.removeItem("claim_draft");
                router.push("/");
              }}
              variant="ghost"
              className="w-full text-gray-500 rounded-2xl"
            >
              На главную
            </Button>
          </div>
        </div>
      </main>
    );
  }

  // Normal completion (non-flood submission → expert review)
  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center px-4 py-8 bg-[#f5f6f7] pt-safe"
      style={{ paddingBottom: 'max(2rem, env(safe-area-inset-bottom, 2rem))' }}
    >
      <div className="w-full max-w-sm bg-white rounded-3xl p-6 sm:p-8 space-y-6 text-center">
        <div className="flex justify-center">
          <div className="w-20 h-20 bg-[#e8f5ea] rounded-2xl flex items-center justify-center">
            <CheckCircle className="w-10 h-10 text-[#21A038]" />
          </div>
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold text-gray-900">
            {routedToExpert ? "Заявка передана эксперту" : "Спасибо! Заявка принята"}
          </h1>
          <p className="mt-2 text-gray-500 text-sm leading-relaxed">
            {routedToExpert
              ? "Ваше обращение переведено на эксперта. Мы свяжемся с вами в течение 8 рабочих часов."
              : "Для данного типа события автоматический расчёт пока недоступен. Эксперт рассмотрит ваш кейс в ближайшее время."}
          </p>
        </div>

        {draft?.intro && (
          <div className="bg-[#f5f6f7] rounded-2xl p-4 text-left space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Ваши данные сохранены</p>
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
          <Button onClick={handleDownloadJSON} variant="outline" className="w-full gap-2 rounded-2xl">
            <FileText className="w-4 h-4" /> Скачать JSON-пакет
          </Button>
          <Button
            onClick={() => {
              localStorage.removeItem("claim_draft");
              router.push("/");
            }}
            className="w-full rounded-2xl"
          >
            Начать новый кейс
          </Button>
        </div>
      </div>
    </main>
  );
}

export default function ThankYouPage() {
  return (
    <Suspense fallback={null}>
      <ThankYouContent />
    </Suspense>
  );
}
