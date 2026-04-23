"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft } from "lucide-react";
import type { DraftState, EventType } from "@/types";
import regionData from "@/data/region_coefficients.json";
import { formatPhone, normalizePhoneDigits } from "@/lib/utils";

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
    incident_description: "",
  });

  // Address autocomplete
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem("claim_draft");
    if (raw) {
      const draft = JSON.parse(raw) as DraftState;
      if (draft.intro) {
        setForm((prev) => ({
          ...prev,
          name: draft.intro?.name ?? "",
          phone: draft.intro?.phone ? formatPhone(draft.intro.phone) : "",
          region: draft.intro?.region ?? "moscow",
          address: draft.intro?.address ?? "",
          apartment_area_m2: String(draft.intro?.apartment_area_m2 ?? ""),
          last_renovation_year: String(draft.intro?.last_renovation_year ?? prev.last_renovation_year),
          event_type: (draft.intro?.event_type as EventType) ?? "",
          finish_level: draft.intro?.finish_level ?? "standard",
          incident_description: draft.intro?.incident_description ?? "",
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
      phone: normalizePhoneDigits(updated.phone), // store raw digits
      region: updated.region,
      address: updated.address,
      apartment_area_m2: parseFloat(updated.apartment_area_m2) || undefined,
      last_renovation_year: parseInt(updated.last_renovation_year) || undefined,
      event_type: updated.event_type as EventType || undefined,
      finish_level: updated.finish_level as "econom" | "standard" | "comfort" | "premium",
      incident_description: updated.incident_description || undefined,
    };
    localStorage.setItem("claim_draft", JSON.stringify(draft));
  }

  function update(field: string, value: string) {
    let v = value;
    if (field === "phone") v = formatPhone(value);
    const updated = { ...form, [field]: v };
    setForm(updated);
    saveDraft(updated);
    if (errors[field]) setErrors((e) => ({ ...e, [field]: "" }));
  }

  // Fetch DaData suggestions (debounced)
  function handleAddressChange(value: string) {
    update("address", value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/suggest-address?q=${encodeURIComponent(value)}`);
        const data = await res.json();
        const items = ((data.suggestions as { value: string }[] | undefined) ?? []).map((s) => s.value);
        setSuggestions(items);
        setShowSuggestions(items.length > 0);
      } catch {
        setSuggestions([]);
      }
    }, 250);
  }

  function pickSuggestion(s: string) {
    update("address", s);
    setShowSuggestions(false);
  }

  function validate() {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = "Укажите ФИО";
    if (normalizePhoneDigits(form.phone).length !== 10) errs.phone = "Телефон должен содержать 10 цифр";
    if (!form.address.trim()) errs.address = "Укажите адрес";
    if (!form.event_type) errs.event_type = "Выберите тип события";
    if (!form.incident_description.trim()) errs.incident_description = "Опишите, что произошло";
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
      const raw = localStorage.getItem("claim_draft");
      const draft: DraftState = raw ? JSON.parse(raw) : { id: "", created_at: "", current_step: "intro" };
      draft.current_step = "result";
      localStorage.setItem("claim_draft", JSON.stringify(draft));
      router.push("/thank-you");
    }
  }

  return (
    <main className="min-h-screen bg-[#f5f6f7]">
      <div className="sticky top-0 z-20 bg-white pt-safe">
        <div className="bg-[#21A038] h-1.5">
          <div className="bg-white/40 h-full" style={{ width: "28%" }} />
        </div>
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push("/")} className="text-gray-400 hover:text-gray-600 p-1 -ml-1">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <p className="text-xs text-gray-500">Шаг 1 из 5 — Общие сведения</p>
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
        <h1 className="font-display text-2xl font-bold text-gray-900 px-1">Расскажите о себе и событии</h1>
        <div className="bg-white rounded-3xl p-5 sm:p-6 space-y-5">

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

        {/* Phone — auto-formats, +7 prepended automatically */}
        <div className="space-y-1.5">
          <Label htmlFor="phone">Телефон *</Label>
          <Input
            id="phone"
            type="tel"
            inputMode="tel"
            placeholder="+7 (999) 123-45-67"
            value={form.phone}
            onChange={(e) => update("phone", e.target.value)}
            maxLength={18}
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

        {/* Address with DaData autocomplete */}
        <div className="space-y-1.5 relative">
          <Label htmlFor="address">Адрес пострадавшего объекта *</Label>
          <Input
            id="address"
            placeholder="Начните вводить: Москва, ул. Ленина…"
            value={form.address}
            onChange={(e) => handleAddressChange(e.target.value)}
            onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            className={errors.address ? "border-red-400" : ""}
            autoComplete="off"
          />
          {showSuggestions && suggestions.length > 0 && (
            <ul className="absolute top-full left-0 right-0 z-20 mt-1 bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto">
              {suggestions.map((s, i) => (
                <li
                  key={i}
                  onMouseDown={() => pickSuggestion(s)}
                  className="px-3 py-2 text-sm hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                >
                  {s}
                </li>
              ))}
            </ul>
          )}
          {errors.address && <p className="text-xs text-red-500">{errors.address}</p>}
        </div>

        {/* Area */}
        <div className="space-y-1.5">
          <Label htmlFor="area">Площадь квартиры, м²</Label>
          <Input
            id="area"
            type="number"
            inputMode="numeric"
            placeholder="54"
            min={5}
            max={2000}
            value={form.apartment_area_m2}
            onChange={(e) => update("apartment_area_m2", e.target.value)}
            disabled
          />
        </div>

        {/* Renovation year */}
        <div className="space-y-1.5">
          <Label htmlFor="renovation">Год последнего ремонта</Label>
          <Input
            id="renovation"
            type="number"
            inputMode="numeric"
            placeholder="2018"
            min={1950}
            max={new Date().getFullYear()}
            value={form.last_renovation_year}
            onChange={(e) => update("last_renovation_year", e.target.value)}
            disabled
          />
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

        {/* Description — free text context from the client */}
        <div className="space-y-1.5">
          <Label htmlFor="desc">Что произошло? *</Label>
          <textarea
            id="desc"
            placeholder="Опишите событие: когда произошло, что пострадало, откуда вода / что повреждено…"
            value={form.incident_description}
            onChange={(e) => update("incident_description", e.target.value)}
            rows={4}
            className={`flex w-full rounded-md border bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none ${
              errors.incident_description ? "border-red-400" : "border-input"
            }`}
          />
          {errors.incident_description && <p className="text-xs text-red-500">{errors.incident_description}</p>}
        </div>
        </div>

        <div className="pt-2" style={{ paddingBottom: 'max(3rem, env(safe-area-inset-bottom, 3rem))' }}>
          <Button onClick={handleNext} size="lg" className="w-full rounded-2xl">
            Далее
          </Button>
        </div>
      </div>
    </main>
  );
}
