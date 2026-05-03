export type EventType = "flood" | "fire" | "theft" | "natural";
export type FinishLevel = "econom" | "standard" | "comfort" | "premium";
export type WallMaterial = "panel" | "brick" | "monolith" | "drywall";
export type CeilingHeight = 2.5 | 2.7 | 3.0 | number;
export type DamageClass =
  | "yellow_spot"
  | "wallpaper_peeling"
  | "laminate_swelling"
  | "plaster_destruction"
  | "mold"
  | "ceramic_tile_damage"
  | "no_damage";
export type Surface = "ceiling" | "wall" | "floor" | "doorway" | "window";
export type Severity = "low" | "medium" | "high" | "critical";
export type CaseStatus = "complete" | "expert";

export interface ExifData {
  date?: string;
  gps?: { lat: number; lon: number };
  model?: string;
}

export interface PhotoMeta {
  base64: string;
  exif: ExifData | null;
  laplacianVariance: number;
  filename?: string;
}

export interface IncidentContext {
  id: string;
  name: string;
  phone: string;
  region: string;
  address: string;
  apartment_area_m2: number;
  last_renovation_year: number;
  event_type: EventType;
  incident_description?: string;
  // flood specific
  floor?: number;
  source_floor?: number;
  event_date?: string;
  affected_area_m2?: number;
  ceiling_height?: CeilingHeight;
  finish_level?: FinishLevel;
  wall_material?: WallMaterial;
  has_uk_act?: boolean;
}

export interface ClaudePhotoAnalysis {
  photo_index: number;
  damage_class: DamageClass;
  surface: Surface;
  material_predicted: string;
  area_estimate_m2: number;
  severity: Severity;
  confidence: number;
  sub_findings: string[];
}

export interface AreaEstimate {
  value: number;
  source: string;
}

// Per-work specification returned by Claude. Replaces the legacy `string[]` form
// of recommended_works so the calculator can:
//   1) split S per work (потолок 3 м² ≠ пол 8 м² ≠ стена 6 м²),
//   2) pass surface to computeVolume → не множит потолочные работы на heightFactor,
//   3) пробросить material_predicted в tier-селектор материала.
export interface WorkSpec {
  code: string;
  surface?: Surface;
  material_predicted?: string;
  area_m2?: number;
}

export interface ClaudeOutput {
  photos: ClaudePhotoAnalysis[];
  recommended_works: WorkSpec[];
  summary: string;
  average_confidence: number;
  // Four possible sources, priority-ordered: measure > reference > declared > visual
  area_from_measure: AreaEstimate | null;     // measurements read from Measure-app screenshot
  area_from_reference: AreaEstimate | null;   // scaled via bank card / coin / known object in frame
  area_visual: AreaEstimate;                  // rough visual estimate (always populated)
}

export interface WorkItem {
  code: string;
  name: string;
  unit: string;
  volume: number;
  unit_price: number;
  total: number;
}

export interface MaterialItem {
  code: string;
  name: string;
  unit: string;
  volume: number;
  unit_price: number;
  total: number;
}

export interface Report {
  range: {
    min: number;
    base: number;
    max: number;
  };
  sigma: number;
  works: WorkItem[];
  materials: MaterialItem[];
  routed_to_expert: boolean;
  claude_output: ClaudeOutput;
  area_pick?: {
    value: number;
    source: string;
    candidates: Array<AreaEstimate & { priority: number; used: boolean }>;
  };
}

export interface CaseRecord {
  id: string;
  created_at: string;
  context: IncidentContext;
  report: Report | null;
  photos_count: number;
  status: CaseStatus;
  photos?: string[];
}

export interface CalibrationWeight {
  label: string;
  type: "multiplier" | "currency" | "number" | "boolean";
  default: number | boolean;
  min?: number;
  max?: number;
  step?: number;
  description?: string;
}

export interface CalibrationConfig {
  version: string;
  updated_at: string;
  weights: {
    range_sigma: CalibrationWeight;
    finish_econom_factor: CalibrationWeight;
    finish_standard_factor: CalibrationWeight;
    finish_comfort_factor: CalibrationWeight;
    finish_premium_factor: CalibrationWeight;
    vision_low_confidence_discount: CalibrationWeight;
    stp_threshold_rub: CalibrationWeight;
    critical_crack_mm: CalibrationWeight;
    mold_area_threshold_m2: CalibrationWeight;
    wear_apply: CalibrationWeight;
    default_ceiling_height_m: CalibrationWeight;
    tier_econom_multiplier?: CalibrationWeight;
    tier_standard_multiplier?: CalibrationWeight;
    tier_comfort_multiplier?: CalibrationWeight;
    tier_premium_multiplier?: CalibrationWeight;
  };
}

export interface CalibrationValues {
  range_sigma: number;
  finish_econom_factor: number;
  finish_standard_factor: number;
  finish_comfort_factor: number;
  finish_premium_factor: number;
  vision_low_confidence_discount: number;
  stp_threshold_rub: number;
  critical_crack_mm: number;
  mold_area_threshold_m2: number;
  wear_apply: boolean;
  default_ceiling_height_m: number;
  tier_econom_multiplier: number;
  tier_standard_multiplier: number;
  tier_comfort_multiplier: number;
  tier_premium_multiplier: number;
}

export interface WorkCatalogEntry {
  code: string;
  name: string;
  category: string;
  unit: string;
  base_price_rub: number;
  min_price_rub: number;
  max_price_rub: number;
  samples: number[];
}

export interface MaterialCatalogEntry {
  code: string;
  name: string;
  category: string;
  package_unit: string;
  package_amount: number;
  package_unit_label: string;
  consumption_m2_per_package: number;
  base_price_rub: number;
  samples_rub: number[];
  service_life_years: number;
  finish_class: string;
}

export interface RegionEntry {
  name: string;
  works_coefficient: number;
  materials_coefficient: number;
}

export interface RegionCoefficients {
  version: string;
  baseline_region: string;
  regions: Record<string, RegionEntry>;
}

export interface WorksCatalog {
  version: string;
  works: WorkCatalogEntry[];
}

export interface MaterialsCatalog {
  version?: string;
  materials: MaterialCatalogEntry[];
}

export interface CatalogAuditChange {
  code: string;
  field: "base_price_rub";
  old: number;
  new: number;
}

export interface CatalogAuditEntry {
  ts: number;
  type: "works" | "materials";
  actor: string;
  userAgent?: string;
  changes: CatalogAuditChange[];
  added: string[];
  removed: string[];
}

export type FireSource = "kitchen" | "wiring" | "neighbors" | "other" | "unknown";
export type MchsCalled = "with_protocol" | "without_protocol" | "no";
export type EntryMethod = "door" | "window" | "balcony" | "unknown" | "other";
export type PoliceFiled = "with_kusp" | "pending" | "no";
export type DisasterType = "wind" | "hail" | "tree_fall" | "lightning" | "flood_natural" | "other";
export type AffectedZone = "facade" | "windows" | "roof" | "yard" | "interior";

export interface FireDetails {
  event_date?: string;
  fire_source?: FireSource;
  mchs_called?: MchsCalled;
  mchs_protocol_number?: string;
}

export interface TheftDetails {
  event_date?: string;
  entry_method?: EntryMethod;
  police_filed?: PoliceFiled;
  kusp_number?: string;
}

export interface NaturalDetails {
  event_date?: string;
  disaster_type?: DisasterType;
  affected_zones?: AffectedZone[];
}

// =================== Admin corrections ===================
// Immutable copy of a Report's works/materials/areas that an administrator
// can edit. Original report stays read-only; every change is captured per
// item via `changeType` + `originalItemId`. Designed for a "before / стало"
// diff view and for "чистовик" / "черновик" exports.

export type ChangeType = "unchanged" | "edited" | "added" | "removed";
export type CorrectionStatus = "draft" | "fixed" | "cancelled";
export type CorrectionSection = "work" | "material" | "area";

export interface CorrectionItem {
  id: string;
  section: CorrectionSection;
  // Snapshot fields (current correction values).
  name: string;
  unit: string;
  qty: number;
  price: number;
  amount: number;
  // Pointer back to the row in the original report (null if added).
  originalItemId: string | null;
  changeType: ChangeType;
  reason?: string;
  // For section="area": ties value to a surface (стены / пол / потолок) so
  // multiple area rows can share one logical room.
  room?: string;
  surface?: Surface;
  // Frozen original snapshot for diff rendering — set on creation, never
  // mutated. Null for added rows.
  originalSnapshot?: {
    name: string;
    unit: string;
    qty: number;
    price: number;
    amount: number;
  } | null;
}

export interface CorrectionSummary {
  total: number;
  originalTotal: number;
  deltaAbs: number;
  deltaPct: number;
  edited: number;
  added: number;
  removed: number;
}

export interface Correction {
  id: string;
  caseId: string;
  status: CorrectionStatus;
  createdAt: string;
  fixedAt?: string;
  items: CorrectionItem[];
  summary: CorrectionSummary;
}

export interface DraftState {
  id: string;
  created_at: string;
  current_step: "intro" | "flood" | "camera" | "review" | "result" | "chat";
  intro?: Partial<IncidentContext>;
  flood?: Partial<IncidentContext>;
  fire?: FireDetails;
  theft?: TheftDetails;
  natural?: NaturalDetails;
  photos?: Array<{
    base64: string;
    exif: ExifData | null;
    laplacianVariance: number;
    sceneId?: string;
  }>;
  result?: { id: string; report: Report };
}
