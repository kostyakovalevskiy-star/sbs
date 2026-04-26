"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownFromLine,
  ArrowUp,
  Bell,
  Box,
  Boxes,
  Building,
  ChefHat,
  Check,
  Clock,
  Cloud,
  Crown,
  CircleHelp,
  DoorOpen,
  Droplets,
  FileCheck,
  Flame,
  Home,
  Layers,
  LayoutGrid,
  Leaf,
  MoreHorizontal,
  RectangleHorizontal,
  ShieldAlert,
  Sofa,
  Sparkles,
  TreePine,
  Users,
  Waves,
  Wind,
  Wrench,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, formatDate, formatPhone, formatRub, normalizePhoneDigits } from "@/lib/utils";
import { regionFromIso } from "@/lib/chat/regionMap";
import { randomFio, randomPhoneDigits } from "@/lib/chat/mockUserData";
import { randomPolicy } from "@/lib/chat/mockPolicy";
import type { ChoiceOption, Step } from "@/lib/chat/types";

export interface SubmitPayload {
  fieldUpdates: Record<string, unknown>;
  displayText: string;
}

export interface ControlProps {
  step: Step;
  onSubmit: (payload: SubmitPayload) => void;
  onRevert?: (toStepId: string) => void;
}

// Map ChoiceOption.iconName → lucide icon. Add new entries here when the
// script introduces a new icon name.
const ICON_MAP: Record<string, LucideIcon> = {
  // event types
  droplets: Droplets,
  flame: Flame,
  shield: ShieldAlert,
  wind: Wind,
  cloud: Cloud,
  tree: TreePine,
  zap: Zap,
  waves: Waves,
  // finish levels
  leaf: Leaf,
  home: Home,
  sparkles: Sparkles,
  crown: Crown,
  // wall materials
  grid: LayoutGrid,
  boxes: Boxes,
  box: Box,
  layers: Layers,
  // sources / answers
  "arrow-down": ArrowDownFromLine,
  wrench: Wrench,
  help: CircleHelp,
  more: MoreHorizontal,
  chef: ChefHat,
  users: Users,
  "file-check": FileCheck,
  bell: Bell,
  clock: Clock,
  door: DoorOpen,
  rectangle: RectangleHorizontal,
  building: Building,
  sofa: Sofa,
  check: Check,
  x: X,
};

// Per-tone classes — selected vs idle. Tones default to sber-green.
const TONE_CLASSES: Record<
  string,
  { selected: string; idle: string }
> = {
  green: {
    selected: "bg-sber-green text-white",
    idle: "bg-sber-green-light/70 text-sber-green",
  },
  blue: {
    selected: "bg-blue-500 text-white",
    idle: "bg-blue-50 text-blue-500",
  },
  orange: {
    selected: "bg-orange-500 text-white",
    idle: "bg-orange-50 text-orange-500",
  },
  red: {
    selected: "bg-red-500 text-white",
    idle: "bg-red-50 text-red-500",
  },
  gray: {
    selected: "bg-gray-500 text-white",
    idle: "bg-gray-100 text-gray-500",
  },
};

function ChoiceIcon({
  name,
  selected,
  tone = "green",
}: {
  name?: string;
  selected: boolean;
  tone?: string;
}) {
  const Icon = name ? ICON_MAP[name] : undefined;
  const palette = TONE_CLASSES[tone] ?? TONE_CLASSES.green;
  return (
    <div
      className={cn(
        "flex h-9 w-9 items-center justify-center rounded-xl transition-colors",
        selected ? palette.selected : palette.idle
      )}
    >
      {Icon ? <Icon className="h-5 w-5" strokeWidth={2} /> : null}
    </div>
  );
}

// Round Sber-green send button — used for single-line composer rows.
function SendButton({
  onClick,
  disabled,
}: {
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label="Отправить"
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sber-green text-white shadow-sm transition-colors hover:bg-sber-green-dark disabled:cursor-not-allowed disabled:opacity-40"
    >
      <ArrowUp className="h-5 w-5" strokeWidth={2.5} />
    </button>
  );
}

// =================== Text ===================
export function TextControl({ step, onSubmit }: ControlProps) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  if (step.kind !== "text") return null;
  const { field, placeholder, minLength, multiline } = step;
  const min = minLength ?? 1;

  function submit() {
    const v = value.trim();
    if (v.length < min) {
      setError(`Минимум ${min} символов`);
      return;
    }
    onSubmit({ fieldUpdates: { [field]: v }, displayText: v });
    setValue("");
    setError(null);
  }

  if (multiline) {
    return (
      <div className="flex flex-col gap-2">
        <textarea
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (error) setError(null);
          }}
          placeholder={placeholder}
          rows={4}
          autoFocus
          className={cn(
            "w-full resize-none rounded-2xl border bg-white px-4 py-3 text-[15px] text-gray-900 shadow-sm outline-none placeholder:text-gray-400 focus-visible:ring-2 focus-visible:ring-sber-green/30",
            error ? "border-red-400" : "border-gray-300"
          )}
        />
        {error && <p className="text-xs text-red-500">{error}</p>}
        <Button onClick={submit} className="rounded-2xl" size="lg">
          Продолжить
        </Button>
      </div>
    );
  }

  // Single-line: composer row with input + send button on the right.
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-end gap-2">
        <Input
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (error) setError(null);
          }}
          placeholder={placeholder}
          className={cn("flex-1", error ? "border-red-400" : "")}
          autoFocus
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
        <SendButton onClick={submit} disabled={!value.trim()} />
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

// =================== Phone ===================
export function PhoneControl({ step, onSubmit }: ControlProps) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  if (step.kind !== "phone") return null;
  const { field } = step;

  function submit() {
    const digits = normalizePhoneDigits(value);
    if (digits.length !== 10) {
      setError("Телефон должен содержать 10 цифр");
      return;
    }
    onSubmit({
      fieldUpdates: { [field]: digits },
      displayText: formatPhone(digits),
    });
    setValue("");
    setError(null);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-end gap-2">
        <Input
          type="tel"
          inputMode="tel"
          value={value}
          onChange={(e) => {
            setValue(formatPhone(e.target.value));
            if (error) setError(null);
          }}
          placeholder="+7 (999) 123-45-67"
          maxLength={18}
          className={cn("flex-1", error ? "border-red-400" : "")}
          autoFocus
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
        <SendButton
          onClick={submit}
          disabled={normalizePhoneDigits(value).length !== 10}
        />
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

// =================== Numeric ===================
export function NumericControl({ step, onSubmit }: ControlProps) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  if (step.kind !== "numeric") return null;
  const { field, placeholder, min, max, integer, suffix, optional } = step;

  function submit() {
    const n = parseFloat(value);
    if (!value.trim() || isNaN(n)) {
      setError("Введите число");
      return;
    }
    if (min !== undefined && n < min) {
      setError(`Минимум ${min}`);
      return;
    }
    if (max !== undefined && n > max) {
      setError(`Максимум ${max}`);
      return;
    }
    if (integer && !Number.isInteger(n)) {
      setError("Целое число");
      return;
    }
    onSubmit({
      fieldUpdates: { [field]: value },
      displayText: suffix ? `${value} ${suffix}` : value,
    });
    setValue("");
    setError(null);
  }

  function skip() {
    onSubmit({ fieldUpdates: { [field]: "" }, displayText: "Пропустить" });
    setValue("");
    setError(null);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-end gap-2">
        <Input
          type="text"
          inputMode={integer ? "numeric" : "decimal"}
          pattern={integer ? "[0-9]*" : "[0-9.,]*"}
          value={value}
          onChange={(e) => {
            const raw = e.target.value.replace(",", ".");
            const cleaned = integer ? raw.replace(/[^0-9]/g, "") : raw.replace(/[^0-9.]/g, "");
            setValue(cleaned);
            if (error) setError(null);
          }}
          placeholder={placeholder}
          className={cn("flex-1 appearance-none", error ? "border-red-400" : "")}
          autoFocus
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
        <SendButton onClick={submit} disabled={!value.trim()} />
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
      {optional && (
        <button
          type="button"
          onClick={skip}
          className="self-start text-[14px] text-gray-500 underline-offset-2 hover:text-sber-green hover:underline"
        >
          Пропустить
        </button>
      )}
    </div>
  );
}

// =================== Date ===================
export function DateControl({ step, onSubmit }: ControlProps) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  if (step.kind !== "date") return null;
  const { field } = step;
  const today = new Date().toISOString().split("T")[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];

  function pickShortcut(d: string, label: string) {
    onSubmit({
      fieldUpdates: { [field]: d },
      displayText: label,
    });
    setValue("");
  }

  function submitCustom() {
    if (!value) {
      setError("Выберите дату");
      return;
    }
    onSubmit({
      fieldUpdates: { [field]: value },
      displayText: new Date(value).toLocaleDateString("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }),
    });
    setValue("");
    setError(null);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-2">
        <ShortcutButton onClick={() => pickShortcut(today, "Сегодня")}>
          Сегодня
        </ShortcutButton>
        <ShortcutButton onClick={() => pickShortcut(yesterday, "Вчера")}>
          Вчера
        </ShortcutButton>
      </div>
      <Input
        type="date"
        max={today}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          if (error) setError(null);
        }}
        className={error ? "border-red-400" : ""}
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
      <Button
        onClick={submitCustom}
        className="rounded-2xl"
        size="lg"
        disabled={!value}
      >
        Продолжить
      </Button>
    </div>
  );
}

function ShortcutButton({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-700 transition-colors hover:border-sber-green hover:text-sber-green"
    >
      {children}
    </button>
  );
}

// =================== Choice cards (single) ===================
export function ChoiceControl({ step, onSubmit }: ControlProps) {
  if (step.kind !== "choice") return null;
  const { field, options } = step;
  return (
    <div className="grid auto-rows-fr grid-cols-2 gap-2.5">
      {options.map((opt: ChoiceOption) => (
        <button
          key={opt.value}
          onClick={() =>
            onSubmit({
              fieldUpdates: { [field]: opt.value },
              displayText: opt.label,
            })
          }
          className="group flex flex-col items-start gap-2.5 rounded-2xl border border-gray-200 bg-white px-3.5 py-3.5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-sber-green hover:shadow-md active:translate-y-0 active:scale-[0.98]"
        >
          <ChoiceIcon name={opt.iconName} selected={false} tone={opt.iconTone} />
          <div className="flex flex-1 flex-col">
            <span className="text-[15px] font-semibold leading-tight text-gray-900">
              {opt.label}
            </span>
            {opt.hint && (
              <span className="mt-0.5 text-xs leading-snug text-gray-500">
                {opt.hint}
              </span>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}

// =================== Multi-select cards ===================
export function MultiChoiceControl({ step, onSubmit }: ControlProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  if (step.kind !== "multi_choice") return null;
  const { field, options, minSelected } = step;
  const min = minSelected ?? 1;

  function toggle(v: string) {
    const next = new Set(selected);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    setSelected(next);
    if (error) setError(null);
  }

  function submit() {
    if (selected.size < min) {
      setError(`Выберите хотя бы ${min}`);
      return;
    }
    const values = Array.from(selected);
    const labels = options
      .filter((o) => selected.has(o.value))
      .map((o) => o.label)
      .join(", ");
    onSubmit({ fieldUpdates: { [field]: values }, displayText: labels });
    setSelected(new Set());
    setError(null);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="grid auto-rows-fr grid-cols-2 gap-2.5">
        {options.map((opt: ChoiceOption) => {
          const isSel = selected.has(opt.value);
          return (
            <button
              key={opt.value}
              onClick={() => toggle(opt.value)}
              className={cn(
                "group relative flex flex-col items-start gap-2.5 rounded-2xl border px-3.5 py-3.5 text-left shadow-sm transition-all active:scale-[0.98]",
                isSel
                  ? "border-sber-green bg-sber-green-light shadow-md"
                  : "border-gray-200 bg-white hover:-translate-y-0.5 hover:border-sber-green hover:shadow-md"
              )}
            >
              {isSel && (
                <span className="absolute right-2.5 top-2.5 flex h-5 w-5 items-center justify-center rounded-full bg-sber-green text-white shadow-sm">
                  <Check className="h-3.5 w-3.5" strokeWidth={3} />
                </span>
              )}
              <ChoiceIcon name={opt.iconName} selected={isSel} tone={opt.iconTone} />
              <div className="flex flex-1 flex-col">
                <span
                  className={cn(
                    "text-[15px] font-semibold leading-tight",
                    isSel ? "text-sber-green-dark" : "text-gray-900"
                  )}
                >
                  {opt.label}
                </span>
                {opt.hint && (
                  <span className="mt-0.5 text-xs leading-snug text-gray-500">
                    {opt.hint}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
      <Button
        onClick={submit}
        className="rounded-2xl"
        size="lg"
        disabled={selected.size === 0}
      >
        Готово
      </Button>
    </div>
  );
}

// =================== Address with DaData ===================
interface AddressSuggestion {
  value: string;
  region_iso_code?: string;
  region?: string;
}

export function AddressControl({ step, onSubmit }: ControlProps) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [showSugg, setShowSugg] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  if (step.kind !== "address") return null;
  const { field } = step;

  function handleChange(v: string) {
    setValue(v);
    if (error) setError(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (v.length < 3) {
      setSuggestions([]);
      setShowSugg(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/suggest-address?q=${encodeURIComponent(v)}`);
        const data = (await res.json()) as { suggestions: AddressSuggestion[] };
        setSuggestions(data.suggestions ?? []);
        setShowSugg((data.suggestions ?? []).length > 0);
      } catch {
        setSuggestions([]);
      }
    }, 250);
  }

  function commit(addr: string, isoCode?: string) {
    if (!addr.trim()) {
      setError("Укажите адрес");
      return;
    }
    onSubmit({
      fieldUpdates: {
        [field]: addr,
        region: regionFromIso(isoCode),
        address_iso: isoCode ?? null,
      },
      displayText: addr,
    });
    setValue("");
    setSuggestions([]);
    setShowSugg(false);
    setError(null);
  }

  function pick(s: AddressSuggestion) {
    commit(s.value, s.region_iso_code);
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Single bubble: composer row (input + send) on top, DaData
          suggestions list below. */}
      <div
        className={cn(
          "overflow-hidden rounded-2xl border bg-white shadow-sm",
          error ? "border-red-400" : "border-gray-300"
        )}
      >
        <div className="flex items-stretch">
          <input
            value={value}
            onChange={(e) => handleChange(e.target.value)}
            onFocus={() => suggestions.length > 0 && setShowSugg(true)}
            placeholder="Москва, ул. Ленина, 5, кв. 12"
            autoComplete="off"
            autoFocus
            onKeyDown={(e) => e.key === "Enter" && commit(value)}
            className="min-w-0 flex-1 border-0 bg-transparent px-4 py-3 text-[15px] text-gray-900 outline-none placeholder:text-gray-400"
          />
          <button
            type="button"
            onClick={() => commit(value)}
            disabled={!value.trim()}
            aria-label="Отправить"
            className="flex w-12 shrink-0 items-center justify-center bg-sber-green text-white transition-colors hover:bg-sber-green-dark disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ArrowUp className="h-5 w-5" strokeWidth={2.5} />
          </button>
        </div>
        {showSugg && suggestions.length > 0 && (
          <>
            <div className="border-t border-gray-200" />
            <ul className="max-h-72 overflow-y-auto">
              {suggestions.map((s, i) => (
                <li key={i}>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      pick(s);
                    }}
                    className="block w-full px-4 py-2.5 text-left text-[15px] text-gray-900 transition-colors hover:bg-sber-green-light"
                  >
                    {s.value}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

// =================== Госуслуги (entry choice) ===================
function GosuslugiIcon({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" aria-hidden="true">
      <circle cx="14" cy="14" r="13" fill="white" stroke="#E5E7EB" />
      <rect x="6" y="9" width="16" height="3" fill="#FFFFFF" stroke="#E5E7EB" strokeWidth="0.5" />
      <rect x="6" y="12" width="16" height="3" fill="#0039A6" />
      <rect x="6" y="15" width="16" height="3" fill="#D52B1E" />
    </svg>
  );
}

export function GosuslugiControl({ step, onSubmit }: ControlProps) {
  if (step.kind !== "gosuslugi") return null;

  function loginGosuslugi() {
    const fio = randomFio();
    const phone = randomPhoneDigits();
    onSubmit({
      fieldUpdates: {
        auth_method: "gosuslugi",
        name: fio,
        phone,
        // Stash human-readable phone for the confirmation message.
        gosuslugi_phone_display: formatPhone(phone),
      },
      displayText: "Войти через Госуслуги",
    });
  }

  function fillManually() {
    onSubmit({
      fieldUpdates: { auth_method: "manual" },
      displayText: "Заполнить вручную",
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <button
        onClick={loginGosuslugi}
        className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-4 text-left transition-colors hover:border-sber-green active:bg-sber-green-light"
      >
        <GosuslugiIcon size={32} />
        <div className="flex flex-1 flex-col">
          <span className="text-[15px] font-semibold text-gray-900">
            Войти через Госуслуги
          </span>
          <span className="text-xs text-gray-500">
            Подставим ФИО и телефон автоматически
          </span>
        </div>
      </button>
      <button
        onClick={fillManually}
        className="self-start text-[14px] text-gray-500 underline-offset-2 hover:text-sber-green hover:underline"
      >
        Заполнить вручную
      </button>
    </div>
  );
}

// =================== Policy found ===================
const FINISH_LABEL: Record<string, string> = {
  econom: "Эконом",
  standard: "Стандарт",
  comfort: "Комфорт",
  premium: "Премиум",
};

export function PolicyFoundControl({ step, onSubmit }: ControlProps) {
  const policy = useMemo(() => randomPolicy(), []);
  if (step.kind !== "policy_found") return null;

  function confirm() {
    onSubmit({
      fieldUpdates: {
        policy_found: true,
        policy_number: policy.number,
        address: policy.address,
        region: policy.region,
        apartment_area_m2: String(policy.apartment_area_m2),
        finish_level: policy.finish_level,
      },
      displayText: "Да, это мой полис",
    });
  }

  function deny() {
    onSubmit({
      fieldUpdates: { policy_found: false },
      displayText: "Нет, заполнить вручную",
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-2xl bg-gradient-to-br from-sber-green to-sber-green-dark p-4 text-white shadow-md">
        <div className="text-[11px] uppercase tracking-wide opacity-80">
          Действующий полис
        </div>
        <div className="mt-1 text-[15px] font-semibold leading-tight">
          {policy.type}
        </div>
        <div className="mt-2 text-xs opacity-90">№ {policy.number}</div>
        <div className="mt-3 text-[14px] leading-snug">{policy.address}</div>
        <div className="mt-2 text-xs opacity-90">
          {FINISH_LABEL[policy.finish_level]} · {policy.apartment_area_m2} м²
        </div>
        <div className="mt-3 flex items-center justify-between text-[11px] opacity-90">
          <span>
            {formatDate(policy.valid_from)} — {formatDate(policy.valid_until)}
          </span>
          <span className="font-semibold">{formatRub(policy.insured_sum_rub)}</span>
        </div>
      </div>
      <Button onClick={confirm} className="rounded-2xl" size="lg">
        Да, это мой полис
      </Button>
      <button
        onClick={deny}
        className="self-start text-[14px] text-gray-500 underline-offset-2 hover:text-sber-green hover:underline"
      >
        Нет, заполнить вручную
      </button>
    </div>
  );
}

// =================== Address confirm ===================
export function AddressConfirmControl({
  step,
  onSubmit,
  onRevert,
  currentAddress,
}: ControlProps & { currentAddress: string }) {
  if (step.kind !== "address_confirm") return null;
  return (
    <div className="flex flex-col gap-2">
      <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-[15px] font-medium text-gray-900">
        {currentAddress || "—"}
      </div>
      <div className="flex gap-2">
        <Button
          variant="outline"
          onClick={() => onRevert?.("A3")}
          className="flex-1 rounded-2xl"
          size="lg"
        >
          Уточнить
        </Button>
        <Button
          onClick={() =>
            onSubmit({
              fieldUpdates: { address_confirmed: true },
              displayText: "Да, верно",
            })
          }
          className="flex-1 rounded-2xl"
          size="lg"
        >
          Да, верно
        </Button>
      </div>
    </div>
  );
}
