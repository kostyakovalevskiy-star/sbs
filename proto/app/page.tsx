"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { generateId } from "@/lib/utils";
import type { DraftState } from "@/types";
import { ShieldCheck, AlertTriangle } from "lucide-react";

export default function HomePage() {
  const router = useRouter();
  const [existingDraft, setExistingDraft] = useState<DraftState | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem("claim_draft");
    if (raw) {
      try {
        const draft = JSON.parse(raw) as DraftState;
        if (draft.id && draft.current_step !== "result") {
          setExistingDraft(draft);
        }
      } catch {
        localStorage.removeItem("claim_draft");
      }
    }
  }, []);

  function startNew() {
    const draft: DraftState = {
      id: generateId(),
      created_at: new Date().toISOString(),
      current_step: "intro",
    };
    localStorage.setItem("claim_draft", JSON.stringify(draft));
    router.push("/flow/intro");
  }

  function continueDraft() {
    if (!existingDraft) return;
    const stepRoutes: Record<string, string> = {
      intro: "/flow/intro",
      flood: "/flow/flood",
      camera: "/flow/camera",
      review: "/flow/review",
      result: `/result/${existingDraft.result?.id}`,
    };
    router.push(stepRoutes[existingDraft.current_step] ?? "/flow/intro");
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-8 bg-white">
      <div className="w-full max-w-sm space-y-6">
        {/* Logo */}
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-[#21A038] rounded-2xl flex items-center justify-center">
              <ShieldCheck className="w-9 h-9 text-white" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Claim Assistant</h1>
          <p className="mt-2 text-gray-500 text-sm leading-relaxed">
            Зафиксируйте страховое событие и получите предварительную оценку ущерба за 15 минут
          </p>
        </div>

        {/* Disclaimer */}
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
          <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-800 leading-relaxed">
            <strong>Прототип</strong> — данные не передаются в страховую компанию. Используется для UX-тестирования.
          </p>
        </div>

        {/* Existing draft */}
        {existingDraft && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
            <p className="text-sm text-blue-800 font-medium">У вас есть незавершённый кейс</p>
            <p className="text-xs text-blue-600">
              Создан: {new Date(existingDraft.created_at).toLocaleDateString("ru-RU")}
            </p>
            <div className="flex gap-2">
              <Button onClick={continueDraft} size="sm" className="flex-1">
                Продолжить
              </Button>
              <Button
                onClick={() => {
                  localStorage.removeItem("claim_draft");
                  setExistingDraft(null);
                }}
                variant="outline"
                size="sm"
                className="flex-1"
              >
                Начать заново
              </Button>
            </div>
          </div>
        )}

        {/* Main CTA */}
        {!existingDraft && (
          <Button onClick={startNew} size="xl" className="w-full text-base">
            Зафиксировать страховое событие
          </Button>
        )}

        {/* How it works */}
        <div className="space-y-2 pt-2">
          <p className="text-xs text-gray-400 text-center uppercase tracking-wide font-medium">Как это работает</p>
          {[
            { n: "1", t: "Ответьте на вопросы об инциденте" },
            { n: "2", t: "Сфотографируйте повреждения" },
            { n: "3", t: "Получите оценку ущерба с PDF-отчётом" },
          ].map((s) => (
            <div key={s.n} className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-full bg-[#e8f5ea] text-[#21A038] text-xs font-bold flex items-center justify-center shrink-0">
                {s.n}
              </div>
              <p className="text-sm text-gray-600">{s.t}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
