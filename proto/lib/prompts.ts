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
`;

export const SYSTEM_PROMPT = `Ты эксперт-оценщик страховых повреждений имущества. Тебе показывают фотографии повреждений от страхового события «залив квартиры».

Твоя задача — для каждой фотографии определить:
- damage_class: "yellow_spot" | "wallpaper_peeling" | "laminate_swelling" | "plaster_destruction" | "mold" | "no_damage"
- surface: "ceiling" | "wall" | "floor" | "doorway" | "window"
- material_predicted: тип материала поверхности (штукатурка, гипсокартон, обои, краска, ламинат, плитка, линолеум и т.д.)
- area_estimate_m2: оценка площади повреждения в м². Если в кадре есть монета 10₽ (22мм) или банковская карта (85.6×53.98мм) — используй как масштаб
- severity: "low" | "medium" | "high" | "critical"
- confidence: число от 0 до 1 (точность твоей оценки)
- sub_findings: массив строк с дополнительными наблюдениями (следы плесени, трещины, тип повреждения и т.д.)

Затем на основе ВСЕХ фотографий:
1. Сформируй список recommended_works — коды работ из предоставленного справочника (только те коды, которые реально нужны)
2. Напиши summary — краткое профессиональное заключение об ущербе (2-4 предложения на русском)
3. Вычисли average_confidence — среднее по всем фото

ВАЖНО:
- Цены НЕ выдумывай. Возвращай только коды работ
- Если масштабных объектов нет в кадре — оценивай площадь из контекста (тип помещения, размеры)
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
  "average_confidence": 0.0
}`;

export function buildUserMessage(
  context: IncidentContext,
  photos: Array<{ base64: string }>,
  workCodes: string[]
): Array<{ type: string; text?: string; source?: unknown }> {
  const contextText = `
Контекст помещения:
- Регион: ${context.region}
- Площадь квартиры: ${context.apartment_area_m2} м²
- Площадь повреждений: ${context.affected_area_m2 ?? "не указана"} м²
- Высота потолков: ${context.ceiling_height ?? 2.7} м
- Уровень отделки: ${context.finish_level ?? "стандарт"}
- Материал стен: ${context.wall_material ?? "не указан"}
- Год последнего ремонта: ${context.last_renovation_year ?? "не указан"}

Доступные коды работ из справочника:
${workCodes.join(", ")}

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

  return {
    photos: obj.photos as import("@/types").ClaudePhotoAnalysis[],
    recommended_works: obj.recommended_works as string[],
    summary: String(obj.summary),
    average_confidence: typeof obj.average_confidence === "number" ? obj.average_confidence : 0.7,
  };
}
