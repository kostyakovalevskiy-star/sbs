"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Loader2, ChevronLeft } from "lucide-react";

export default function AdminLoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleEnter() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
        credentials: "same-origin",
      });
      if (res.ok) {
        // Full navigation (not router.push) ensures the freshly-set cookie
        // rides the next request so middleware sees the session.
        window.location.assign("/admin");
      } else {
        setError("Не удалось войти");
        setLoading(false);
      }
    } catch {
      setError("Ошибка соединения");
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#f5f6f7] px-4 pt-safe relative">
      <Link
        href="/"
        className="absolute left-4 flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        style={{ top: 'max(1rem, env(safe-area-inset-top, 1rem))' }}
      >
        <ChevronLeft className="w-4 h-4" />
        На главную
      </Link>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-3">
            <div className="w-14 h-14 bg-[#21A038] rounded-2xl flex items-center justify-center">
              <ShieldCheck className="w-7 h-7 text-white" />
            </div>
          </div>
          <h1 className="font-display text-2xl font-bold text-gray-900">Кабинет администратора</h1>
          <p className="text-sm text-gray-500 mt-1">Claim Assistant</p>
        </div>

        <div className="space-y-4 bg-white rounded-3xl p-6 sm:p-8">
          <p className="text-sm text-gray-600 text-center">
            Демо-режим: вход без пароля
          </p>
          {error && <p className="text-xs text-red-500 text-center">{error}</p>}
          <Button onClick={handleEnter} className="w-full rounded-2xl" disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Войти"}
          </Button>
        </div>
      </div>
    </main>
  );
}
