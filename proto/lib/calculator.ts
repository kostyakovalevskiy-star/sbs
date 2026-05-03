import type {
  ClaudeOutput,
  IncidentContext,
  CalibrationValues,
  WorkCatalogEntry,
  MaterialCatalogEntry,
  RegionCoefficients,
  Report,
  WorkItem,
  MaterialItem,
  AreaEstimate,
  WorkSpec,
  Surface,
} from "@/types";

// Authoritative area source, priority-ordered: measure > reference > declared > visual
// Returns the picked value + the full list of candidates for the UI to display.
export interface AreaPick {
  value: number;
  source: string;
  candidates: Array<AreaEstimate & { priority: number; used: boolean }>;
}

export function pickAuthoritativeArea(
  claude: ClaudeOutput,
  declaredAreaM2: number | undefined,
  surfaceAreaM2?: number,
  overridePriority?: number
): AreaPick {
  const candidates: Array<AreaEstimate & { priority: number; used: boolean }> = [];

  // Priority 0 — sum of damaged-surface areas (rooms × selected surfaces).
  // Ranked above measure/reference because the user is repairing the entire
  // surface, not just the visible damaged spot.
  if (surfaceAreaM2 && surfaceAreaM2 > 0) {
    candidates.push({
      value: surfaceAreaM2,
      source: "сумма поверхностей по комнатам",
      priority: 0,
      used: false,
    });
  }
  if (claude.area_from_measure && claude.area_from_measure.value > 0) {
    candidates.push({ ...claude.area_from_measure, priority: 1, used: false });
  }
  if (claude.area_from_reference && claude.area_from_reference.value > 0) {
    candidates.push({ ...claude.area_from_reference, priority: 2, used: false });
  }
  if (declaredAreaM2 && declaredAreaM2 > 0) {
    candidates.push({ value: declaredAreaM2, source: "заявлено клиентом", priority: 3, used: false });
  }
  if (claude.area_visual && claude.area_visual.value > 0) {
    candidates.push({ ...claude.area_visual, priority: 4, used: false });
  }

  // Sort by priority ascending (0 wins)
  candidates.sort((a, b) => a.priority - b.priority);
  if (candidates.length === 0) {
    return { value: 1, source: "нет данных (fallback 1 м²)", candidates: [] };
  }

  const winner =
    (typeof overridePriority === "number"
      ? candidates.find((c) => c.priority === overridePriority)
      : undefined) ?? candidates[0];
  winner.used = true;
  return { value: winner.value, source: winner.source, candidates };
}

// Sum of damaged-surface areas across the rooms array. Floor/ceiling
// contribute length×width; walls contribute 2·(length+width)·height.
export function computeRoomsSurfaceArea(
  rooms: Array<{
    length_m: number;
    width_m: number;
    height_m: number;
    affected_surfaces?: ("ceiling" | "wall" | "floor")[];
  }> | undefined
): number {
  if (!rooms?.length) return 0;
  return rooms.reduce((sum, r) => {
    const surfaces = r.affected_surfaces ?? [];
    const floorCeil = r.length_m * r.width_m;
    const wallArea = 2 * (r.length_m + r.width_m) * r.height_m;
    let area = 0;
    if (surfaces.includes("ceiling")) area += floorCeil;
    if (surfaces.includes("floor")) area += floorCeil;
    if (surfaces.includes("wall")) area += wallArea;
    return sum + area;
  }, 0);
}

interface Catalogs {
  works: WorkCatalogEntry[];
  materials: MaterialCatalogEntry[];
  regions: RegionCoefficients;
}

function getFinishFactor(finishLevel: string | undefined, calibration: CalibrationValues): number {
  switch (finishLevel) {
    case "econom": return calibration.finish_econom_factor;
    case "standard": return calibration.finish_standard_factor;
    case "comfort": return calibration.finish_comfort_factor;
    case "premium": return calibration.finish_premium_factor;
    default: return calibration.finish_standard_factor;
  }
}

type Tier = "econom" | "standard" | "comfort" | "premium";
const TIER_RANK: Record<Tier, number> = { econom: 0, standard: 1, comfort: 2, premium: 3 };

// Heuristic: bucketize a free-form material_predicted (from Claude) into a tier.
// Used so a premium-керамогранит у эконом-клиента не считается по эконом-цене.
function inferTierFromPredicted(p: string | undefined): Tier {
  if (!p) return "standard";
  const s = p.toLowerCase();
  if (/керамогранит|массив|мозаика|паркет.*массив|текстил/.test(s)) return "premium";
  if (/паркет.*доска|винил.*spc|spc/.test(s)) return "comfort";
  if (/бумаж|пвх.*панел|линолеум.*эконом|побелк/.test(s)) return "econom";
  return "standard";
}

function tierFromFinishLevel(finishLevel: string | undefined): Tier {
  if (finishLevel === "econom" || finishLevel === "comfort" || finishLevel === "premium") {
    return finishLevel;
  }
  return "standard";
}

function tierFromMaterialClass(materialClass: string | undefined): Tier | null {
  if (materialClass === "econom" || materialClass === "comfort" || materialClass === "premium" || materialClass === "standard") {
    return materialClass;
  }
  return null;
}

// tier_multiplier применяется к ЦЕНЕ материала. Берём максимум из:
//   1) тир клиента (finish_level),
//   2) тир, выведенный из material_predicted на фото (Claude распознал керамогранит → premium),
//   3) тир самого материала из каталога (finish_class).
// Логика «макс»: если AI увидел премиум-керамогранит, эконом-клиент всё равно
// получит премиум-цену, потому что чинить надо то, что было. Аналогично, если
// клиент premium, а в каталоге standard — берём premium.
function getTierMultiplier(
  finishLevel: string | undefined,
  matEntry: MaterialCatalogEntry,
  workSpec: WorkSpec,
  calibration: CalibrationValues
): number {
  const aiTier = inferTierFromPredicted(workSpec.material_predicted);
  const clientTier = tierFromFinishLevel(finishLevel);
  const materialTier = tierFromMaterialClass(matEntry.finish_class);
  const candidates: Tier[] = [aiTier, clientTier, materialTier ?? "standard"];
  const winner = candidates.reduce<Tier>(
    (acc, t) => (TIER_RANK[t] > TIER_RANK[acc] ? t : acc),
    "econom"
  );
  switch (winner) {
    case "econom": return calibration.tier_econom_multiplier;
    case "standard": return calibration.tier_standard_multiplier;
    case "comfort": return calibration.tier_comfort_multiplier;
    case "premium": return calibration.tier_premium_multiplier;
  }
}

// Compute volume of a work item. `A` = площадь именно этой работы (per-WorkSpec).
// `P` = approx perimeter (для линейных работ).
// `heightFactor` = h / default_h, скейлит только СТЕННЫЕ PREP/LEVEL/PAINT/WALL.
// Потолочные LEVEL-003/005/007 + PAINT-002 не должны умножаться на heightFactor:
// высота потолка не делает потолок больше. Поэтому теперь смотрим на surface.
function computeVolume(
  code: string,
  A: number,
  P: number,
  heightFactor: number,
  surface?: Surface
): number {
  const category = code.split("-")[0];

  switch (category) {
    case "DEM":
      if (code === "DEM-001" || code === "DEM-002") return P;
      if (code === "DEM-003") return Math.max(1, Math.round(P / 6));
      return A;

    case "PREP":
    case "LEVEL":
    case "PAINT":
    case "WALL":
      // Только стены / двери / окна растут с высотой потолка. Потолочные и
      // напольные работы — нет (потолок остаётся той же площади, пол тоже).
      if (surface === "ceiling" || surface === "floor") return A;
      return A * heightFactor;

    case "FLOOR":
    case "CEIL":
      // Floor and ceiling areas are independent of ceiling height.
      return A;

    case "DOOR":
      return Math.max(1, Math.round(P / 6));

    case "TRIM":
      return code === "TRIM-003" ? Math.max(1, Math.round(P / 6)) : P;

    // Штучные работы (unit: "шт."): 1 на кейс.
    // ELEC — розетка, люстра и т.п.
    case "ELEC":
      return 1;

    // PIPE/WATERPROOF/SCREED/SEALANT/WINDOW/PARTITION — площадь по WorkSpec.
    default:
      return A;
  }
}

// Map work codes (from works_catalog.json) to material codes (from materials_catalog.json)
const WORK_TO_MATERIALS: Record<string, string[]> = {
  "PREP-001": ["MAT-ANTI-01", "MAT-PRIMER-01"],
  "PREP-002": ["MAT-PRIMER-01"],
  "PREP-003": ["MAT-PRIMER-01"],
  "LEVEL-001": ["MAT-PLAST-01"],
  "LEVEL-002": ["MAT-PLAST-01"],
  "LEVEL-003": ["MAT-PLAST-01"],
  "LEVEL-004": ["MAT-FILL-01"],
  "LEVEL-005": ["MAT-FILL-01"],
  "PAINT-001": ["MAT-PAINT-01"],
  "PAINT-002": ["MAT-PAINT-01"],
  "WALL-001":  ["MAT-WALL-01"],
  "WALL-002":  ["MAT-WALL-01"],
  "WALL-003":  ["MAT-TILE-WALL-01", "MAT-TILE-GLUE-01"],
  "WALL-004":  ["MAT-PANEL-PVC-01"],
  "WALL-005":  ["MAT-PANEL-MDF-01"],
  "FLOOR-001": ["MAT-LAM-01", "MAT-UNDER-01"],
  "FLOOR-002": ["MAT-LINO-01"],
  "FLOOR-003": ["MAT-TILE-01", "MAT-TILE-GLUE-01"],
  "FLOOR-004": ["MAT-HEAT-FLOOR-01"],
  "FLOOR-005": ["MAT-CARPET-01"],
  "DOOR-001":  ["MAT-DOOR-01"],
  "TRIM-001":  ["MAT-PLINTH-01"],
  "TRIM-002":  ["MAT-PLINTH-02"],
  // Натяжной потолок ПВХ: полотно + алюминиевый багет по периметру
  "CEIL-001":  ["MAT-PVC-CEIL-01", "MAT-PVC-BAGUET-01"],
  // Подвесной потолок ГКЛ: каркас → обшивка → стыки
  "CEIL-002":  ["MAT-PROFILE-CEIL-01"],
  "CEIL-003":  ["MAT-GKL-CEIL-01"],
  "CEIL-004":  ["MAT-GKL-JOINT-01"],

  // Гидроизоляция санузла: обмазочная смесь + лента в углах
  "WATERPROOF-001": ["MAT-WATERPROOF-01", "MAT-WATERPROOF-TAPE-01"],
  "WATERPROOF-002": ["MAT-WATERPROOF-01"],

  // Стяжка: ЦПС с фиброй + грунт-бетоконтакт; самовыравнивание — отдельная смесь
  "SCREED-001": ["MAT-SCREED-CEMENT-01", "MAT-FIBER-PP-01", "MAT-PRIMER-FLOOR-01"],
  "SCREED-002": ["MAT-SCREED-LEVEL-01", "MAT-PRIMER-FLOOR-01"],

  // Сантехтрубы
  "PIPE-001": ["MAT-PIPE-PEX-20", "MAT-FITTINGS-PEX-01", "MAT-VALVE-BALL-01"],
  "PIPE-002": ["MAT-PIPE-PP-32", "MAT-FITTINGS-PEX-01"],
  "PIPE-003": ["MAT-PIPE-SEWER-50", "MAT-PIPE-SEWER-110"],

  // Перегородка ГКЛ: профили + лист + минвата
  "PARTITION-001": ["MAT-PROFILE-WALL-01", "MAT-GKL-CEIL-01", "MAT-INSUL-MIN-50"],

  // Окна
  "WINDOW-001": ["MAT-WINDOW-SILL-PVC-01", "MAT-FOAM-PU-01"],
  "WINDOW-002": ["MAT-SLOPES-PVC-01", "MAT-FOAM-PU-01"],

  // Герметизация швов
  "SEALANT-001": ["MAT-SEALANT-SILICONE-01"],
  // DEM-010..055 — только труд, материалов не требуют (мусорные мешки в смете не учитываем).
};

export function calculate(
  claudeOutput: ClaudeOutput,
  context: IncidentContext,
  calibration: CalibrationValues,
  catalogs: Catalogs,
  overridePriority?: number
): Report {
  const surfaceArea = computeRoomsSurfaceArea(context.rooms);
  const areaPick = pickAuthoritativeArea(
    claudeOutput,
    context.affected_area_m2,
    surfaceArea > 0 ? Math.round(surfaceArea * 10) / 10 : undefined,
    overridePriority
  );
  const S = areaPick.value;
  const defaultH = calibration.default_ceiling_height_m;
  const rawH =
    typeof context.ceiling_height === "number" ? context.ceiling_height : defaultH;
  // Clamp to a reasonable bracket so an outlier value (e.g., 5 m loft) doesn't
  // explode the wall-works estimate by 80%.
  const h = Math.min(Math.max(rawH, 2.2), 4.0);
  const heightFactor = h / defaultH;

  // Approximate perimeter (for linear works: plinths, casings)
  // S here is the user-declared damaged area — we only need P for non-area works.
  const P = 2 * Math.sqrt(Math.max(S, 4) * 1.2);

  const regionKey = context.region || "moscow";
  const regionData = catalogs.regions.regions[regionKey] ?? catalogs.regions.regions["moscow"];
  const worksCoef = regionData.works_coefficient;
  const materialsCoef = regionData.materials_coefficient;
  const finishFactor = getFinishFactor(context.finish_level, calibration);

  const currentYear = new Date().getFullYear();
  const renovationAge = currentYear - (context.last_renovation_year ?? currentYear - 10);

  // Build work items. Each WorkSpec carries its own area/surface/material_predicted.
  // We keep the parallel `workSpecs` array so the material loop can read
  // material_predicted (для tier-селектора) и не зависеть от строкового кода.
  const workItems: WorkItem[] = [];
  const workSpecsForItems: WorkSpec[] = [];
  for (const ws of claudeOutput.recommended_works) {
    const catalogEntry = catalogs.works.find((w) => w.code === ws.code);
    if (!catalogEntry) continue;

    // Per-work area: ws.area_m2 если AI его дал, иначе общая S как fallback.
    const A = ws.area_m2 && ws.area_m2 > 0 ? ws.area_m2 : S;
    const volume = computeVolume(ws.code, A, P, heightFactor, ws.surface);
    const unitPrice = Math.round(catalogEntry.base_price_rub * worksCoef * finishFactor);
    const total = Math.round(volume * unitPrice);

    workItems.push({
      code: ws.code,
      name: catalogEntry.name,
      unit: catalogEntry.unit,
      volume: Math.round(volume * 100) / 100,
      unit_price: unitPrice,
      total,
      surface: ws.surface,
    });
    workSpecsForItems.push(ws);
  }

  // Aggregate per-material work volumes across ALL linked works (раньше дедуп
  // глобально по matCode давал недосчёт: PREP-001 для потолка 0.5 м² + PREP-002
  // для стены 3 м² → один MAT-PRIMER-01 по объёму первой работы). Сейчас
  // суммируем объёмы и берём WorkSpec с самым высоким тиром для tier-селектора.
  const matAgg = new Map<string, { volume: number; ws: WorkSpec }>();
  for (let i = 0; i < workItems.length; i++) {
    for (const matCode of WORK_TO_MATERIALS[workItems[i].code] ?? []) {
      const prev = matAgg.get(matCode);
      const ws = workSpecsForItems[i];
      const tier = TIER_RANK[inferTierFromPredicted(ws.material_predicted)];
      if (!prev) {
        matAgg.set(matCode, { volume: workItems[i].volume, ws });
      } else {
        const prevTier = TIER_RANK[inferTierFromPredicted(prev.ws.material_predicted)];
        matAgg.set(matCode, {
          volume: prev.volume + workItems[i].volume,
          ws: tier > prevTier ? ws : prev.ws,
        });
      }
    }
  }

  const materialItems: MaterialItem[] = [];
  for (const [matCode, agg] of matAgg) {
    const matEntry = catalogs.materials.find((m) => m.code === matCode);
    if (!matEntry) continue;
    // consumption_m2_per_package: coverage per 1 package
    // (field name is historical — also means "п.м. на упаковку" for плинтус, "шт" for двери)
    const coveredPerPackage = matEntry.consumption_m2_per_package ?? 1;
    const volume = Math.max(1, Math.ceil(agg.volume / coveredPerPackage));
    const tierMult = getTierMultiplier(context.finish_level, matEntry, agg.ws, calibration);
    let unitPrice = Math.round(matEntry.base_price_rub * materialsCoef * tierMult);
    let total = Math.round(volume * unitPrice);

    // Apply wear coefficient per ВСН 53-86(р)
    if (calibration.wear_apply && matEntry.service_life_years > 0) {
      const wearK = Math.min(1, renovationAge / matEntry.service_life_years);
      total = Math.round(total * (1 - wearK));
      unitPrice = volume > 0 ? Math.round(total / volume) : unitPrice;
    }

    materialItems.push({
      code: matCode,
      name: matEntry.name,
      unit: matEntry.package_unit,
      volume: Math.round(volume * 100) / 100,
      unit_price: unitPrice,
      total,
    });
  }

  const worksTotal = workItems.reduce((acc, w) => acc + w.total, 0);
  const materialsTotal = materialItems.reduce((acc, m) => acc + m.total, 0);
  let base = worksTotal + materialsTotal;

  // Discount for low confidence
  if (claudeOutput.average_confidence < 0.6) {
    base = Math.round(base * calibration.vision_low_confidence_discount);
  }

  const sigma = calibration.range_sigma;

  // Distribute work items across (room, surface) pairs when the chat
  // captured per-room dimensions. Each work is split proportional to the
  // surface area of each room that has the matching surface in its
  // affected_surfaces list. Works without a surface (or with a surface no
  // room has marked) skip the breakdown — they remain in the flat works[]
  // section for the report renderer to show as "Прочее".
  const roomsBreakdown = buildRoomsBreakdown(workItems, context);

  return {
    range: {
      min: Math.round(base * (1 - sigma)),
      base: Math.round(base),
      max: Math.round(base * (1 + sigma)),
    },
    sigma,
    works: workItems,
    materials: materialItems,
    routed_to_expert: base > calibration.stp_threshold_rub,
    claude_output: claudeOutput,
    area_pick: areaPick,
    rooms_breakdown: roomsBreakdown.length ? roomsBreakdown : undefined,
  };
}

function buildRoomsBreakdown(
  works: WorkItem[],
  context: IncidentContext
): import("@/types").RoomBreakdown[] {
  const rooms = context.rooms;
  if (!rooms?.length) return [];

  type Bucket = { room: string; surface: import("@/types").Surface; area: number; works: WorkItem[] };
  const buckets = new Map<string, Bucket>();

  function ensure(room: string, surface: import("@/types").Surface, area: number): Bucket {
    const k = `${room}::${surface}`;
    let b = buckets.get(k);
    if (!b) {
      b = { room, surface, area, works: [] };
      buckets.set(k, b);
    }
    return b;
  }

  // For every (room, affected_surface) seed an empty bucket so the breakdown
  // shows even surfaces with no recommended works (e.g. demolition-only).
  for (const r of rooms) {
    const floorCeil = r.length_m * r.width_m;
    const wallArea = 2 * (r.length_m + r.width_m) * r.height_m;
    const surfaces = r.affected_surfaces ?? [];
    for (const s of surfaces) {
      const area = s === "wall" ? wallArea : floorCeil;
      ensure(r.name, s, Math.round(area * 10) / 10);
    }
  }

  // For each work, find rooms whose affected_surfaces include work.surface,
  // then split the work proportionally to those rooms' surface areas.
  for (const w of works) {
    const surf = w.surface;
    if (!surf || surf === "doorway" || surf === "window") continue;
    const eligible: Array<{ room: string; area: number }> = [];
    for (const r of rooms) {
      if (!(r.affected_surfaces ?? []).includes(surf as "ceiling" | "wall" | "floor")) continue;
      const floorCeil = r.length_m * r.width_m;
      const wallArea = 2 * (r.length_m + r.width_m) * r.height_m;
      eligible.push({ room: r.name, area: surf === "wall" ? wallArea : floorCeil });
    }
    if (eligible.length === 0) continue;
    const totalArea = eligible.reduce((s, e) => s + e.area, 0);
    for (const e of eligible) {
      const share = totalArea > 0 ? e.area / totalArea : 1 / eligible.length;
      const splitVolume = Math.round(w.volume * share * 100) / 100;
      const splitTotal = Math.round(w.total * share);
      const bucket = ensure(e.room, surf as import("@/types").Surface, Math.round(e.area * 10) / 10);
      bucket.works.push({
        ...w,
        volume: splitVolume,
        total: splitTotal,
        room: e.room,
        surface: surf,
      });
    }
  }

  // Sort: rooms in the order entered, surfaces in a stable display order.
  const surfaceOrder: Record<string, number> = { ceiling: 0, wall: 1, floor: 2 };
  const out: import("@/types").RoomBreakdown[] = Array.from(buckets.values())
    .sort((a, b) => {
      const ra = rooms.findIndex((x) => x.name === a.room);
      const rb = rooms.findIndex((x) => x.name === b.room);
      if (ra !== rb) return ra - rb;
      return (surfaceOrder[a.surface] ?? 9) - (surfaceOrder[b.surface] ?? 9);
    })
    .map((b) => ({
      room: b.room,
      surface: b.surface,
      area_m2: b.area,
      works: b.works,
      subtotal: b.works.reduce((s, w) => s + w.total, 0),
    }));

  return out;
}
