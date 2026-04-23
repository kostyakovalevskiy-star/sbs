"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { DraftState } from "@/types";
import { ChevronLeft } from "lucide-react";

const WALL_MATERIALS = [
  { value: "panel", label: "Панельный дом" },
  { value: "brick", label: "Кирпич" },
  { value: "monolith", label: "Монолит" },
  { value: "drywall", label: "Гипсокартон" },
];

export default function FloodPage() {
  const router = useRouter();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    floor: "",
    event_date: "",
    affected_area_m2: "",
    ceiling_height: "2.7",
    ceiling_height_custom: "",
    wall_material: "brick",
    has_uk_act: "no",
  });

  useEffect(() => {
    const raw = localStorage.getItem("claim_draft");
    if (raw) {
      const draft = JSON.parse(raw) as DraftState;
      if (draft.flood) {
        const f = draft.flood;
        setForm((prev) => ({
          ...prev,
          floor: String(f.floor ?? ""),
          event_date: f.event_date ?? "",
          affected_area_m2: String(f.affected_area_m2 ?? ""),
          ceiling_height: String(f.ceiling_height ?? "2.7"),
          wall_material: f.wall_material ?? "brick",
          has_uk_act: f.has_uk_act ? "yes" : "no",
        }));
      }
    }
  }, []);

  function saveDraft(updated: typeof form) {
    const raw = localStorage.getItem("claim_draft");
    const draft: DraftState = raw ? JSON.parse(raw) : { id: "", created_at: "", current_step: "flood" };
    draft.current_step = "flood";
    const h = updated.ceiling_height === "custom"
      ? parseFloat(updated.ceiling_height_custom) || 2.7
      : parseFloat(updated.ceiling_height) || 2.7;

    draft.flood = {
      ...draft.flood,
      floor: parseInt(updated.floor) || undefined,
      event_date: updated.event_date || undefined,
      affected_area_m2: parseFloat(updated.affected_area_m2) || undefined,
      ceiling_height: h,
      wall_material: updated.wall_material as "panel" | "brick" | "monolith" | "drywall",
      has_uk_act: updated.has_uk_act === "yes",
    };
    localStorage.setItem("claim_draft", JSON.stringify(draft));
  }

  function update(field: string, value: string) {
    const updated = { ...form, [field]: value };
    setForm(updated);
    saveDraft(updated);
    if (errors[field]) setErrors((e) => ({ ...e, [field]: "" }));
  }

  function validate() {
    const errs: Record<string, string> = {};
    if (!form.floor) errs.floor = "Укажите этаж";
    if (!form.event_date) errs.event_date = "Укажите дату события";
    if (!form.affected_area_m2 || parseFloat(form.affected_area_m2) <= 0)
      errs.affected_area_m2 = "Укажите площадь повреждений";
    if (form.ceiling_height === "custom" && !parseFloat(form.ceiling_height_custom))
      errs.ceiling_height_custom = "Укажите высоту потолков";
    return errs;
  }

  function handleNext() {
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    router.push("/flow/camera");
  }

  return (
    <main className="min-h-screen bg-white">
      <div className="sticky top-0 z-20 bg-white pt-safe">
        <div className="bg-[#21A038] h-1.5">
          <div className="bg-white/40 h-full" style={{ width: "0%" }} />
        </div>
        <div className="px-4 py-3 border-b flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-600 p-1 -ml-1">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <p className="text-xs text-gray-500">Шаг 2 из 5 — Детали залива</p>
          </div>
          <button
            onClick={() => router.push("/thank-you?abandoned=1")}
            className="text-xs text-[#21A038] font-medium whitespace-nowrap"
          >
            Завершить
          </button>
        </div>
      </div>

      <div className="px-4 py-6 max-w-lg mx-auto space-y-5">
        <h1 className="text-xl font-bold text-gray-900">Уточните детали залива</h1>

        {/* Floor */}
        <div className="space-y-1.5">
          <Label htmlFor="floor">Этаж вашей квартиры *</Label>
          <Input
            id="floor"
            type="number"
            placeholder="5"
            min={1}
            max={100}
            value={form.floor}
            onChange={(e) => update("floor", e.target.value)}
            className={errors.floor ? "border-red-400" : ""}
          />
          {errors.floor && <p className="text-xs text-red-500">{errors.floor}</p>}
        </div>

        {/* Event date */}
        <div className="space-y-1.5">
          <Label htmlFor="event_date">Дата события *</Label>
          <Input
            id="event_date"
            type="date"
            max={new Date().toISOString().split("T")[0]}
            value={form.event_date}
            onChange={(e) => update("event_date", e.target.value)}
            className={errors.event_date ? "border-red-400" : ""}
          />
          {errors.event_date && <p className="text-xs text-red-500">{errors.event_date}</p>}
        </div>

        {/* Affected area */}
        <div className="space-y-1.5">
          <Label htmlFor="affected_area">Суммарная площадь повреждений, м² *</Label>
          <p className="text-xs text-gray-400">Суммарно по всем комнатам</p>
          <Input
            id="affected_area"
            type="number"
            placeholder="12"
            min={0.1}
            value={form.affected_area_m2}
            onChange={(e) => update("affected_area_m2", e.target.value)}
            className={errors.affected_area_m2 ? "border-red-400" : ""}
          />
          {errors.affected_area_m2 && <p className="text-xs text-red-500">{errors.affected_area_m2}</p>}
        </div>

        {/* Ceiling height */}
        <div className="space-y-1.5">
          <Label>Высота потолков *</Label>
          <Select value={form.ceiling_height} onValueChange={(v) => update("ceiling_height", v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="2.5">2.5 м</SelectItem>
              <SelectItem value="2.7">2.7 м</SelectItem>
              <SelectItem value="3.0">3.0 м</SelectItem>
              <SelectItem value="custom">Другая</SelectItem>
            </SelectContent>
          </Select>
          {form.ceiling_height === "custom" && (
            <Input
              type="number"
              placeholder="Введите высоту, например 3.2"
              step={0.1}
              min={2}
              max={6}
              value={form.ceiling_height_custom}
              onChange={(e) => update("ceiling_height_custom", e.target.value)}
              className={errors.ceiling_height_custom ? "border-red-400" : ""}
            />
          )}
          {errors.ceiling_height_custom && <p className="text-xs text-red-500">{errors.ceiling_height_custom}</p>}
        </div>

        {/* Wall material */}
        <div className="space-y-1.5">
          <Label>Материал стен *</Label>
          <Select value={form.wall_material} onValueChange={(v) => update("wall_material", v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WALL_MATERIALS.map((m) => (
                <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* UK Act */}
        <div className="space-y-1.5">
          <Label>Есть ли акт от управляющей компании? *</Label>
          <div className="flex gap-3">
            {[{ v: "yes", l: "Да" }, { v: "no", l: "Нет" }].map((opt) => (
              <button
                key={opt.v}
                onClick={() => update("has_uk_act", opt.v)}
                className={`flex-1 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                  form.has_uk_act === opt.v
                    ? "bg-[#21A038] text-white border-[#21A038]"
                    : "bg-white text-gray-700 border-gray-200 hover:border-gray-400"
                }`}
              >
                {opt.l}
              </button>
            ))}
          </div>
        </div>

        <div className="pt-4 flex gap-3" style={{ paddingBottom: 'max(3rem, env(safe-area-inset-bottom, 3rem))' }}>
          <Button variant="outline" onClick={() => router.back()} className="flex-1">
            Назад
          </Button>
          <Button onClick={handleNext} className="flex-1">
            Далее
          </Button>
        </div>
      </div>
    </main>
  );
}
