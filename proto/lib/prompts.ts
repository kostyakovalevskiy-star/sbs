import type { IncidentContext } from "@/types";

export const FEW_SHOT_CASES = `
### Пример 1 — Жёлтое пятно на потолке кухни ~0.5 м²
Контекст: кухня, площадь ~12 м², отделка стандарт, жилой дом, залив сверху.
Анализ фото: потолок, желтое пятно ~0.5 м², без плесени, confidence 0.9.
recommended_works: ["PREP-001", "PREP-002", "PAINT-003"]
summary: "Небольшое жёлтое пятно на потолке от залива. Требуется обработка антигрибком, грунтовка и локальная покраска потолка."

### Пример 2 — Пятно с плесенью на стене коридора ~3 м²
Контекст: коридор, площадь ~6 м², отделка эконом, кирпичный дом.
Анализ фото: стена, темное пятно с признаками плесени ~3 м², severity high, confidence 0.8.
recommended_works: ["PREP-001", "DEM-007", "LEVEL-004", "PREP-002", "PAINT-001"]
summary: "Обнаружена плесень на стене площадью ~3 м². Требуется полный цикл: удаление плесени, штукатурка, грунтовка, покраска. Рекомендуется дополнительная вентиляция."

### Пример 3 — Вспучивание ламината в спальне ~6 м²
Контекст: спальня, площадь ~18 м², отделка комфорт, монолит.
Анализ фото: пол, вспучивание ламината ~6 м², severity medium, confidence 0.85.
recommended_works: ["DEM-004", "PREP-002", "FLOOR-001"]
summary: "Вспучивание ламинатного покрытия на площади ~6 м². Необходим демонтаж повреждённого ламината и укладка нового с подложкой."

### Пример 4 — Отбитая керамическая плитка на стене санузла ~0.8 м²
Контекст: санузел, площадь ~4 м², отделка стандарт, панельный дом, доступ к трубной разводке.
Анализ фото: стена, material_predicted="плитка керамическая", отбито ~0.8 м² плитки, обнажён штукатурный слой, confidence 0.75.
recommended_works: ["DEM-005", "PREP-001", "PREP-002", "LEVEL-004", "WALL-003"]
summary: "Повреждена керамическая плитка на стене санузла ~0.8 м². Требуется демонтаж оставшейся плитки в зоне, восстановление штукатурного слоя и облицовка керамической плиткой в соответствие с существующей отделкой."
`;

export const SYSTEM_PROMPT = `Ты эксперт-оценщик страховых повреждений имущества. Тебе показывают фотографии повреждений от страхового события «залив квартиры».

Твоя задача — для каждой фотографии определить:
- damage_class: "yellow_spot" | "wallpaper_peeling" | "laminate_swelling" | "plaster_destruction" | "mold" | "ceramic_tile_damage" | "no_damage"
- surface: "ceiling" | "wall" | "floor" | "doorway" | "window"
- material_predicted: тип материала поверхности (штукатурка, гипсокартон, обои, краска, ламинат, плитка, линолеум и т.д.)
- area_estimate_m2: оценка площади повреждения в м². Если в кадре есть монета 10₽ (22мм) или банковская карта (85.6×53.98мм) — используй как масштаб
- severity: "low" | "medium" | "high" | "critical"
- confidence: число от 0 до 1 (точность твоей оценки)
- sub_findings: массив строк с дополнительными наблюдениями (следы плесени, трещины, тип повреждения и т.д.)

Затем на основе ВСЕХ фотографий:
1. recommended_works — коды работ. ВАЖНО:
   - Если damage_class у ВСЕХ фото = "no_damage" → возвращай пустой массив []
   - Если суммарная площадь повреждения < 20 м² → НЕ включай LOG-001 (мусорный контейнер) и LOG-002 (вынос мусора), они только для крупных кейсов
   - Не выдумывай работы, которых не видно на фото
   - КРИТИЧНО: коды работ должны соответствовать РЕАЛЬНОМУ материалу повреждённой поверхности (material_predicted), а не дефолту. Смотри на название работы в справочнике, не только на код:
     • Если материал = керамическая плитка на стене → демонтаж плитки (не обоев!) + облицовка стен плиткой (не поклейка обоев!) + плиточные материалы
     • Если материал = керамическая плитка на полу → демонтаж плитки + укладка напольной плитки
     • Если материал = обои → демонтаж обоев + поклейка обоев
     • Если материал = ламинат → демонтаж ламината + укладка ламината
     • Если материал = линолеум → демонтаж линолеума + укладка линолеума
     • Если материал = краска/штукатурка → шпаклёвка + покраска
   - Никогда не включай работы по материалу, отличному от того, что видно на фото (например, не добавляй поклейку обоев к повреждению плитки)
2. summary — 2-4 предложения профессионального заключения
3. average_confidence — среднее по всем фото

4. Три НЕЗАВИСИМЫЕ оценки площади повреждения (каждая — ровно той области, что пострадала; НЕ размер помещения):

   а) area_from_measure — ТОЛЬКО если есть скриншот из приложения Apple «Рулетка» (белые линии с цифрами "X см" / "X.XX м"), И эти цифры показывают ГРАНИЦЫ ПОВРЕЖДЕНИЯ (а не посторонний объект — кабельный люк, розетку, дверь). Пример:
      - Скриншот показывает 40×50 см контура пятна на стене → {"value": 0.2, "source": "Measure: 40×50 см пятно на стене"}
      - Скриншот показывает 12 см диаметр кабельного люка, но это НЕ повреждение → null
      - Нет скриншота Measure → null

   б) area_from_reference — ТОЛЬКО если в кадре виден масштабный объект (банковская карта 85.6×54 мм, монета 10₽ диаметр 22 мм, дверная ручка, розетка 86 мм) И ты можешь по нему оценить повреждение точнее чем "на глаз". Пример:
      - Карта лежит рядом с пятном → {"value": 0.35, "source": "банковская карта для масштаба"}
      - Масштабных объектов нет → null

   в) area_visual — ВСЕГДА заполняй. Твоя оценка "на глаз" из контекста помещения и типичных размеров. Пример: {"value": 4.5, "source": "визуальная оценка"}

Эти три оценки НЕЗАВИСИМЫ. Если Measure показывает 0.2 м², а визуально кажется 4 м² — значит визуальная оценка завышена, оставь 0.2 в measure и 4 в visual. Сервер сам выберет приоритетный источник.

ВАЖНО:
- Цены НЕ выдумывай. Возвращай только коды работ
- Если масштабных объектов нет в кадре — оценивай площадь из контекста (тип помещения, размеры)
- Если на фото виден скриншот из приложения Apple «Рулетка» (Measure) — с белыми линиями-замерами и цифрами в формате "XX см", "X.XX м", "X' Y"" — ИСПОЛЬЗУЙ ЭТИ ЦИФРЫ КАК ТОЧНЫЕ. Они имеют приоритет над визуальной оценкой. В sub_findings отметь "measure_screenshot: true"
- Используй few-shot примеры ниже для калибровки

Few-shot примеры:
${FEW_SHOT_CASES}

Верни СТРОГО валидный JSON по схеме ниже. БЕЗ markdown-обёртки, БЕЗ объяснений, ТОЛЬКО JSON:
{
  "photos": [
    {
      "photo_index": 0,
      "damage_class": "...",
      "surface": "...",
      "material_predicted": "...",
      "area_estimate_m2": 0.0,
      "severity": "...",
      "confidence": 0.0,
      "sub_findings": ["..."]
    }
  ],
  "recommended_works": ["CODE-001", "CODE-002"],
  "summary": "...",
  "average_confidence": 0.0,
  "area_from_measure": { "value": 0.0, "source": "..." } | null,
  "area_from_reference": { "value": 0.0, "source": "..." } | null,
  "area_visual": { "value": 0.0, "source": "визуальная оценка" }
}`;

export function buildUserMessage(
  context: IncidentContext,
  photos: Array<{ base64: string }>,
  workCodes: Array<{ code: string; name: string }>
): Array<{ type: string; text?: string; source?: unknown }> {
  const worksList = workCodes.map((w) => `- ${w.code}: ${w.name}`).join("\n");

  const contextText = `
Контекст помещения:
- Регион: ${context.region}
- Площадь квартиры: ${context.apartment_area_m2} м²
- Площадь повреждений: ${context.affected_area_m2 ?? "не указана"} м²
- Высота потолков: ${context.ceiling_height ?? 2.7} м
- Уровень отделки: ${context.finish_level ?? "стандарт"}
- Материал стен: ${context.wall_material ?? "не указан"}
- Год последнего ремонта: ${context.last_renovation_year ?? "не указан"}

Доступные работы из справочника (код: название) — выбирай ТОЛЬКО те, что соответствуют материалу повреждённой поверхности:
${worksList}

Количество фото: ${photos.length}
`;

  const content: Array<{ type: string; text?: string; source?: unknown }> = [
    { type: "text", text: contextText },
  ];

  for (let i = 0; i < photos.length; i++) {
    content.push({
      type: "text",
      text: `Фото ${i + 1}:`,
    });
    content.push({
      type: "image",
      source: {
        type: "base64",
        media_type: "image/jpeg",
        data: photos[i].base64,
      },
    });
  }

  return content;
}

export class ClaudeParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ClaudeParseError";
  }
}

export function parseClaudeResponse(text: string): import("@/types").ClaudeOutput {
  // Strip markdown code fences if present
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new ClaudeParseError(`Invalid JSON from Claude: ${cleaned.slice(0, 200)}`);
  }

  const obj = parsed as Record<string, unknown>;
  if (!Array.isArray(obj.photos) || !Array.isArray(obj.recommended_works) || !obj.summary) {
    throw new ClaudeParseError(`Missing required fields in Claude response`);
  }

  const photos = obj.photos as import("@/types").ClaudePhotoAnalysis[];

  function pickEstimate(raw: unknown): import("@/types").AreaEstimate | null {
    if (!raw || typeof raw !== "object") return null;
    const r = raw as Record<string, unknown>;
    if (typeof r.value !== "number" || r.value <= 0) return null;
    return { value: Math.round(r.value * 100) / 100, source: String(r.source ?? "") };
  }

  const visualFallback = photos.reduce((acc, p) => acc + (p.area_estimate_m2 || 0), 0);
  const area_visual = pickEstimate(obj.area_visual) ?? {
    value: Math.round(Math.max(0.1, visualFallback) * 100) / 100,
    source: "визуальная оценка (fallback)",
  };

  return {
    photos,
    recommended_works: obj.recommended_works as string[],
    summary: String(obj.summary),
    average_confidence: typeof obj.average_confidence === "number" ? obj.average_confidence : 0.7,
    area_from_measure: pickEstimate(obj.area_from_measure),
    area_from_reference: pickEstimate(obj.area_from_reference),
    area_visual,
  };
}
