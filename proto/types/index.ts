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

export interface ClaudeOutput {
  photos: ClaudePhotoAnalysis[];
  recommended_works: string[];
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

export interface DraftState {
  id: string;
  created_at: string;
  current_step: "intro" | "flood" | "camera" | "review" | "result";
  intro?: Partial<IncidentContext>;
  flood?: Partial<IncidentContext>;
  photos?: Array<{ base64: string; exif: ExifData | null; laplacianVariance: number }>;
  result?: { id: string; report: Report };
}
