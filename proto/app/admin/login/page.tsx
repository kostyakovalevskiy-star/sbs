"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Loader2 } from "lucide-react";

export default function AdminLoginPage() {
  const router = useRouter();
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
      });
      if (res.ok) {
        router.push("/admin");
      } else {
        setError("Не удалось войти");
      }
    } catch {
      setError("Ошибка соединения");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-3">
            <div className="w-12 h-12 bg-[#21A038] rounded-xl flex items-center justify-center">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
          </div>
          <h1 className="text-xl font-bold text-gray-900">Кабинет администратора</h1>
          <p className="text-sm text-gray-500 mt-1">Claim Assistant</p>
        </div>

        <div className="space-y-4 bg-white rounded-2xl p-6 shadow-sm border">
          <p className="text-sm text-gray-600 text-center">
            Демо-режим: вход без пароля
          </p>
          {error && <p className="text-xs text-red-500 text-center">{error}</p>}
          <Button onClick={handleEnter} className="w-full" disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Войти"}
          </Button>
        </div>
      </div>
    </main>
  );
}
