"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUp, Check, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, formatDate, formatPhone, formatRub, normalizePhoneDigits } from "@/lib/utils";
import { regionFromIso } from "@/lib/chat/regionMap";
import { randomFio, randomPhoneDigits } from "@/lib/chat/mockUserData";
import { randomPolicy } from "@/lib/chat/mockPolicy";
import type { ChoiceOption, Step } from "@/lib/chat/types";

// Whether a step renders inside the sticky-bottom pill composer (per design
// §06) or inline in the message stream. Multiline text, dates, choices, and
// the special policy/gosuslugi widgets stay in-stream because they need
// more vertical space or carry their own button affordances.
export function isComposerStep(step: Step | null | undefined): boolean {
  if (!step) return false;
  if (step.kind === "phone" || step.kind === "numeric") return true;
  if (step.kind === "text" && !step.multiline) return true;
  return false;
}

export interface SubmitPayload {
  fieldUpdates: Record<string, unknown>;
  displayText: string;
}

export interface ControlProps {
  step: Step;
  onSubmit: (payload: SubmitPayload) => void;
  onRevert?: (toStepId: string) => void;
}

// Inline-style soft-fill input for in-stream controls (multiline text,
// numeric pickers used in compound steps, etc.). Pill composer below.
const CHAT_INPUT_CLASS =
  "h-12 rounded-2xl border-0 bg-gray-100 px-4 text-[15px] text-gray-900 placeholder:text-gray-400 focus-visible:ring-2 focus-visible:ring-sber-green/30 focus-visible:ring-offset-0";

// Pill composer wrapper used by sticky-bottom text/phone/numeric controls.
// Layout: [ + attach? ] [ pill input ... [ ► send ] ].
function PillField({
  inputRef,
  value,
  onChange,
  onEnter,
  onSubmit,
  placeholder,
  type = "text",
  inputMode,
  pattern,
  maxLength,
  disabled,
  ariaLabel,
  showAttach = false,
  error,
}: {
  inputRef?: React.RefObject<HTMLInputElement | null>;
  value: string;
  onChange: (v: string) => void;
  onEnter?: () => void;
  onSubmit: () => void;
  placeholder?: string;
  type?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  pattern?: string;
  maxLength?: number;
  disabled?: boolean;
  ariaLabel?: string;
  showAttach?: boolean;
  error?: string | null;
}) {
  const sendDisabled = disabled || !value.trim();
  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2">
        {showAttach && (
          <button
            type="button"
            disabled
            aria-label="Прикрепить файл"
            className="shrink-0 flex h-11 w-11 items-center justify-center rounded-full bg-chat-surface border border-chat-line text-sber-green disabled:opacity-50"
          >
            <Plus className="h-[18px] w-[18px]" strokeWidth={1.7} />
          </button>
        )}
        <div
          className={cn(
            "relative flex-1 h-11 rounded-full bg-chat-surface border transition-colors",
            error ? "border-chat-danger" : "border-chat-line focus-within:border-sber-green focus-within:border-[1.5px]"
          )}
        >
          <input
            ref={inputRef}
            type={type}
            inputMode={inputMode}
            pattern={pattern}
            maxLength={maxLength}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && onEnter) {
                e.preventDefault();
                onEnter();
              }
            }}
            placeholder={placeholder}
            aria-label={ariaLabel}
            autoFocus
            className="w-full h-full bg-transparent rounded-full pl-4 pr-12 text-[15px] text-chat-ink placeholder:text-chat-muted outline-none"
          />
          <button
            type="button"
            onClick={onSubmit}
            disabled={sendDisabled}
            aria-label="Отправить"
            className="absolute right-1.5 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-sber-green text-white transition-colors hover:bg-sber-green-dark disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.92]"
          >
            <ArrowUp className="h-[16px] w-[16px]" strokeWidth={1.8} />
          </button>
        </div>
      </div>
      {error && <p className="mt-1 text-xs text-chat-danger">{error}</p>}
    </div>
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
    const maxLen = 500;
    return (
      <div className="flex flex-col gap-2">
        <div className="relative">
          <textarea
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              if (error) setError(null);
            }}
            placeholder={placeholder}
            rows={4}
            maxLength={maxLen}
            autoFocus
            className={cn(
              "w-full resize-none rounded-2xl border-0 bg-gray-100 px-4 pb-7 pt-3 text-[16px] text-gray-900 outline-none placeholder:text-gray-400 focus-visible:ring-2 focus-visible:ring-sber-green/30",
              error ? "ring-2 ring-red-300" : ""
            )}
          />
          <span className="pointer-events-none absolute bottom-2.5 left-4 text-xs text-gray-400">
            {value.length} / {maxLen}
          </span>
        </div>
        {error && <p className="text-xs text-red-500">{error}</p>}
        <Button onClick={submit} className="rounded-2xl" size="lg">
          Продолжить
        </Button>
      </div>
    );
  }

  // Single-line: pill composer row.
  return (
    <PillField
      value={value}
      onChange={(v) => {
        setValue(v);
        if (error) setError(null);
      }}
      onEnter={submit}
      onSubmit={submit}
      placeholder={placeholder ?? "Ваш ответ"}
      ariaLabel="Сообщение"
      showAttach
      error={error}
    />
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
    <PillField
      type="tel"
      inputMode="tel"
      value={value}
      onChange={(v) => {
        setValue(formatPhone(v));
        if (error) setError(null);
      }}
      onEnter={submit}
      onSubmit={submit}
      placeholder="+7 (999) 123-45-67"
      maxLength={18}
      disabled={normalizePhoneDigits(value).length !== 10}
      ariaLabel="Телефон"
      showAttach
      error={error}
    />
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
      <PillField
        type="text"
        inputMode={integer ? "numeric" : "decimal"}
        pattern={integer ? "[0-9]*" : "[0-9.,]*"}
        value={value}
        onChange={(raw) => {
          const replaced = raw.replace(",", ".");
          const cleaned = integer ? replaced.replace(/[^0-9]/g, "") : replaced.replace(/[^0-9.]/g, "");
          setValue(cleaned);
          if (error) setError(null);
        }}
        onEnter={submit}
        onSubmit={submit}
        placeholder={placeholder}
        ariaLabel={suffix ? `Число (${suffix})` : "Число"}
        showAttach
        error={error}
      />
      {optional && (
        <button
          type="button"
          onClick={skip}
          className="self-end px-3 py-1.5 text-[13px] font-medium text-chat-muted rounded-full bg-chat-surface border border-chat-line hover:text-chat-ink"
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
        className={cn(CHAT_INPUT_CLASS, error ? "ring-2 ring-red-300" : "")}
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
//
// Per the Sber chat redesign (§05): each option renders as a green
// user-style bubble-button right-aligned in the message stream. Click sends
// the choice and lets the engine produce a static user message + typing
// indicator below.
export function ChoiceControl({ step, onSubmit }: ControlProps) {
  if (step.kind !== "choice") return null;
  const { field, options } = step;
  return (
    <div className="flex flex-col items-end gap-2">
      {options.map((opt: ChoiceOption) => (
        <button
          key={opt.value}
          onClick={() =>
            onSubmit({
              fieldUpdates: { [field]: opt.value },
              displayText: opt.label,
            })
          }
          className={cn(
            "group max-w-[85%] rounded-[18px_18px_4px_18px]",
            "bg-sber-green text-white text-[15px] font-medium leading-[22px]",
            "px-4 py-[11px] text-right transition-colors",
            "hover:bg-sber-green-dark active:scale-[0.99]"
          )}
        >
          <span>{opt.label}</span>
          {opt.hint && (
            <span className="block text-[12px] font-normal leading-4 text-white/80 mt-0.5">
              {opt.hint}
            </span>
          )}
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
    <div className="flex flex-col items-end gap-2">
      {options.map((opt: ChoiceOption) => {
        const isSel = selected.has(opt.value);
        return (
          <button
            key={opt.value}
            onClick={() => toggle(opt.value)}
            className={cn(
              "max-w-[85%] rounded-[18px_18px_4px_18px] px-4 py-[11px]",
              "text-[15px] font-medium leading-[22px] transition-colors active:scale-[0.99]",
              isSel
                ? "bg-sber-green text-white"
                : "bg-chat-surface text-chat-ink border border-chat-line hover:bg-sber-green-light/40"
            )}
          >
            <span className="flex items-center gap-2 justify-end">
              {opt.label}
              {isSel && <Check className="h-4 w-4" strokeWidth={2.5} />}
            </span>
            {opt.hint && (
              <span
                className={cn(
                  "block text-[12px] font-normal leading-4 mt-0.5",
                  isSel ? "text-white/80" : "text-chat-muted"
                )}
              >
                {opt.hint}
              </span>
            )}
          </button>
        );
      })}
      {error && <p className="text-xs text-chat-danger self-end">{error}</p>}
      <button
        type="button"
        onClick={submit}
        disabled={selected.size === 0}
        className={cn(
          "rounded-full px-5 py-2.5 text-[14px] font-semibold transition-colors",
          "bg-sber-green text-white hover:bg-sber-green-dark",
          "disabled:opacity-40 disabled:cursor-not-allowed"
        )}
      >
        Готово
      </button>
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
            className="min-w-0 flex-1 border-0 bg-transparent px-4 py-3 text-[16px] text-gray-900 outline-none placeholder:text-gray-400"
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

// =================== Rooms (per-room dimensions) ===================
//
// Captures damaged rooms with explicit length × width × height plus the
// affected surface set (потолок / стены / пол). Calculator priority: sum
// of surface areas across rooms beats any visual estimate from photos.
const SURFACE_LABELS: Array<{ value: "ceiling" | "wall" | "floor"; label: string }> = [
  { value: "ceiling", label: "Потолок" },
  { value: "wall", label: "Стены" },
  { value: "floor", label: "Пол" },
];

interface RoomDraft {
  id: string;
  name: string;
  length_m: string;
  width_m: string;
  height_m: string;
  affected_surfaces: ("ceiling" | "wall" | "floor")[];
}

function makeRoomDraft(): RoomDraft {
  return {
    id: `r_${Math.random().toString(36).slice(2, 8)}`,
    name: "",
    length_m: "",
    width_m: "",
    height_m: "2.7",
    affected_surfaces: ["wall"],
  };
}

export function RoomsControl({ step, onSubmit }: ControlProps) {
  const [rooms, setRooms] = useState<RoomDraft[]>(() => [makeRoomDraft()]);
  const [error, setError] = useState<string | null>(null);
  if (step.kind !== "rooms") return null;
  const min = step.minRooms ?? 1;
  const max = step.maxRooms ?? 6;

  function patch(idx: number, patch: Partial<RoomDraft>) {
    setRooms((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
    if (error) setError(null);
  }

  function toggleSurface(idx: number, s: "ceiling" | "wall" | "floor") {
    setRooms((prev) =>
      prev.map((r, i) => {
        if (i !== idx) return r;
        const has = r.affected_surfaces.includes(s);
        return { ...r, affected_surfaces: has ? r.affected_surfaces.filter((x) => x !== s) : [...r.affected_surfaces, s] };
      })
    );
  }

  function addRoom() {
    if (rooms.length >= max) return;
    setRooms((prev) => [...prev, makeRoomDraft()]);
  }

  function removeRoom(idx: number) {
    if (rooms.length <= min) return;
    setRooms((prev) => prev.filter((_, i) => i !== idx));
  }

  function submit() {
    const out: Array<{
      id: string;
      name: string;
      length_m: number;
      width_m: number;
      height_m: number;
      affected_surfaces: ("ceiling" | "wall" | "floor")[];
    }> = [];
    for (let i = 0; i < rooms.length; i++) {
      const r = rooms[i];
      const l = parseFloat(r.length_m);
      const w = parseFloat(r.width_m);
      const h = parseFloat(r.height_m);
      if (!isFinite(l) || l <= 0 || !isFinite(w) || w <= 0 || !isFinite(h) || h <= 0) {
        setError(`Комната ${i + 1}: укажите длину, ширину и высоту`);
        return;
      }
      if (r.affected_surfaces.length === 0) {
        setError(`Комната ${i + 1}: выберите хотя бы одну пострадавшую поверхность`);
        return;
      }
      out.push({
        id: r.id,
        name: r.name.trim() || `Комната ${i + 1}`,
        length_m: l,
        width_m: w,
        height_m: h,
        affected_surfaces: r.affected_surfaces,
      });
    }

    const display = out
      .map((r) => `${r.name} ${r.length_m}×${r.width_m}×${r.height_m} м (${r.affected_surfaces.map((s) => SURFACE_LABELS.find((x) => x.value === s)?.label).join("/")})`)
      .join(", ");

    onSubmit({
      fieldUpdates: { [step.field]: out },
      displayText: `${out.length} ${pluralRooms(out.length)}: ${display}`,
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {rooms.map((r, idx) => (
        <div key={r.id} className="rounded-[14px] border border-chat-line bg-chat-surface p-3.5 space-y-3">
          <div className="flex items-center gap-2">
            <input
              value={r.name}
              onChange={(e) => patch(idx, { name: e.target.value })}
              placeholder={`Комната ${idx + 1}: например, кухня`}
              className="flex-1 h-9 rounded-full border border-chat-line bg-chat-surface px-3.5 text-[14px] text-chat-ink placeholder:text-chat-muted outline-none focus:border-sber-green focus:border-[1.5px]"
            />
            {rooms.length > min && (
              <button
                type="button"
                onClick={() => removeRoom(idx)}
                aria-label="Удалить комнату"
                className="h-9 w-9 shrink-0 rounded-full bg-chat-surface border border-chat-line text-chat-muted hover:text-chat-danger flex items-center justify-center"
              >
                ×
              </button>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { key: "length_m" as const, label: "Длина, м" },
              { key: "width_m" as const, label: "Ширина, м" },
              { key: "height_m" as const, label: "Высота, м" },
            ].map((f) => (
              <label key={f.key} className="block">
                <span className="block text-[11px] uppercase tracking-[0.06em] text-chat-muted mb-1">{f.label}</span>
                <input
                  type="number"
                  step="0.1"
                  min={0.1}
                  inputMode="decimal"
                  value={r[f.key]}
                  onChange={(e) => patch(idx, { [f.key]: e.target.value })}
                  placeholder="0,0"
                  className="w-full h-10 rounded-[10px] border border-chat-line bg-chat-surface px-3 text-[14px] text-chat-ink outline-none focus:border-sber-green focus:border-[1.5px] tabular-nums"
                />
              </label>
            ))}
          </div>
          <div>
            <span className="block text-[11px] uppercase tracking-[0.06em] text-chat-muted mb-1.5">Что пострадало</span>
            <div className="flex flex-wrap gap-1.5">
              {SURFACE_LABELS.map((s) => {
                const on = r.affected_surfaces.includes(s.value);
                return (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => toggleSurface(idx, s.value)}
                    className={cn(
                      "rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors border",
                      on
                        ? "bg-sber-green text-white border-sber-green"
                        : "bg-chat-surface text-chat-ink border-chat-line hover:border-sber-green/50"
                    )}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ))}
      {rooms.length < max && (
        <button
          type="button"
          onClick={addRoom}
          className="self-start inline-flex items-center gap-1.5 rounded-full bg-chat-surface border border-chat-line px-4 py-2 text-[13px] font-medium text-sber-green hover:border-sber-green"
        >
          <Plus className="h-4 w-4" strokeWidth={1.7} /> Добавить комнату
        </button>
      )}
      {error && <p className="text-xs text-chat-danger">{error}</p>}
      <Button onClick={submit} className="rounded-2xl" size="lg">
        Продолжить
      </Button>
    </div>
  );
}

function pluralRooms(n: number): string {
  // ru pluralization: 1 → комната, 2-4 → комнаты, 5+ → комнат
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "комната";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "комнаты";
  return "комнат";
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
