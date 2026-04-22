"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { WorkCatalogEntry, MaterialCatalogEntry } from "@/types";
import { BarChart3, Settings, Book, History, Download, Upload, RotateCcw, FileSpreadsheet } from "lucide-react";
import worksCatalogDefault from "@/data/works_catalog.json";
import materialsCatalogDefault from "@/data/materials_catalog.json";

type Tab = "works" | "materials";

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
  const [xlsxPreview, setXlsxPreview] = useState<XlsxPreview | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
  }, []);

  async function handleSave() {
    const type = tab;
    const data = type === "works"
      ? { version: "2026.04.1", works }
      : { version: "2026.04.1", materials };

    await fetch("/api/admin/catalogs", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, data }),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
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
                {tab === "works" && works.map((w) => (
                  <tr key={w.code} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-2 text-xs text-gray-400 font-mono">{w.code}</td>
                    <td className="px-4 py-2 text-gray-700">{w.name}</td>
                    <td className="px-4 py-2 text-gray-500 text-xs">{w.unit}</td>
                    <td className="px-4 py-2">
                      <Input
                        type="number"
                        value={w.base_price_rub}
                        onChange={(e) => updateWorkPrice(w.code, parseFloat(e.target.value))}
                        className="h-8 text-right w-full"
                        min={0}
                      />
                    </td>
                  </tr>
                ))}
                {tab === "materials" && materials.map((m) => (
                  <tr key={m.code} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-2 text-xs text-gray-400 font-mono">{m.code}</td>
                    <td className="px-4 py-2 text-gray-700">{m.name}</td>
                    <td className="px-4 py-2 text-gray-500 text-xs">{m.package_unit}</td>
                    <td className="px-4 py-2">
                      <Input
                        type="number"
                        value={m.base_price_rub}
                        onChange={(e) => updateMaterialPrice(m.code, parseFloat(e.target.value))}
                        className="h-8 text-right w-full"
                        min={0}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <Button onClick={handleSave} className="w-full">
          {saved ? "Сохранено ✓" : "Сохранить изменения"}
        </Button>
      </div>
    </main>
  );
}
