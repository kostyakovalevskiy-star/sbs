"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ChevronLeft, X, Loader2, Pencil, Plus, Check, Trash2 } from "lucide-react";
import type {
  DraftState,
  IncidentContext,
  RoomDimensions,
  PayoutDetails,
} from "@/types";

const finishLabels: Record<string, string> = {
  econom: "Эконом",
  standard: "Стандарт",
  comfort: "Комфорт",
  premium: "Премиум",
};

const wallMaterialLabels: Record<string, string> = {
  panel: "Панельный",
  brick: "Кирпич",
  monolith: "Монолит",
  drywall: "Гипсокартон",
};

const surfaceLabels: Record<string, string> = {
  ceiling: "потолок",
  wall: "стены",
  floor: "пол",
  doorway: "проём",
  window: "окно",
};

export default function ReviewPage() {
  const router = useRouter();
  const [draft, setDraft] = useState<DraftState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem("claim_draft");
    if (raw) setDraft(JSON.parse(raw));
  }, []);

  function saveDraft(next: DraftState) {
    setDraft(next);
    localStorage.setItem("claim_draft", JSON.stringify(next));
  }

  function patchIntro(patch: Partial<IncidentContext>) {
    if (!draft) return;
    const next: DraftState = {
      ...draft,
      intro: { ...(draft.intro ?? {}), ...patch },
    };
    saveDraft(next);
  }

  function patchFlood(patch: Partial<IncidentContext>) {
    if (!draft) return;
    const next: DraftState = {
      ...draft,
      flood: { ...(draft.flood ?? {}), ...patch },
    };
    saveDraft(next);
  }

  function setPayout(payout: PayoutDetails | undefined) {
    if (!draft) return;
    saveDraft({ ...draft, payout });
  }

  function removePhoto(idx: number) {
    if (!draft) return;
    saveDraft({ ...draft, photos: (draft.photos ?? []).filter((_, i) => i !== idx) });
  }

  async function handleSubmit() {
    if (!draft) return;
    setLoading(true);
    setError(null);

    try {
      const context: IncidentContext = {
        id: draft.id,
        name: draft.intro?.name ?? "",
        phone: draft.intro?.phone ?? "",
        region: draft.intro?.region ?? "moscow",
        address: draft.intro?.address ?? "",
        apartment_area_m2: draft.intro?.apartment_area_m2 ?? 0,
        last_renovation_year: draft.intro?.last_renovation_year ?? 2015,
        event_type: "flood",
        floor: draft.flood?.floor,
        source_floor: draft.flood?.source_floor,
        event_date: draft.flood?.event_date,
        affected_area_m2: draft.flood?.affected_area_m2,
        rooms: draft.flood?.rooms ?? draft.intro?.rooms,
        ceiling_height: draft.flood?.ceiling_height,
        finish_level: (draft.intro?.finish_level ?? draft.flood?.finish_level) as "econom" | "standard" | "comfort" | "premium",
        wall_material: draft.flood?.wall_material,
      };

      const formData = new FormData();
      formData.append("context", JSON.stringify(context));

      const sceneIds: string[] = [];
      for (const photo of draft.photos ?? []) {
        const blob = await (async () => {
          const res = await fetch(`data:image/jpeg;base64,${photo.base64}`);
          return res.blob();
        })();
        formData.append("photos", blob, "photo.jpg");
        sceneIds.push(photo.sceneId ?? "");
      }
      formData.append("scene_ids", JSON.stringify(sceneIds));

      const res = await fetch("/api/analyze", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok || data.error) {
        setError(
          data.error === "ai_parse_failed"
            ? "AI не смог обработать фотографии. Попробуйте ещё раз."
            : data.message ?? "Ошибка анализа. Попробуйте ещё раз."
        );
        return;
      }

      const updatedDraft = { ...draft, current_step: "result" as const, result: { id: data.id, report: data.report } };
      localStorage.setItem("claim_draft", JSON.stringify(updatedDraft));
      router.push(`/result/${data.id}`);
    } catch (err) {
      setError("Ошибка соединения. Проверьте интернет и попробуйте ещё раз.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  if (!draft) return null;

  const photos = draft.photos ?? [];
  const intro = draft.intro ?? {};
  const flood = draft.flood ?? {};
  const rooms = flood.rooms ?? [];
  const affectedAreaSummary = areaSummary(flood);

  return (
    <main className="min-h-screen bg-[#f5f6f7]">
      {loading && (
        <div className="fixed inset-0 bg-white/95 flex flex-col items-center justify-center z-50 gap-4">
          <Loader2 className="w-10 h-10 text-[#21A038] animate-spin" />
          <p className="text-lg font-medium text-gray-800">Анализируем повреждения…</p>
          <p className="text-sm text-gray-500">Обычно занимает 10–20 секунд</p>
        </div>
      )}

      <div className="sticky top-0 z-20 bg-white pt-safe">
        <div className="bg-[#21A038] h-1.5">
          <div className="bg-white/40 h-full" style={{ width: "0%" }} />
        </div>
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-600 p-1 -ml-1">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <p className="text-xs text-gray-500">Шаг 4 из 5 — Проверка</p>
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
        <h1 className="font-display text-2xl font-bold text-gray-900 px-1">Проверьте данные</h1>
        <p className="text-xs text-gray-500 px-1 -mt-3">
          Тапните по любому значению, чтобы изменить его. Имя, телефон и номер
          полиса — нередактируемые: для их правки потребуется поддержка.
        </p>

        {/* Personal — read-only */}
        <Card title="Личные данные">
          <ReadOnlyRow label="Имя" value={intro.name} />
          <ReadOnlyRow label="Телефон" value={intro.phone ? formatPhoneDisplay(intro.phone) : null} />
          <ReadOnlyRow label="Полис" value={intro.policy_number_manual ?? null} />
        </Card>

        {/* Object */}
        <Card title="Объект">
          <EditableRow
            label="Адрес"
            value={intro.address ?? null}
            renderEditor={(v, onSave, onCancel) => (
              <SimpleTextEditor initial={v} placeholder="Город, улица, дом, кв." onSave={onSave} onCancel={onCancel} />
            )}
            onSave={(v) => patchIntro({ address: v })}
          />
          <EditableRow
            label="Регион"
            value={intro.region ?? null}
            renderEditor={(v, onSave, onCancel) => (
              <SimpleTextEditor initial={v} onSave={onSave} onCancel={onCancel} />
            )}
            onSave={(v) => patchIntro({ region: v })}
          />
          <EditableRow
            label="Площадь квартиры"
            value={intro.apartment_area_m2 ? `${intro.apartment_area_m2} м²` : null}
            renderEditor={(_v, onSave, onCancel) => (
              <SimpleTextEditor
                initial={intro.apartment_area_m2 ? String(intro.apartment_area_m2) : ""}
                placeholder="м²"
                inputMode="decimal"
                onSave={onSave}
                onCancel={onCancel}
              />
            )}
            onSave={(v) => patchIntro({ apartment_area_m2: parseFloat(v) || 0 })}
          />
          <EditableRow
            label="Отделка"
            value={finishLabels[intro.finish_level ?? ""] ?? intro.finish_level ?? null}
            renderEditor={(_v, onSave, onCancel) => (
              <SelectEditor
                initial={intro.finish_level ?? "standard"}
                options={[
                  { value: "econom", label: "Эконом" },
                  { value: "standard", label: "Стандарт" },
                  { value: "comfort", label: "Комфорт" },
                  { value: "premium", label: "Премиум" },
                ]}
                onSave={onSave}
                onCancel={onCancel}
              />
            )}
            onSave={(v) => patchIntro({ finish_level: v as "econom" | "standard" | "comfort" | "premium" })}
          />
        </Card>

        {/* Event */}
        <Card title="Событие">
          <EditableRow
            label="Дата события"
            value={flood.event_date ?? null}
            renderEditor={(v, onSave, onCancel) => (
              <SimpleTextEditor initial={v} type="date" onSave={onSave} onCancel={onCancel} />
            )}
            onSave={(v) => patchFlood({ event_date: v })}
          />
          <EditableRow
            label="Этаж"
            value={flood.floor !== undefined ? String(flood.floor) : null}
            renderEditor={(_v, onSave, onCancel) => (
              <SimpleTextEditor
                initial={flood.floor !== undefined ? String(flood.floor) : ""}
                inputMode="numeric"
                onSave={onSave}
                onCancel={onCancel}
              />
            )}
            onSave={(v) => patchFlood({ floor: parseInt(v, 10) || undefined })}
          />
          <EditableRow
            label="Материал стен"
            value={wallMaterialLabels[flood.wall_material ?? ""] ?? flood.wall_material ?? null}
            renderEditor={(_v, onSave, onCancel) => (
              <SelectEditor
                initial={flood.wall_material ?? "brick"}
                options={[
                  { value: "panel", label: "Панельный" },
                  { value: "brick", label: "Кирпич" },
                  { value: "monolith", label: "Монолит" },
                  { value: "drywall", label: "Гипсокартон" },
                ]}
                onSave={onSave}
                onCancel={onCancel}
              />
            )}
            onSave={(v) => patchFlood({ wall_material: v as "panel" | "brick" | "monolith" | "drywall" })}
          />
          <ReadOnlyRow label="Площадь повреждений" value={affectedAreaSummary} />
        </Card>

        {/* Rooms — full editable list */}
        <Card title={`Пострадавшие комнаты (${rooms.length})`}>
          <RoomsEditor
            rooms={rooms}
            onSave={(next) => patchFlood({ rooms: next })}
          />
        </Card>

        {/* Movable property */}
        <Card title="Пострадавшее имущество">
          <EditableTextarea
            initial={intro.movable_property ?? ""}
            placeholder="Холодильник Bosch KGE3, диван IKEA Friheten…"
            onSave={(v) => patchIntro({ movable_property: v.trim() || undefined })}
          />
        </Card>

        {/* Payout */}
        <Card title="Способ выплаты">
          <PayoutEditor
            payout={draft.payout}
            phoneDigits={intro.phone}
            onSave={setPayout}
          />
        </Card>

        {/* Description */}
        <Card title="Описание клиента">
          <EditableTextarea
            initial={intro.incident_description ?? ""}
            placeholder="Подробности события, что и где пострадало…"
            onSave={(v) => patchIntro({ incident_description: v.trim() || undefined })}
          />
        </Card>

        {/* Photos — grouped by room/scene */}
        <PhotosSection
          photos={photos}
          rooms={rooms}
          onAdd={() => router.push("/flow/camera")}
          onRemove={removePhoto}
        />

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <div className="pt-2 flex gap-3" style={{ paddingBottom: "max(3rem, env(safe-area-inset-bottom, 3rem))" }}>
          <Button variant="outline" onClick={() => router.back()} className="flex-1 rounded-2xl">
            Назад
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={photos.length === 0 || loading}
            className="flex-1 rounded-2xl"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Анализ…
              </>
            ) : (
              "Отправить на анализ"
            )}
          </Button>
        </div>
      </div>
    </main>
  );
}

// =============== Helpers ===============

function areaSummary(flood: Partial<IncidentContext>): string | null {
  const rooms = flood.rooms;
  if (rooms && rooms.length > 0) {
    const total = rooms.reduce((s, r) => {
      const surfaces = r.affected_surfaces ?? [];
      const fc = r.length_m * r.width_m;
      const wa = 2 * (r.length_m + r.width_m) * r.height_m;
      let a = 0;
      if (surfaces.includes("ceiling")) a += fc;
      if (surfaces.includes("floor")) a += fc;
      if (surfaces.includes("wall")) a += wa;
      return s + a;
    }, 0);
    return `${Math.round(total * 10) / 10} м² (по ${rooms.length} комнатам)`;
  }
  return flood.affected_area_m2 ? `${flood.affected_area_m2} м²` : null;
}

function formatPhoneDisplay(digits: string): string {
  const d = digits.replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("7")) {
    return `+7 (${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7, 9)}-${d.slice(9, 11)}`;
  }
  if (d.length === 10) {
    return `+7 (${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6, 8)}-${d.slice(8, 10)}`;
  }
  return digits;
}

// =============== Layout primitives ===============

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-3xl p-5 sm:p-6 space-y-3">
      <h2 className="text-sm font-semibold text-gray-700">{title}</h2>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function ReadOnlyRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="grid grid-cols-[8rem_1fr] gap-3 text-sm py-1.5">
      <span className="text-gray-500">{label}</span>
      <span className="text-gray-900 break-words">{value}</span>
    </div>
  );
}

function EditableRow({
  label,
  value,
  renderEditor,
  onSave,
}: {
  label: string;
  value: string | null;
  renderEditor: (initial: string, save: (v: string) => void, cancel: () => void) => React.ReactNode;
  onSave: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const display = value ?? "—";
  if (editing) {
    return (
      <div className="grid grid-cols-[8rem_1fr] gap-3 items-start py-1.5 text-sm">
        <span className="text-gray-500 mt-2">{label}</span>
        <div>
          {renderEditor(
            value ?? "",
            (next) => {
              onSave(next);
              setEditing(false);
            },
            () => setEditing(false)
          )}
        </div>
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="grid grid-cols-[8rem_1fr_1.25rem] gap-3 items-center py-1.5 text-sm w-full text-left rounded-md hover:bg-gray-50 -mx-2 px-2 transition-colors"
    >
      <span className="text-gray-500">{label}</span>
      <span className={value ? "text-gray-900 break-words" : "text-gray-400 italic"}>{display}</span>
      <Pencil className="w-3.5 h-3.5 text-gray-400" />
    </button>
  );
}

function SimpleTextEditor({
  initial,
  placeholder,
  type = "text",
  inputMode,
  onSave,
  onCancel,
}: {
  initial: string;
  placeholder?: string;
  type?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  onSave: (v: string) => void;
  onCancel: () => void;
}) {
  const [v, setV] = useState(initial);
  return (
    <div className="flex items-center gap-2">
      <input
        type={type}
        inputMode={inputMode}
        value={v}
        onChange={(e) => setV(e.target.value)}
        placeholder={placeholder}
        autoFocus
        onKeyDown={(e) => {
          if (e.key === "Enter") onSave(v);
          if (e.key === "Escape") onCancel();
        }}
        className="flex-1 h-9 rounded-lg border border-gray-200 px-3 text-sm text-gray-900 focus:border-sber-green focus:border-[1.5px] outline-none bg-white"
      />
      <button
        type="button"
        onClick={() => onSave(v)}
        aria-label="Сохранить"
        className="h-8 w-8 shrink-0 rounded-full bg-sber-green text-white flex items-center justify-center"
      >
        <Check className="w-4 h-4" strokeWidth={2.5} />
      </button>
      <button
        type="button"
        onClick={onCancel}
        aria-label="Отменить"
        className="h-8 w-8 shrink-0 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

function SelectEditor({
  initial,
  options,
  onSave,
  onCancel,
}: {
  initial: string;
  options: Array<{ value: string; label: string }>;
  onSave: (v: string) => void;
  onCancel: () => void;
}) {
  const [v, setV] = useState(initial);
  return (
    <div className="flex items-center gap-2">
      <select
        value={v}
        onChange={(e) => setV(e.target.value)}
        autoFocus
        className="flex-1 h-9 rounded-lg border border-gray-200 px-2 text-sm text-gray-900 bg-white"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => onSave(v)}
        className="h-8 w-8 shrink-0 rounded-full bg-sber-green text-white flex items-center justify-center"
      >
        <Check className="w-4 h-4" strokeWidth={2.5} />
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="h-8 w-8 shrink-0 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

function EditableTextarea({
  initial,
  placeholder,
  onSave,
}: {
  initial: string;
  placeholder?: string;
  onSave: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState(initial);
  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setV(initial);
          setEditing(true);
        }}
        className="w-full text-left rounded-md hover:bg-gray-50 -mx-2 px-2 py-1.5 text-sm transition-colors flex items-start gap-3"
      >
        <span className={initial ? "text-gray-900 whitespace-pre-wrap flex-1" : "text-gray-400 italic flex-1"}>
          {initial || placeholder || "Тапните, чтобы заполнить"}
        </span>
        <Pencil className="w-3.5 h-3.5 text-gray-400 mt-1 shrink-0" />
      </button>
    );
  }
  return (
    <div className="space-y-2">
      <textarea
        value={v}
        onChange={(e) => setV(e.target.value)}
        placeholder={placeholder}
        autoFocus
        rows={4}
        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-sber-green focus:border-[1.5px] outline-none resize-none"
      />
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="px-3 py-1.5 rounded-full text-xs font-medium text-gray-500 hover:bg-gray-100"
        >
          Отменить
        </button>
        <button
          type="button"
          onClick={() => {
            onSave(v);
            setEditing(false);
          }}
          className="px-3 py-1.5 rounded-full text-xs font-medium bg-sber-green text-white"
        >
          Сохранить
        </button>
      </div>
    </div>
  );
}

// =============== Rooms editor ===============

function makeBlankRoom(idx: number): RoomDimensions {
  return {
    id: `r_${Math.random().toString(36).slice(2, 8)}`,
    name: `Комната ${idx + 1}`,
    length_m: 4,
    width_m: 3,
    height_m: 2.7,
    affected_surfaces: ["wall"],
  };
}

function RoomsEditor({
  rooms,
  onSave,
}: {
  rooms: RoomDimensions[];
  onSave: (next: RoomDimensions[]) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<RoomDimensions[]>(rooms);

  function startEdit() {
    setDraft(rooms.length ? rooms.map((r) => ({ ...r, affected_surfaces: [...(r.affected_surfaces ?? [])] })) : [makeBlankRoom(0)]);
    setEditing(true);
  }

  function patch(idx: number, p: Partial<RoomDimensions>) {
    setDraft((prev) => prev.map((r, i) => (i === idx ? { ...r, ...p } : r)));
  }

  function toggleSurface(idx: number, s: "ceiling" | "wall" | "floor") {
    setDraft((prev) =>
      prev.map((r, i) => {
        if (i !== idx) return r;
        const list = r.affected_surfaces ?? [];
        return {
          ...r,
          affected_surfaces: list.includes(s)
            ? (list.filter((x) => x !== s) as typeof list)
            : ([...list, s] as typeof list),
        };
      })
    );
  }

  function addRoom() {
    setDraft((prev) => [...prev, makeBlankRoom(prev.length)]);
  }
  function removeRoom(idx: number) {
    setDraft((prev) => prev.filter((_, i) => i !== idx));
  }

  if (!editing) {
    if (rooms.length === 0) {
      return (
        <button
          type="button"
          onClick={startEdit}
          className="w-full text-sm text-[#21A038] font-medium py-3 border border-dashed border-gray-200 rounded-lg hover:bg-gray-50"
        >
          + Добавить пострадавшие комнаты
        </button>
      );
    }
    return (
      <div className="space-y-2">
        {rooms.map((r) => (
          <div key={r.id} className="text-sm bg-gray-50 rounded-lg px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-gray-900">{r.name}</span>
              <span className="text-xs text-gray-500 tabular-nums">
                {r.length_m}×{r.width_m}×{r.height_m} м
              </span>
            </div>
            {r.affected_surfaces && r.affected_surfaces.length > 0 && (
              <p className="text-xs text-gray-500 mt-0.5">
                Пострадало: {r.affected_surfaces.map((s) => surfaceLabels[s]).join(", ")}
              </p>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={startEdit}
          className="text-xs text-[#21A038] font-medium inline-flex items-center gap-1"
        >
          <Pencil className="w-3.5 h-3.5" /> Изменить
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {draft.map((r, idx) => (
        <div key={r.id} className="rounded-xl border border-gray-200 bg-white p-3 space-y-2">
          <div className="flex items-center gap-2">
            <input
              value={r.name}
              onChange={(e) => patch(idx, { name: e.target.value })}
              placeholder={`Комната ${idx + 1}`}
              className="flex-1 h-8 rounded-md border border-gray-200 bg-white px-2 text-sm text-gray-900 outline-none focus:border-sber-green focus:border-[1.5px]"
            />
            {draft.length > 1 && (
              <button
                type="button"
                onClick={() => removeRoom(idx)}
                aria-label="Удалить"
                className="h-8 w-8 rounded-full bg-gray-100 text-gray-500 hover:text-red-600 flex items-center justify-center"
              >
                <Trash2 className="w-3.5 h-3.5" />
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
                <span className="block text-[10px] uppercase tracking-wider text-gray-500 mb-0.5">{f.label}</span>
                <input
                  type="number"
                  step="0.1"
                  min={0.1}
                  value={r[f.key]}
                  onChange={(e) => patch(idx, { [f.key]: parseFloat(e.target.value) || 0 })}
                  className="w-full h-9 rounded-md border border-gray-200 px-2 text-sm text-gray-900 outline-none focus:border-sber-green focus:border-[1.5px] tabular-nums"
                />
              </label>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {(["ceiling", "wall", "floor"] as const).map((s) => {
              const on = (r.affected_surfaces ?? []).includes(s);
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleSurface(idx, s)}
                  className={`px-2.5 py-1 rounded-full border text-[12px] font-medium transition-colors ${
                    on
                      ? "bg-sber-green text-white border-sber-green"
                      : "bg-white text-gray-700 border-gray-200 hover:border-sber-green/50"
                  }`}
                >
                  {surfaceLabels[s]}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={addRoom}
        className="text-xs text-[#21A038] font-medium inline-flex items-center gap-1"
      >
        <Plus className="w-3.5 h-3.5" /> Добавить комнату
      </button>
      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="px-3 py-1.5 rounded-full text-xs font-medium text-gray-500 hover:bg-gray-100"
        >
          Отменить
        </button>
        <button
          type="button"
          onClick={() => {
            onSave(draft);
            setEditing(false);
          }}
          className="px-3 py-1.5 rounded-full text-xs font-medium bg-sber-green text-white"
        >
          Сохранить
        </button>
      </div>
    </div>
  );
}

// =============== Payout editor ===============

function PayoutEditor({
  payout,
  phoneDigits,
  onSave,
}: {
  payout: PayoutDetails | undefined;
  phoneDigits: string | undefined;
  onSave: (next: PayoutDetails | undefined) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [method, setMethod] = useState<"sbp" | "card">(payout?.method ?? "sbp");
  const [sbpPhoneChoice, setSbpPhoneChoice] = useState<"current" | "other">(
    payout?.sbp_phone && payout.sbp_phone !== phoneDigits ? "other" : "current"
  );
  const [otherPhone, setOtherPhone] = useState(
    payout?.sbp_phone && payout.sbp_phone !== phoneDigits ? payout.sbp_phone : ""
  );
  const [cardNumber, setCardNumber] = useState("");

  function startEdit() {
    setMethod(payout?.method ?? "sbp");
    setSbpPhoneChoice(payout?.sbp_phone && payout.sbp_phone !== phoneDigits ? "other" : "current");
    setOtherPhone(payout?.sbp_phone && payout.sbp_phone !== phoneDigits ? payout.sbp_phone : "");
    setCardNumber("");
    setEditing(true);
  }

  function commit() {
    if (method === "sbp") {
      const phone =
        sbpPhoneChoice === "other"
          ? otherPhone.replace(/\D/g, "").slice(-10)
          : phoneDigits;
      onSave({ method: "sbp", sbp_phone: phone });
    } else {
      const digits = cardNumber.replace(/\D/g, "");
      if (digits.length < 13) return;
      onSave({ method: "card", card_last4: digits.slice(-4) });
    }
    setEditing(false);
  }

  if (!editing) {
    if (!payout?.method) {
      return (
        <button
          type="button"
          onClick={startEdit}
          className="w-full text-sm text-[#21A038] font-medium py-3 border border-dashed border-gray-200 rounded-lg hover:bg-gray-50"
        >
          + Указать способ выплаты
        </button>
      );
    }
    return (
      <button
        type="button"
        onClick={startEdit}
        className="w-full text-left rounded-md hover:bg-gray-50 -mx-2 px-2 py-1.5 flex items-center justify-between gap-3"
      >
        <span className="text-sm text-gray-900">
          {payout.method === "sbp"
            ? `СБП${payout.sbp_phone ? ` · +7 ${formatPhoneDisplay(payout.sbp_phone)}` : ""}`
            : `Карта · •••• ${payout.card_last4 ?? ""}`}
        </span>
        <Pencil className="w-3.5 h-3.5 text-gray-400" />
      </button>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {(["sbp", "card"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMethod(m)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
              method === m
                ? "bg-sber-green text-white border-sber-green"
                : "bg-white text-gray-700 border-gray-200 hover:border-sber-green/50"
            }`}
          >
            {m === "sbp" ? "СБП" : "Карта"}
          </button>
        ))}
      </div>
      {method === "sbp" && (
        <div className="space-y-2">
          <div className="flex gap-2">
            {(
              [
                { v: "current" as const, l: "На указанный ранее" },
                { v: "other" as const, l: "Другой номер" },
              ] as const
            ).map((opt) => (
              <button
                key={opt.v}
                type="button"
                onClick={() => setSbpPhoneChoice(opt.v)}
                className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-colors ${
                  sbpPhoneChoice === opt.v
                    ? "bg-sber-green-light text-sber-green-dark border-sber-green/30"
                    : "bg-white text-gray-700 border-gray-200"
                }`}
              >
                {opt.l}
              </button>
            ))}
          </div>
          {sbpPhoneChoice === "other" && (
            <input
              value={otherPhone}
              onChange={(e) => setOtherPhone(e.target.value)}
              placeholder="+7 (999) 123-45-67"
              className="w-full h-9 rounded-md border border-gray-200 px-3 text-sm focus:border-sber-green focus:border-[1.5px] outline-none"
            />
          )}
        </div>
      )}
      {method === "card" && (
        <input
          value={cardNumber}
          onChange={(e) => setCardNumber(e.target.value)}
          placeholder="0000 0000 0000 0000"
          inputMode="numeric"
          className="w-full h-9 rounded-md border border-gray-200 px-3 text-sm focus:border-sber-green focus:border-[1.5px] outline-none tabular-nums"
        />
      )}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="px-3 py-1.5 rounded-full text-xs font-medium text-gray-500 hover:bg-gray-100"
        >
          Отменить
        </button>
        <button
          type="button"
          onClick={commit}
          className="px-3 py-1.5 rounded-full text-xs font-medium bg-sber-green text-white"
        >
          Сохранить
        </button>
      </div>
    </div>
  );
}

// =============== Photos grouped by room/scene ===============

interface PhotoEntry {
  base64: string;
  sceneId?: string;
  origIdx: number;
}

function PhotosSection({
  photos,
  rooms,
  onAdd,
  onRemove,
}: {
  photos: NonNullable<DraftState["photos"]>;
  rooms: RoomDimensions[];
  onAdd: () => void;
  onRemove: (idx: number) => void;
}) {
  const groups = groupPhotos(photos, rooms);
  return (
    <div className="bg-white rounded-3xl p-5 sm:p-6 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700">Фотографии ({photos.length})</h2>
        <button
          onClick={onAdd}
          className="text-xs text-[#21A038] font-medium"
        >
          + Добавить
        </button>
      </div>
      {photos.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-4 border border-dashed rounded-lg">
          Нет фотографий. Добавьте хотя бы одну.
        </p>
      ) : (
        <div className="space-y-3">
          {groups.map((g) => (
            <div key={g.key} className="space-y-1.5">
              <p className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold">
                {g.title} · {g.entries.length}
              </p>
              <div className="grid grid-cols-3 gap-2">
                {g.entries.map((p) => (
                  <div key={p.origIdx} className="relative aspect-square">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`data:image/jpeg;base64,${p.base64}`}
                      alt={`Фото ${p.origIdx + 1}`}
                      className="w-full h-full object-cover rounded-lg"
                    />
                    <button
                      onClick={() => onRemove(p.origIdx)}
                      className="absolute -top-1.5 -right-1.5 bg-red-500 rounded-full w-5 h-5 flex items-center justify-center"
                      aria-label="Удалить фото"
                    >
                      <X className="w-3 h-3 text-white" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const KIND_LABEL: Record<string, string> = {
  wide: "общий план",
  close_scale: "крупный план",
  source: "источник",
};

function groupPhotos(
  photos: NonNullable<DraftState["photos"]>,
  rooms: RoomDimensions[]
): Array<{ key: string; title: string; entries: PhotoEntry[] }> {
  const roomById = new Map(rooms.map((r) => [r.id, r.name]));
  const buckets = new Map<string, { title: string; entries: PhotoEntry[] }>();

  for (let i = 0; i < photos.length; i++) {
    const p = photos[i];
    const sceneId = p.sceneId ?? "";
    const entry: PhotoEntry = { base64: p.base64, sceneId, origIdx: i };

    let key: string;
    let title: string;
    if (sceneId === "act_document") {
      key = "act_document";
      title = "Акт от УК";
    } else if (sceneId === "extras") {
      key = "extras";
      title = "Дополнительные";
    } else if (sceneId.includes("::")) {
      const [roomId, kind] = sceneId.split("::");
      const roomName = roomById.get(roomId) ?? roomId;
      key = `room::${roomId}`;
      title = `${roomName} — ${KIND_LABEL[kind] ?? kind}`;
    } else if (sceneId) {
      // Legacy single-room scenes (kind is "wide" / "close_scale" / "source").
      key = `legacy::${sceneId}`;
      title = KIND_LABEL[sceneId] ?? sceneId;
    } else {
      key = "untagged";
      title = "Без категории";
    }

    const bucket = buckets.get(key) ?? { title, entries: [] };
    bucket.entries.push(entry);
    buckets.set(key, bucket);
  }

  // Order: rooms (in order) → act → extras → legacy → untagged
  const order: string[] = [];
  for (const r of rooms) order.push(`room::${r.id}`);
  order.push("act_document", "extras");
  for (const k of buckets.keys()) {
    if (!order.includes(k)) order.push(k);
  }

  return order
    .filter((k) => buckets.has(k))
    .map((k) => ({ key: k, title: buckets.get(k)!.title, entries: buckets.get(k)!.entries }));
}
