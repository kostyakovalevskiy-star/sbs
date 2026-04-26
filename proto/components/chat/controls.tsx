"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check } from "lucide-react";
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

  return (
    <div className="flex flex-col gap-2">
      {multiline ? (
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
      ) : (
        <Input
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (error) setError(null);
          }}
          placeholder={placeholder}
          className={error ? "border-red-400" : ""}
          autoFocus
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
      )}
      {error && <p className="text-xs text-red-500">{error}</p>}
      <Button onClick={submit} className="rounded-2xl" size="lg">
        Продолжить
      </Button>
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
        className={error ? "border-red-400" : ""}
        autoFocus
        onKeyDown={(e) => e.key === "Enter" && submit()}
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
      <Button onClick={submit} className="rounded-2xl" size="lg">
        Продолжить
      </Button>
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
      <Input
        type="text"
        inputMode={integer ? "numeric" : "decimal"}
        pattern={integer ? "[0-9]*" : "[0-9.,]*"}
        value={value}
        onChange={(e) => {
          // Strip non-numeric input as user types, allow comma as decimal sep.
          const raw = e.target.value.replace(",", ".");
          const cleaned = integer ? raw.replace(/[^0-9]/g, "") : raw.replace(/[^0-9.]/g, "");
          setValue(cleaned);
          if (error) setError(null);
        }}
        placeholder={placeholder}
        className={cn("appearance-none", error ? "border-red-400" : "")}
        autoFocus
        onKeyDown={(e) => e.key === "Enter" && submit()}
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
      <div className="flex gap-2">
        {optional && (
          <Button
            onClick={skip}
            variant="outline"
            className="flex-1 rounded-2xl"
            size="lg"
          >
            Пропустить
          </Button>
        )}
        <Button onClick={submit} className="flex-1 rounded-2xl" size="lg">
          Продолжить
        </Button>
      </div>
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
    <div className="grid grid-cols-1 gap-2">
      {options.map((opt: ChoiceOption) => (
        <button
          key={opt.value}
          onClick={() =>
            onSubmit({
              fieldUpdates: { [field]: opt.value },
              displayText: opt.label,
            })
          }
          className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-4 text-left transition-colors hover:border-sber-green active:bg-sber-green-light"
        >
          <div className="flex flex-1 flex-col">
            <span className="text-[15px] font-medium text-gray-900">
              {opt.label}
            </span>
            {opt.hint && (
              <span className="text-xs text-gray-500">{opt.hint}</span>
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
      <div className="grid grid-cols-1 gap-2">
        {options.map((opt: ChoiceOption) => {
          const isSel = selected.has(opt.value);
          return (
            <button
              key={opt.value}
              onClick={() => toggle(opt.value)}
              className={cn(
                "flex items-center justify-between gap-3 rounded-2xl border bg-white px-4 py-4 text-left transition-colors",
                isSel
                  ? "border-sber-green bg-sber-green-light"
                  : "border-gray-200 hover:border-gray-300"
              )}
            >
              <span className="text-[15px] font-medium text-gray-900">
                {opt.label}
              </span>
              <div
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-md border",
                  isSel ? "border-sber-green bg-sber-green" : "border-gray-300"
                )}
              >
                {isSel && <Check className="h-4 w-4 text-white" />}
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
      {/* Single bubble: input on top, DaData suggestions list below. */}
      <div
        className={cn(
          "overflow-hidden rounded-2xl border bg-white shadow-sm",
          error ? "border-red-400" : "border-gray-300"
        )}
      >
        <input
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => suggestions.length > 0 && setShowSugg(true)}
          placeholder="Москва, ул. Ленина, 5, кв. 12"
          autoComplete="off"
          autoFocus
          className="w-full border-0 bg-transparent px-4 py-3 text-[15px] text-gray-900 outline-none placeholder:text-gray-400"
        />
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
      <Button
        onClick={() => commit(value)}
        disabled={!value.trim()}
        className="rounded-2xl"
        size="lg"
      >
        Продолжить
      </Button>
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
