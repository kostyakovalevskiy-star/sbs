"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { formatRub } from "@/lib/utils";
import type { CalibrationValues } from "@/types";
import calibrationDefaults from "@/data/calibration_defaults.json";
import { Save, RotateCcw, Download } from "lucide-react";

function extractDefaults(): CalibrationValues {
  const w = calibrationDefaults.weights;
  return {
    range_sigma: w.range_sigma.default as number,
    finish_econom_factor: w.finish_econom_factor.default as number,
    finish_standard_factor: w.finish_standard_factor.default as number,
    finish_comfort_factor: w.finish_comfort_factor.default as number,
    finish_premium_factor: w.finish_premium_factor.default as number,
    vision_low_confidence_discount: w.vision_low_confidence_discount.default as number,
    stp_threshold_rub: w.stp_threshold_rub.default as number,
    critical_crack_mm: w.critical_crack_mm.default as number,
    mold_area_threshold_m2: w.mold_area_threshold_m2.default as number,
    wear_apply: w.wear_apply.default as boolean,
    default_ceiling_height_m: w.default_ceiling_height_m.default as number,
  };
}

export default function CalibrationPage() {
  const [values, setValues] = useState<CalibrationValues>(extractDefaults());
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/admin/calibration")
      .then((r) => r.json())
      .then((data) => setValues(data))
      .catch(() => {});
  }, []);

  function update<K extends keyof CalibrationValues>(key: K, val: CalibrationValues[K]) {
    setValues((v) => ({ ...v, [key]: val }));
    setSaved(false);
  }

  async function handleSave() {
    setLoading(true);
    try {
      await fetch("/api/admin/calibration", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setValues(extractDefaults());
    setSaved(false);
  }

  function handleExport() {
    const blob = new Blob([JSON.stringify(values, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "calibration.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  const sliderField = (
    label: string,
    key: keyof CalibrationValues,
    min: number,
    max: number,
    step: number,
    format?: (v: number) => string
  ) => {
    const val = values[key] as number;
    return (
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <Label className="text-sm">{label}</Label>
          <span className="text-sm font-medium text-gray-900">
            {format ? format(val) : val}
          </span>
        </div>
        <Slider
          min={min}
          max={max}
          step={step}
          value={[val]}
          onValueChange={([v]) => update(key, v as CalibrationValues[typeof key])}
        />
        <div className="flex justify-between text-xs text-gray-400">
          <span>{format ? format(min) : min}</span>
          <span>{format ? format(max) : max}</span>
        </div>
      </div>
    );
  };

  return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-5">
        <div className="flex items-center justify-between px-1">
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-gray-900">Калибровка</h1>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleExport} className="gap-1.5 rounded-xl">
              <Download className="w-4 h-4" /> JSON
            </Button>
            <Button variant="outline" size="sm" onClick={handleReset} className="gap-1.5 rounded-xl">
              <RotateCcw className="w-4 h-4" /> Сброс
            </Button>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-5 sm:p-6 space-y-6">
          <h2 className="font-display text-lg font-bold text-gray-900">Диапазон оценки</h2>
          {sliderField("Ширина диапазона (σ)", "range_sigma", 0.05, 0.35, 0.01, (v) => `±${Math.round(v * 100)}%`)}
        </div>

        <div className="bg-white rounded-3xl p-5 sm:p-6 space-y-6">
          <h2 className="font-display text-lg font-bold text-gray-900">Множители уровней отделки</h2>
          {sliderField("Эконом", "finish_econom_factor", 0.5, 1.0, 0.05, (v) => `×${v.toFixed(2)}`)}
          {sliderField("Стандарт", "finish_standard_factor", 0.8, 1.4, 0.05, (v) => `×${v.toFixed(2)}`)}
          {sliderField("Комфорт", "finish_comfort_factor", 1.0, 2.5, 0.05, (v) => `×${v.toFixed(2)}`)}
          {sliderField("Премиум", "finish_premium_factor", 1.2, 4.0, 0.1, (v) => `×${v.toFixed(2)}`)}
        </div>

        <div className="bg-white rounded-3xl p-5 sm:p-6 space-y-6">
          <h2 className="font-display text-lg font-bold text-gray-900">AI и пороги</h2>
          {sliderField("Скидка при низком confidence (&lt;0.6)", "vision_low_confidence_discount", 0.5, 1.0, 0.05, (v) => `×${v.toFixed(2)}`)}
          <div className="space-y-2">
            <div className="flex justify-between">
              <Label>Порог STP (авторасчёт), ₽</Label>
              <span className="text-sm font-medium">{formatRub(values.stp_threshold_rub)}</span>
            </div>
            <Slider
              min={50000}
              max={1500000}
              step={50000}
              value={[values.stp_threshold_rub]}
              onValueChange={([v]) => update("stp_threshold_rub", v)}
            />
          </div>
          {sliderField("Порог трещины, мм", "critical_crack_mm", 1, 10, 1)}
          {sliderField("Порог плесени для эксперта, м²", "mold_area_threshold_m2", 0.5, 10, 0.5)}
        </div>

        <div className="bg-white rounded-3xl p-5 sm:p-6 space-y-4">
          <h2 className="font-display text-lg font-bold text-gray-900">Прочее</h2>
          <div className="flex items-center justify-between">
            <Label>Применять физический износ</Label>
            <Switch
              checked={values.wear_apply}
              onCheckedChange={(v) => update("wear_apply", v)}
            />
          </div>
          <div className="space-y-2">
            <Label>Высота потолков по умолчанию, м</Label>
            <Input
              type="number"
              step={0.1}
              min={2.2}
              max={4.5}
              value={values.default_ceiling_height_m}
              onChange={(e) => update("default_ceiling_height_m", parseFloat(e.target.value))}
              className="w-32"
            />
          </div>
        </div>

        <Button onClick={handleSave} disabled={loading} className="w-full gap-2 rounded-2xl">
          <Save className="w-4 h-4" />
          {saved ? "Сохранено ✓" : loading ? "Сохраняем…" : "Сохранить и применить"}
        </Button>
      </div>
  );
}
