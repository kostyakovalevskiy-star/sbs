"use client";

import { useEffect, useState } from "react";
import { formatRub } from "@/lib/utils";
import type { CaseRecord } from "@/types";

export default function AdminDashboard() {
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/cases")
      .then((r) => r.json())
      .then((data) => { setCases(Array.isArray(data) ? data : []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const complete = cases.filter((c) => c.status === "complete");
  const expert = cases.filter((c) => c.status === "expert");
  const avgBase = complete.length
    ? complete.reduce((s, c) => s + (c.report?.range.base ?? 0), 0) / complete.length
    : 0;
  const avgConf = complete.length
    ? complete.reduce((s, c) => s + (c.report?.claude_output.average_confidence ?? 0), 0) / complete.length
    : 0;

  // Damage class histogram
  const damageCount: Record<string, number> = {};
  for (const c of complete) {
    for (const p of c.report?.claude_output.photos ?? []) {
      damageCount[p.damage_class] = (damageCount[p.damage_class] ?? 0) + 1;
    }
  }
  const maxDamageCount = Math.max(...Object.values(damageCount), 1);

  const DAMAGE_LABELS: Record<string, string> = {
    yellow_spot: "Жёлтое пятно",
    wallpaper_peeling: "Отслоение обоев",
    laminate_swelling: "Вспучивание ламината",
    plaster_destruction: "Разрушение штукатурки",
    mold: "Плесень",
    ceramic_tile_damage: "Повреждение плитки",
    no_damage: "Без повреждений",
  };

  return (
      <div className="px-4 py-6 max-w-4xl mx-auto space-y-6">
        <h1 className="text-xl font-bold text-gray-900">Дашборд</h1>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-[#21A038] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Metrics */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[
                { label: "Всего кейсов", value: cases.length, sub: "" },
                { label: "Завершённых", value: complete.length, sub: "AI-расчёт" },
                { label: "На эксперте", value: expert.length, sub: "без расчёта" },
                { label: "Средняя оценка", value: avgBase > 0 ? formatRub(avgBase) : "—", sub: "базовая" },
                { label: "Ср. уверенность AI", value: complete.length ? `${Math.round(avgConf * 100)}%` : "—", sub: "" },
                { label: "Дата", value: new Date().toLocaleDateString("ru-RU"), sub: "" },
              ].map((m, i) => (
                <div key={i} className="bg-white rounded-xl p-4 border">
                  <p className="text-xs text-gray-400">{m.label}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{m.value}</p>
                  {m.sub && <p className="text-xs text-gray-400">{m.sub}</p>}
                </div>
              ))}
            </div>

            {/* Damage histogram */}
            {Object.keys(damageCount).length > 0 && (
              <div className="bg-white rounded-xl p-4 border">
                <h2 className="text-sm font-semibold text-gray-700 mb-4">Типы повреждений</h2>
                <div className="space-y-2">
                  {Object.entries(damageCount)
                    .sort((a, b) => b[1] - a[1])
                    .map(([cls, count]) => (
                      <div key={cls} className="flex items-center gap-3">
                        <span className="text-xs text-gray-500 w-36 shrink-0">{DAMAGE_LABELS[cls] ?? cls}</span>
                        <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#21A038] rounded-full"
                            style={{ width: `${(count / maxDamageCount) * 100}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium text-gray-700 w-6 text-right">{count}</span>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {cases.length === 0 && (
              <div className="text-center py-12 text-gray-400 bg-white rounded-xl border">
                <p>Нет кейсов. Пройдите флоу с телефона чтобы создать первый кейс.</p>
              </div>
            )}
          </>
        )}
      </div>
  );
}
