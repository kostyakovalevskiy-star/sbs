"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn, generateId } from "@/lib/utils";
import type { DraftState } from "@/types";
import { AlertTriangle, Settings, ArrowRight, FileEdit, Camera, FileText } from "lucide-react";

export default function HomePage() {
  const router = useRouter();
  const [existingDraft, setExistingDraft] = useState<DraftState | null>(null);
  const [collapsed, setCollapsed] = useState(false);

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

  // Collapse the green hero into a compact CTA in the sticky header once the
  // user scrolls past ~half of the hero height.
  useEffect(() => {
    function onScroll() {
      setCollapsed(window.scrollY > 160);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function ctaAction() {
    if (existingDraft) continueDraft();
    else startNew();
  }

  function startNew() {
    const draft: DraftState = {
      id: generateId(),
      created_at: new Date().toISOString(),
      current_step: "chat",
    };
    localStorage.setItem("claim_draft", JSON.stringify(draft));
    router.push("/flow/chat");
  }

  function continueDraft() {
    if (!existingDraft) return;
    const stepRoutes: Record<string, string> = {
      chat: "/flow/chat",
      intro: "/flow/chat",
      flood: "/flow/chat",
      camera: "/flow/camera",
      review: "/flow/review",
      result: `/result/${existingDraft.result?.id}`,
    };
    router.push(stepRoutes[existingDraft.current_step] ?? "/flow/chat");
  }

  return (
    <main className="min-h-screen bg-[#f5f6f7]">
      {/* Top bar — sticky, with collapsing CTA */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-gray-100 pt-safe">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="w-9 h-9 rounded-xl bg-[#21A038] flex items-center justify-center">
              <span className="text-white font-bold text-lg leading-none">S</span>
            </div>
            <span className="font-display font-bold text-gray-900 text-lg hidden sm:inline">
              Claim Assistant
            </span>
          </div>

          {/* Collapsing CTA — appears once user scrolls past the hero. */}
          <button
            onClick={ctaAction}
            aria-hidden={!collapsed}
            tabIndex={collapsed ? 0 : -1}
            className={cn(
              "flex items-center gap-1.5 rounded-2xl bg-[#21A038] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all duration-300 hover:bg-[#1a8030]",
              collapsed
                ? "translate-y-0 opacity-100"
                : "pointer-events-none -translate-y-1 opacity-0"
            )}
          >
            Зафиксировать ущерб
            <ArrowRight className="h-4 w-4" />
          </button>

          <Link
            href="/admin"
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors shrink-0"
          >
            <Settings className="w-4 h-4" />
            <span className="hidden sm:inline">Админка</span>
          </Link>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-6">
        {/* Hero — its content fades out as the user scrolls, handing the CTA
            role over to the sticky header pill above. */}
        <section
          className={cn(
            "bg-[#21A038] rounded-3xl px-6 sm:px-10 py-10 sm:py-14 text-white relative overflow-hidden transition-opacity duration-300",
            collapsed ? "opacity-0" : "opacity-100"
          )}
          aria-hidden={collapsed}
        >
          <div className="absolute -right-20 -bottom-20 w-72 h-72 rounded-full bg-white/10" />
          <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full bg-white/5" />
          <div className="relative max-w-2xl">
            <p className="text-sm sm:text-base opacity-80 mb-3 font-medium">Страхование имущества</p>
            <h1 className="font-display text-3xl sm:text-5xl font-bold leading-tight mb-4">
              Зафиксируйте ущерб за&nbsp;15&nbsp;мин и&nbsp;получите выплату
            </h1>
            <p className="text-base sm:text-lg opacity-90 leading-relaxed mb-7 max-w-xl">
              Сфотографируйте повреждения — AI оценит ущерб и подготовит PDF-отчёт
              для страховой компании.
            </p>
            <Button
              onClick={ctaAction}
              size="xl"
              tabIndex={collapsed ? -1 : 0}
              className="bg-white text-[#21A038] hover:bg-white/90 rounded-2xl shadow-lg font-semibold px-7"
            >
              {existingDraft ? "Продолжить оформление" : "Зафиксировать ущерб"}
              <ArrowRight className="w-5 h-5 ml-1" />
            </Button>
          </div>
        </section>

        {/* How it works — Sber-style service tiles */}
        <section>
          <h2 className="font-display text-xl sm:text-2xl font-bold text-gray-900 mb-4 px-1">
            Как это работает
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            {[
              {
                n: "01",
                icon: FileEdit,
                title: "Анкета",
                desc: "Несколько вопросов о событии и помещении",
              },
              {
                n: "02",
                icon: Camera,
                title: "Фото",
                desc: "Снимки повреждений прямо из камеры",
              },
              {
                n: "03",
                icon: FileText,
                title: "Отчёт",
                desc: "AI-оценка ущерба и готовый PDF",
              },
            ].map(({ n, icon: Icon, title, desc }) => (
              <div
                key={n}
                className="bg-white rounded-3xl p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-8">
                  <div className="w-12 h-12 rounded-2xl bg-[#e8f5ea] flex items-center justify-center">
                    <Icon className="w-6 h-6 text-[#21A038]" />
                  </div>
                  <span className="text-xs font-bold text-gray-300 tracking-wider">{n}</span>
                </div>
                <h3 className="font-display font-bold text-lg text-gray-900 mb-1.5">{title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Prototype disclaimer */}
        <section className="bg-white rounded-3xl p-5 sm:p-6 flex items-start gap-4">
          <div className="w-10 h-10 rounded-2xl bg-amber-50 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <p className="font-semibold text-gray-900 mb-0.5">Это прототип</p>
            <p className="text-sm text-gray-500 leading-relaxed">
              Данные не передаются в страховую компанию. Используется для UX-тестирования и демонстрации.
            </p>
          </div>
        </section>

        <div className="pb-8" />
      </div>
    </main>
  );
}
