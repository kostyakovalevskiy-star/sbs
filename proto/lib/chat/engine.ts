import type { ChatState, Step } from "./types";
import { INTRO_STEPS, POST_STEPS, getBranchSteps, shouldShowStep, type Branch } from "./script";

interface FlatEntry {
  step: Step;
  parentCompoundId?: string;
  isLastInCompound?: boolean;
}

// Flatten compound steps into a single ordered list of leaf steps.
// Each leaf carries a hint about its compound parent (used to run `combine`).
export function flattenSteps(steps: Step[]): FlatEntry[] {
  const out: FlatEntry[] = [];
  for (const step of steps) {
    if (step.kind === "compound") {
      step.subSteps.forEach((sub, i) => {
        out.push({
          step: sub,
          parentCompoundId: step.id,
          isLastInCompound: i === step.subSteps.length - 1,
        });
      });
    } else {
      out.push({ step });
    }
  }
  return out;
}

export function getFullScript(branch: Branch | null): FlatEntry[] {
  const intro = flattenSteps(INTRO_STEPS);
  if (!branch) return intro;
  // POST_STEPS (movable property + payout) run after every branch so any
  // event type — flood, fire, theft, natural — captures payout details
  // before handing off to the camera / handoff page.
  return [
    ...intro,
    ...flattenSteps(getBranchSteps(branch)),
    ...flattenSteps(POST_STEPS),
  ];
}

export function getCompoundParent(steps: Step[], childStepId: string): Step | null {
  for (const s of steps) {
    if (s.kind === "compound" && s.subSteps.some((sub) => sub.id === childStepId)) {
      return s;
    }
  }
  return null;
}

// Walk forward from the given step to find the next visible step (skipping
// conditionally hidden ones based on the current answers).
export function findNextStepId(
  flat: FlatEntry[],
  fromIndex: number,
  answers: Record<string, unknown>
): string | null {
  for (let i = fromIndex; i < flat.length; i++) {
    if (shouldShowStep(flat[i].step.id, answers)) return flat[i].step.id;
  }
  return null;
}

export function makeMsgId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function initialChatState(): ChatState {
  // Start blank with the typing indicator. The page sets the first question
  // after a short delay so the user sees the bot "typing" on entry.
  return {
    messages: [],
    answers: {},
    currentStepId: null,
    finished: false,
    isTyping: true,
  };
}

// =================== Mapping answers → DraftState ===================
import type {
  DraftState,
  EventType,
  FinishLevel,
  WallMaterial,
  FireSource,
  MchsCalled,
  EntryMethod,
  PoliceFiled,
  DisasterType,
  AffectedZone,
  RoomDimensions,
} from "@/types";
import { normalizePhoneDigits } from "@/lib/utils";

interface AnswerMap {
  // intro
  name?: string;
  phone?: string;
  address?: string;
  region?: string; // auto-extracted from DaData
  apartment_area_m2?: string;
  last_renovation_year?: string;
  finish_level?: string;
  event_type?: string;
  incident_description?: string;
  policy_number_manual?: string;
  // flood
  event_date?: string;
  floor?: string;
  affected_area_m2?: string;
  ceiling_height?: string;
  ceiling_height_custom?: string;
  wall_material?: string;
  has_uk_act?: string;
  // fire
  fire_event_date?: string;
  fire_source?: string;
  fire_mchs_called?: string;
  fire_mchs_protocol_number?: string;
  // theft
  theft_event_date?: string;
  theft_entry_method?: string;
  theft_police_filed?: string;
  theft_kusp_number?: string;
  // natural
  natural_event_date?: string;
  natural_disaster_type?: string;
  natural_affected_zones?: string[];
  // post-branch (movable property + payout)
  movable_property?: string;
  payout_method?: "sbp" | "card";
  sbp_phone_choice?: "current" | "other";
  sbp_phone_other?: string;
  card_number?: string;
  // per-room dimensions (RoomsControl)
  rooms?: RoomDimensions[];
}

export function mapAnswersToDraft(
  answers: Record<string, unknown>,
  prev: DraftState
): DraftState {
  const a = answers as AnswerMap;
  const draft: DraftState = { ...prev };
  draft.current_step = "chat";

  draft.intro = {
    ...draft.intro,
    name: a.name,
    phone: a.phone ? normalizePhoneDigits(a.phone) : draft.intro?.phone,
    address: a.address,
    region: a.region ?? draft.intro?.region ?? "moscow",
    apartment_area_m2:
      a.apartment_area_m2 && a.apartment_area_m2 !== ""
        ? parseFloat(a.apartment_area_m2)
        : undefined,
    last_renovation_year:
      a.last_renovation_year && a.last_renovation_year !== ""
        ? parseInt(a.last_renovation_year, 10)
        : undefined,
    finish_level: (a.finish_level as FinishLevel) || draft.intro?.finish_level,
    event_type: (a.event_type as EventType) || draft.intro?.event_type,
    incident_description: a.incident_description,
    policy_number_manual: a.policy_number_manual ?? draft.intro?.policy_number_manual,
    movable_property: a.movable_property ?? draft.intro?.movable_property,
  };

  // Payout — captured at the end of every branch.
  if (a.payout_method) {
    const sbpPhone =
      a.sbp_phone_choice === "other"
        ? a.sbp_phone_other
          ? normalizePhoneDigits(a.sbp_phone_other)
          : undefined
        : a.payout_method === "sbp"
          ? draft.intro?.phone ?? (a.phone ? normalizePhoneDigits(a.phone) : undefined)
          : undefined;
    const cardLast4 =
      a.payout_method === "card" && a.card_number
        ? a.card_number.replace(/\D/g, "").slice(-4)
        : undefined;
    draft.payout = {
      method: a.payout_method,
      sbp_phone: sbpPhone,
      card_last4: cardLast4,
    };
  }

  if (a.event_type === "flood") {
    // Rooms persist as-is; the calculator computes the surface-area sum
    // and ranks it as priority 0 (highest) in pickAuthoritativeArea.
    // affected_area_m2 stays as the legacy declared single number for
    // older entry paths that don't capture rooms.
    draft.flood = {
      ...draft.flood,
      floor: a.floor ? parseInt(a.floor, 10) : undefined,
      event_date: a.event_date,
      affected_area_m2: a.affected_area_m2 ? parseFloat(a.affected_area_m2) : undefined,
      rooms: a.rooms ?? draft.flood?.rooms,
      ceiling_height: a.ceiling_height ? parseFloat(a.ceiling_height) : undefined,
      wall_material: a.wall_material as WallMaterial,
      has_uk_act: a.has_uk_act === "yes",
    };
  } else if (a.event_type === "fire") {
    draft.fire = {
      event_date: a.fire_event_date,
      fire_source: a.fire_source as FireSource,
      mchs_called: a.fire_mchs_called as MchsCalled,
      mchs_protocol_number: a.fire_mchs_protocol_number,
    };
  } else if (a.event_type === "theft") {
    draft.theft = {
      event_date: a.theft_event_date,
      entry_method: a.theft_entry_method as EntryMethod,
      police_filed: a.theft_police_filed as PoliceFiled,
      kusp_number: a.theft_kusp_number,
    };
  } else if (a.event_type === "natural") {
    draft.natural = {
      event_date: a.natural_event_date,
      disaster_type: a.natural_disaster_type as DisasterType,
      affected_zones: a.natural_affected_zones as AffectedZone[],
    };
  }

  return draft;
}
