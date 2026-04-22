"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { DraftState, EventType } from "@/types";
import regionData from "@/data/region_coefficients.json";

const REGIONS = Object.entries(regionData.regions).map(([key, val]) => ({
  key,
  name: val.name,
}));

const EVENT_TYPES: { value: EventType; label: string }[] = [
  { value: "flood", label: "Залив квартиры" },
  { value: "fire", label: "Пожар" },
  { value: "theft", label: "Взлом / кража" },
  { value: "natural", label: "Стихийное бедствие" },
];

const FINISH_LEVELS = [
  { value: "econom", label: "Эконом (базовая отделка)" },
  { value: "standard", label: "Стандарт (ламинат, обои, покраска)" },
  { value: "comfort", label: "Комфорт (паркет, декоративная штукатурка)" },
  { value: "premium", label: "Премиум (дизайнерский ремонт)" },
];

export default function IntroPage() {
  const router = useRouter();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    name: "",
    phone: "",
    region: "moscow",
    address: "",
    apartment_area_m2: "",
    last_renovation_year: String(new Date().getFullYear() - 5),
    event_type: "" as EventType | "",
    finish_level: "standard",
  });

  useEffect(() => {
    const raw = localStorage.getItem("claim_draft");
    if (raw) {
      const draft = JSON.parse(raw) as DraftState;
      if (draft.intro) {
        setForm((prev) => ({
          ...prev,
          name: draft.intro?.name ?? "",
          phone: draft.intro?.phone ?? "",
          region: draft.intro?.region ?? "moscow",
          address: draft.intro?.address ?? "",
          apartment_area_m2: String(draft.intro?.apartment_area_m2 ?? ""),
          last_renovation_year: String(draft.intro?.last_renovation_year ?? prev.last_renovation_year),
          event_type: (draft.intro?.event_type as EventType) ?? "",
          finish_level: draft.intro?.finish_level ?? "standard",
        }));
      }
    }
  }, []);

  function saveDraft(updated: typeof form) {
    const raw = localStorage.getItem("claim_draft");
    const draft: DraftState = raw ? JSON.parse(raw) : { id: "", created_at: "", current_step: "intro" };
    draft.current_step = "intro";
    draft.intro = {
      ...draft.intro,
      name: updated.name,
      phone: updated.phone,
      region: updated.region,
      address: updated.address,
      apartment_area_m2: parseFloat(updated.apartment_area_m2) || undefined,
      last_renovation_year: parseInt(updated.last_renovation_year) || undefined,
      event_type: updated.event_type as EventType || undefined,
      finish_level: updated.finish_level as "econom" | "standard" | "comfort" | "premium",
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
    if (!form.name.trim()) errs.name = "Укажите ФИО";
    if (!form.phone.trim()) errs.phone = "Укажите телефон";
    if (!form.address.trim()) errs.address = "Укажите адрес";
    if (!form.apartment_area_m2 || parseFloat(form.apartment_area_m2) <= 0)
      errs.apartment_area_m2 = "Укажите площадь";
    if (!form.last_renovation_year || parseInt(form.last_renovation_year) < 1950)
      errs.last_renovation_year = "Укажите год ремонта";
    if (!form.event_type) errs.event_type = "Выберите тип события";
    return errs;
  }

  function handleNext() {
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    if (form.event_type === "flood") {
      router.push("/flow/flood");
    } else {
      // Save non-flood case and go to thank-you
      const raw = localStorage.getItem("claim_draft");
      const draft: DraftState = raw ? JSON.parse(raw) : { id: "", created_at: "", current_step: "intro" };
      draft.current_step = "result";
      localStorage.setItem("claim_draft", JSON.stringify(draft));
      router.push("/thank-you");
    }
  }

  return (
    <main className="min-h-screen bg-white">
      {/* Progress bar */}
      <div className="bg-[#21A038] h-1.5">
        <div className="bg-white/40 h-full" style={{ width: "28%" }} />
      </div>
      <div className="px-4 py-3 border-b">
        <p className="text-xs text-gray-500">Шаг 1 из 5 — Общие сведения</p>
      </div>

      <div className="px-4 py-6 max-w-lg mx-auto space-y-5">
        <h1 className="text-xl font-bold text-gray-900">Расскажите о себе и событии</h1>

        {/* Name */}
        <div className="space-y-1.5">
          <Label htmlFor="name">ФИО *</Label>
          <Input
            id="name"
            placeholder="Иванов Иван Иванович"
            value={form.name}
            onChange={(e) => update("name", e.target.value)}
            className={errors.name ? "border-red-400" : ""}
          />
          {errors.name && <p className="text-xs text-red-500">{errors.name}</p>}
        </div>

        {/* Phone */}
        <div className="space-y-1.5">
          <Label htmlFor="phone">Телефон *</Label>
          <Input
            id="phone"
            type="tel"
            placeholder="+7 (999) 123-45-67"
            value={form.phone}
            onChange={(e) => update("phone", e.target.value)}
            className={errors.phone ? "border-red-400" : ""}
          />
          {errors.phone && <p className="text-xs text-red-500">{errors.phone}</p>}
        </div>

        {/* Region */}
        <div className="space-y-1.5">
          <Label>Регион *</Label>
          <Select value={form.region} onValueChange={(v) => update("region", v)}>
            <SelectTrigger>
              <SelectValue placeholder="Выберите регион" />
            </SelectTrigger>
            <SelectContent>
              {REGIONS.map((r) => (
                <SelectItem key={r.key} value={r.key}>{r.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Address */}
        <div className="space-y-1.5">
          <Label htmlFor="address">Адрес пострадавшего объекта *</Label>
          <Input
            id="address"
            placeholder="ул. Ленина, д. 1, кв. 23"
            value={form.address}
            onChange={(e) => update("address", e.target.value)}
            className={errors.address ? "border-red-400" : ""}
          />
          {errors.address && <p className="text-xs text-red-500">{errors.address}</p>}
        </div>

        {/* Area */}
        <div className="space-y-1.5">
          <Label htmlFor="area">Площадь квартиры, м² *</Label>
          <Input
            id="area"
            type="number"
            placeholder="54"
            min={5}
            max={2000}
            value={form.apartment_area_m2}
            onChange={(e) => update("apartment_area_m2", e.target.value)}
            className={errors.apartment_area_m2 ? "border-red-400" : ""}
          />
          {errors.apartment_area_m2 && <p className="text-xs text-red-500">{errors.apartment_area_m2}</p>}
        </div>

        {/* Renovation year */}
        <div className="space-y-1.5">
          <Label htmlFor="renovation">Год последнего ремонта *</Label>
          <Input
            id="renovation"
            type="number"
            placeholder="2018"
            min={1950}
            max={new Date().getFullYear()}
            value={form.last_renovation_year}
            onChange={(e) => update("last_renovation_year", e.target.value)}
            className={errors.last_renovation_year ? "border-red-400" : ""}
          />
          {errors.last_renovation_year && <p className="text-xs text-red-500">{errors.last_renovation_year}</p>}
        </div>

        {/* Finish level */}
        <div className="space-y-1.5">
          <Label>Уровень отделки *</Label>
          <Select value={form.finish_level} onValueChange={(v) => update("finish_level", v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FINISH_LEVELS.map((f) => (
                <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Event type */}
        <div className="space-y-1.5">
          <Label>Тип страхового события *</Label>
          <Select value={form.event_type} onValueChange={(v) => update("event_type", v)}>
            <SelectTrigger className={errors.event_type ? "border-red-400" : ""}>
              <SelectValue placeholder="Выберите тип события" />
            </SelectTrigger>
            <SelectContent>
              {EVENT_TYPES.map((e) => (
                <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.event_type && <p className="text-xs text-red-500">{errors.event_type}</p>}
          {form.event_type && form.event_type !== "flood" && (
            <p className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-md">
              Для этого типа события доступен упрощённый флоу — данные передаются эксперту.
            </p>
          )}
        </div>

        <div className="pt-4 pb-8">
          <Button onClick={handleNext} size="lg" className="w-full">
            Далее
          </Button>
        </div>
      </div>
    </main>
  );
}
