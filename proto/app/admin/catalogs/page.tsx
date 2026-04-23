"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { WorkCatalogEntry, MaterialCatalogEntry, CatalogAuditEntry } from "@/types";
import { BarChart3, Settings, Book, History, Download, Upload, RotateCcw, FileSpreadsheet } from "lucide-react";
import worksCatalogDefault from "@/data/works_catalog.json";
import materialsCatalogDefault from "@/data/materials_catalog.json";

type Tab = "works" | "materials";

const MIN_PRICE_RUB = 1;
const MAX_PRICE_RUB = 1_000_000;

function priceError(v: number): string | null {
  if (!Number.isFinite(v)) return "введите число";
  if (v < MIN_PRICE_RUB) return `мин. ${MIN_PRICE_RUB} ₽`;
  if (v > MAX_PRICE_RUB) return `макс. ${MAX_PRICE_RUB.toLocaleString("ru-RU")} ₽`;
  return null;
}

interface XlsxPreview {
  changed: number;
  preview: Array<{ code: string; oldPrice: number; newPrice: number }>;
  newWorks?: WorkCatalogEntry[];
  newMaterials?: MaterialCatalogEntry[];
}

export default function CatalogsPage() {
  const [tab, setTab] = useState<Tab>("works");
  const [works, setWorks] = useState<WorkCatalogEntry[]>([]);
  const [materials, setMaterials] = useState<MaterialCatalogEntry[]>([]);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [xlsxPreview, setXlsxPreview] = useState<XlsxPreview | null>(null);
  const [auditEntries, setAuditEntries] = useState<CatalogAuditEntry[]>([]);
  const [auditOpen, setAuditOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const invalidCount = useMemo(() => {
    const rows = tab === "works" ? works : materials;
    return rows.reduce((n, r) => (priceError(r.base_price_rub) ? n + 1 : n), 0);
  }, [tab, works, materials]);

  async function refreshAudit() {
    try {
      const r = await fetch("/api/admin/audit?limit=50");
      const data = await r.json();
      setAuditEntries(data.entries ?? []);
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    fetch("/api/admin/catalogs")
      .then((r) => r.json())
      .then((data) => {
        setWorks((data.works?.works ?? worksCatalogDefault.works) as WorkCatalogEntry[]);
        setMaterials((data.materials?.materials ?? materialsCatalogDefault.materials) as unknown as MaterialCatalogEntry[]);
      })
      .catch(() => {
        setWorks(worksCatalogDefault.works as WorkCatalogEntry[]);
        setMaterials(materialsCatalogDefault.materials as unknown as MaterialCatalogEntry[]);
      });
    refreshAudit();
  }, []);

  async function handleSave() {
    setSaveError(null);
    if (invalidCount > 0) {
      setSaveError(`Есть ${invalidCount} некорректных цен — исправьте перед сохранением`);
      return;
    }
    const type = tab;
    const data = type === "works"
      ? { version: "2026.04.1", works }
      : { version: "2026.04.1", materials };

    const res = await fetch("/api/admin/catalogs", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, data }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      if (body?.error === "validation_failed" && Array.isArray(body.invalid)) {
        setSaveError(`Сервер отклонил ${body.invalid.length} позиций: ${body.invalid.slice(0, 3).map((i: { code: string; reason: string }) => `${i.code} (${i.reason})`).join(", ")}${body.invalid.length > 3 ? "…" : ""}`);
      } else {
        setSaveError("Ошибка сохранения");
      }
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    refreshAudit();
  }

  async function handleReset() {
    if (tab === "works") {
      setWorks(worksCatalogDefault.works as WorkCatalogEntry[]);
    } else {
      setMaterials(materialsCatalogDefault.materials as MaterialCatalogEntry[]);
    }
  }

  async function handleExportXlsx() {
    const { utils, writeFile } = await import("xlsx");
    const rows = tab === "works"
      ? works.map((w) => ({ Код: w.code, Наименование: w.name, "Ед.": w.unit, "Цена, ₽": w.base_price_rub }))
      : materials.map((m) => ({ Код: m.code, Наименование: m.name, "Ед.": m.package_unit, "Цена, ₽": m.base_price_rub }));
    const ws = utils.json_to_sheet(rows);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, tab === "works" ? "Работы" : "Материалы");
    writeFile(wb, `${tab}_catalog.xlsx`);
  }

  async function handleImportXlsx(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const { read, utils } = await import("xlsx");
    const arrayBuffer = await file.arrayBuffer();
    const wb = read(arrayBuffer);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = utils.sheet_to_json<Record<string, unknown>>(ws);

    if (tab === "works") {
      const codeToPrice = new Map(rows.map((r) => [String(r["Код"] ?? ""), Number(r["Цена, ₽"] ?? 0)]));
      const changed: XlsxPreview["preview"] = [];
      const newWorks = works.map((w) => {
        const newPrice = codeToPrice.get(w.code);
        if (newPrice !== undefined && newPrice !== w.base_price_rub) {
          changed.push({ code: w.code, oldPrice: w.base_price_rub, newPrice });
          return { ...w, base_price_rub: newPrice };
        }
        return w;
      });
      setXlsxPreview({ changed: changed.length, preview: changed.slice(0, 5), newWorks });
    } else {
      const codeToPrice = new Map(rows.map((r) => [String(r["Код"] ?? ""), Number(r["Цена, ₽"] ?? 0)]));
      const changed: XlsxPreview["preview"] = [];
      const newMaterials = materials.map((m) => {
        const newPrice = codeToPrice.get(m.code);
        if (newPrice !== undefined && newPrice !== m.base_price_rub) {
          changed.push({ code: m.code, oldPrice: m.base_price_rub, newPrice });
          return { ...m, base_price_rub: newPrice };
        }
        return m;
      });
      setXlsxPreview({ changed: changed.length, preview: changed.slice(0, 5), newMaterials });
    }

    e.target.value = "";
  }

  function confirmImport() {
    if (!xlsxPreview) return;
    if (xlsxPreview.newWorks) setWorks(xlsxPreview.newWorks);
    if (xlsxPreview.newMaterials) setMaterials(xlsxPreview.newMaterials);
    setXlsxPreview(null);
  }

  function updateWorkPrice(code: string, price: number) {
    setWorks((prev) => prev.map((w) => w.code === code ? { ...w, base_price_rub: price } : w));
  }

  function updateMaterialPrice(code: string, price: number) {
    setMaterials((prev) => prev.map((m) => m.code === code ? { ...m, base_price_rub: price } : m));
  }

  const navItems = [
    { href: "/admin", label: "Дашборд", icon: BarChart3 },
    { href: "/admin/calibration", label: "Калибровка", icon: Settings },
    { href: "/admin/catalogs", label: "Справочники", icon: Book, active: true },
    { href: "/admin/history", label: "История", icon: History },
  ];

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-4 py-4">
        <span className="font-semibold text-gray-900">Claim Assistant Admin</span>
      </header>
      <nav className="flex gap-1 px-4 py-2 bg-white border-b overflow-x-auto">
        {navItems.map(({ href, label, icon: Icon, active }) => (
          <Link key={href} href={href} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap ${active ? "bg-[#e8f5ea] text-[#21A038]" : "text-gray-500 hover:text-gray-700"}`}>
            <Icon className="w-4 h-4" />{label}
          </Link>
        ))}
      </nav>

      {/* XLSX Import preview modal */}
      {xlsxPreview && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4">
            <h2 className="font-semibold text-gray-900">Подтвердите импорт</h2>
            <p className="text-sm text-gray-600">
              Будет обновлено <strong>{xlsxPreview.changed}</strong> позиций
            </p>
            {xlsxPreview.preview.length > 0 && (
              <div className="border rounded-lg overflow-hidden text-xs">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-3 py-2 text-gray-500">Код</th>
                      <th className="text-right px-3 py-2 text-gray-500">Было</th>
                      <th className="text-right px-3 py-2 text-gray-500">Станет</th>
                    </tr>
                  </thead>
                  <tbody>
                    {xlsxPreview.preview.map((row) => (
                      <tr key={row.code} className="border-t">
                        <td className="px-3 py-1.5 font-mono text-gray-600">{row.code}</td>
                        <td className="px-3 py-1.5 text-right text-gray-400">{row.oldPrice} ₽</td>
                        <td className="px-3 py-1.5 text-right font-medium text-[#21A038]">{row.newPrice} ₽</td>
                      </tr>
                    ))}
                    {xlsxPreview.changed > 5 && (
                      <tr className="border-t">
                        <td colSpan={3} className="px-3 py-1.5 text-gray-400 text-center">
                          ...и ещё {xlsxPreview.changed - 5} позиций
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setXlsxPreview(null)}>
                Отмена
              </Button>
              <Button className="flex-1" onClick={confirmImport}>
                Применить
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="px-4 py-6 max-w-4xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">Справочники</h1>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={handleExportXlsx} className="gap-1.5">
              <FileSpreadsheet className="w-4 h-4" /> XLSX
            </Button>
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="gap-1.5">
              <Upload className="w-4 h-4" /> Импорт
            </Button>
            <input ref={fileInputRef} type="file" accept=".xlsx" className="hidden" onChange={handleImportXlsx} />
            <Button variant="outline" size="sm" onClick={handleReset} className="gap-1.5">
              <Download className="w-4 h-4" /> JSON
            </Button>
            <Button variant="outline" size="sm" onClick={handleReset} className="gap-1.5">
              <RotateCcw className="w-4 h-4" /> Сброс
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          {(["works", "materials"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                tab === t ? "bg-[#21A038] text-white" : "bg-white border text-gray-600 hover:border-gray-400"
              }`}
            >
              {t === "works" ? "Работы" : "Материалы"}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="text-left px-4 py-3 text-gray-500 font-medium w-24">Код</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Наименование</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium w-16">Ед.</th>
                  <th className="text-right px-4 py-3 text-gray-500 font-medium w-32">Цена, ₽</th>
                </tr>
              </thead>
              <tbody>
                {tab === "works" && works.map((w) => {
                  const err = priceError(w.base_price_rub);
                  return (
                    <tr key={w.code} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="px-4 py-2 text-xs text-gray-400 font-mono">{w.code}</td>
                      <td className="px-4 py-2 text-gray-700">{w.name}</td>
                      <td className="px-4 py-2 text-gray-500 text-xs">{w.unit}</td>
                      <td className="px-4 py-2">
                        <Input
                          type="number"
                          value={w.base_price_rub}
                          onChange={(e) => updateWorkPrice(w.code, parseFloat(e.target.value))}
                          className={`h-8 text-right w-full ${err ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                          min={MIN_PRICE_RUB}
                          max={MAX_PRICE_RUB}
                        />
                        {err && <div className="text-[10px] text-red-600 mt-0.5 text-right">{err}</div>}
                      </td>
                    </tr>
                  );
                })}
                {tab === "materials" && materials.map((m) => {
                  const err = priceError(m.base_price_rub);
                  return (
                    <tr key={m.code} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="px-4 py-2 text-xs text-gray-400 font-mono">{m.code}</td>
                      <td className="px-4 py-2 text-gray-700">{m.name}</td>
                      <td className="px-4 py-2 text-gray-500 text-xs">{m.package_unit}</td>
                      <td className="px-4 py-2">
                        <Input
                          type="number"
                          value={m.base_price_rub}
                          onChange={(e) => updateMaterialPrice(m.code, parseFloat(e.target.value))}
                          className={`h-8 text-right w-full ${err ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                          min={MIN_PRICE_RUB}
                          max={MAX_PRICE_RUB}
                        />
                        {err && <div className="text-[10px] text-red-600 mt-0.5 text-right">{err}</div>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {saveError && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
            {saveError}
          </div>
        )}

        <div className="flex gap-2">
          <Button onClick={handleSave} className="flex-1" disabled={invalidCount > 0}>
            {saved ? "Сохранено ✓" : invalidCount > 0 ? `Исправьте ${invalidCount} ошибок` : "Сохранить изменения"}
          </Button>
          <Button variant="outline" onClick={() => { setAuditOpen(true); refreshAudit(); }} className="gap-1.5">
            <History className="w-4 h-4" /> Журнал
          </Button>
        </div>
      </div>

      {auditOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setAuditOpen(false)}>
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Журнал изменений каталога</h2>
              <button onClick={() => setAuditOpen(false)} className="text-gray-400 hover:text-gray-700 text-xl leading-none">×</button>
            </div>
            <div className="overflow-y-auto px-6 py-4 space-y-4">
              {auditEntries.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-8">Пока нет записей</p>
              )}
              {auditEntries.map((entry, idx) => (
                <div key={idx} className="border rounded-lg p-3 text-sm">
                  <div className="flex justify-between items-start mb-2 text-xs">
                    <span className="font-medium text-gray-700">
                      {new Date(entry.ts).toLocaleString("ru-RU")} · {entry.type === "works" ? "Работы" : "Материалы"}
                    </span>
                    <span className="text-gray-400 font-mono text-[10px]">{entry.actor}</span>
                  </div>
                  {entry.changes.length > 0 && (
                    <div className="space-y-0.5 text-xs">
                      {entry.changes.slice(0, 10).map((c, i) => (
                        <div key={i} className="flex gap-2">
                          <span className="font-mono text-gray-500 w-20 flex-shrink-0">{c.code}</span>
                          <span className="text-gray-400 line-through">{c.old} ₽</span>
                          <span className="text-gray-400">→</span>
                          <span className="text-[#21A038] font-medium">{c.new} ₽</span>
                        </div>
                      ))}
                      {entry.changes.length > 10 && (
                        <div className="text-gray-400 text-[10px]">…и ещё {entry.changes.length - 10}</div>
                      )}
                    </div>
                  )}
                  {entry.added.length > 0 && (
                    <div className="text-[10px] text-blue-600 mt-1">Добавлено: {entry.added.join(", ")}</div>
                  )}
                  {entry.removed.length > 0 && (
                    <div className="text-[10px] text-red-600 mt-1">Удалено: {entry.removed.join(", ")}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
