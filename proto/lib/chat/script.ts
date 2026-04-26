import type { Step } from "./types";

// === Block A — Intro (always first) ===
export const INTRO_STEPS: Step[] = [
  {
    kind: "gosuslugi",
    id: "A0",
    field: "auth_method",
    question:
      "Здравствуйте! Я Станислав и помогу оформить событие. Чтобы заполнить быстрее, авторизуйтесь через Госуслуги — мы автоматически подставим ФИО и телефон. Или заполните вручную.",
  },
  {
    kind: "text",
    id: "A1",
    field: "name",
    question: "Как к вам обращаться? Назовите ФИО полностью.",
    placeholder: "Иванов Иван Иванович",
    minLength: 2,
  },
  {
    kind: "phone",
    id: "A2",
    field: "phone",
    question: "По какому номеру с вами связаться?",
  },
  {
    kind: "policy_found",
    id: "AP",
    field: "policy_found",
    question: "Я нашёл ваш действующий полис. Это он?",
  },
  {
    kind: "address",
    id: "A3",
    field: "address",
    question: "Введите адрес объекта — улица, дом, квартира.",
  },
  {
    kind: "numeric",
    id: "A4",
    field: "apartment_area_m2",
    question: "Какая площадь квартиры в м²? Поможет точнее посчитать ущерб.",
    placeholder: "54",
    min: 5,
    max: 2000,
    suffix: "м²",
    optional: true,
  },
  {
    kind: "numeric",
    id: "A5",
    field: "last_renovation_year",
    question: "В каком году делали последний ремонт?",
    placeholder: String(new Date().getFullYear() - 5),
    min: 1950,
    max: new Date().getFullYear(),
    integer: true,
    optional: true,
  },
  {
    kind: "choice",
    id: "A6",
    field: "finish_level",
    question: "Какой уровень отделки в квартире?",
    options: [
      { value: "econom", label: "Эконом", hint: "Базовая отделка" },
      { value: "standard", label: "Стандарт", hint: "Ламинат, обои, покраска" },
      { value: "comfort", label: "Комфорт", hint: "Паркет, декоративная штукатурка" },
      { value: "premium", label: "Премиум", hint: "Дизайнерский ремонт" },
    ],
  },
  {
    kind: "choice",
    id: "A7",
    field: "event_type",
    question: "Что произошло?",
    options: [
      { value: "flood", label: "Залив квартиры" },
      { value: "fire", label: "Пожар" },
      { value: "theft", label: "Взлом / кража" },
      { value: "natural", label: "Стихийное бедствие" },
    ],
  },
];

// === Block B — Flood ===
export const FLOOD_STEPS: Step[] = [
  {
    kind: "compound",
    id: "B0",
    field: "incident_description",
    question: "Расскажу подробнее, чтобы передать эксперту полный контекст.",
    subSteps: [
      {
        kind: "text",
        id: "B0.1",
        field: "B0_when",
        question: "Когда вы заметили залив?",
        placeholder: "Например: вчера вечером",
        minLength: 3,
      },
      {
        kind: "choice",
        id: "B0.2",
        field: "B0_source",
        question: "Откуда пошла вода?",
        options: [
          { value: "neighbors_above", label: "Сверху от соседей" },
          { value: "own_apt", label: "Своя квартира — труба, кран, стиралка" },
          { value: "unknown", label: "Не знаю" },
          { value: "other", label: "Другое" },
        ],
      },
      {
        kind: "text",
        id: "B0.3",
        field: "B0_damage",
        question: "Что больше всего пострадало?",
        placeholder: "Например: потолок и обои в зале",
        minLength: 3,
      },
      {
        kind: "text",
        id: "B0.4",
        field: "B0_freeform",
        question:
          "Расскажите своими словами, что произошло — как заметили, что видите вокруг, что успели сделать. Чем подробнее, тем точнее эксперт оценит ущерб.",
        placeholder:
          "Например: на потолке жёлтые пятна, ламинат вспух у стены, по стояку сверху капало всю ночь...",
        minLength: 20,
        multiline: true,
      },
    ],
    combine: (parts) => {
      const sourceLabels: Record<string, string> = {
        neighbors_above: "Сверху от соседей",
        own_apt: "Своя квартира",
        unknown: "Не знаю",
        other: "Другое",
      };
      const src = sourceLabels[parts.B0_source] ?? parts.B0_source;
      const freeform = parts.B0_freeform?.trim();
      const base = `Заметил: ${parts.B0_when}. Источник: ${src}. Пострадало: ${parts.B0_damage}.`;
      return freeform ? `${base} Подробности: ${freeform}` : base;
    },
  },
  {
    kind: "date",
    id: "B1",
    field: "event_date",
    question: "Когда произошёл залив?",
  },
  {
    kind: "numeric",
    id: "B3",
    field: "affected_area_m2",
    question: "Какая суммарная площадь повреждений по всем комнатам? Это м² пола, стен или потолка, где видны следы воды.",
    placeholder: "12",
    min: 0.1,
    suffix: "м²",
  },
  {
    kind: "choice",
    id: "B4",
    field: "ceiling_height",
    question: "Какая высота потолков?",
    options: [
      { value: "2.5", label: "2.5 м" },
      { value: "2.7", label: "2.7 м" },
      { value: "3.0", label: "3.0 м" },
    ],
  },
  {
    kind: "choice",
    id: "B5",
    field: "wall_material",
    question: "Из чего построен дом?",
    options: [
      { value: "panel", label: "Панельный дом" },
      { value: "brick", label: "Кирпич" },
      { value: "monolith", label: "Монолит" },
      { value: "drywall", label: "Гипсокартон" },
    ],
  },
  {
    kind: "choice",
    id: "B6",
    field: "has_uk_act",
    question: "Получили акт от управляющей компании?",
    options: [
      { value: "yes", label: "Да, есть" },
      { value: "no", label: "Нет, ещё не оформили" },
    ],
  },
];

// === Block C — Fire ===
export const FIRE_STEPS: Step[] = [
  {
    kind: "date",
    id: "C1",
    field: "fire_event_date",
    question: "Когда произошёл пожар?",
  },
  {
    kind: "choice",
    id: "C2",
    field: "fire_source",
    question: "Где, по вашему мнению, начался пожар?",
    options: [
      { value: "kitchen", label: "Кухня" },
      { value: "wiring", label: "Электропроводка" },
      { value: "neighbors", label: "От соседей" },
      { value: "other", label: "Другое" },
      { value: "unknown", label: "Не знаю" },
    ],
  },
  {
    kind: "choice",
    id: "C3",
    field: "fire_mchs_called",
    question: "Вызывали МЧС?",
    options: [
      { value: "with_protocol", label: "Да, есть протокол" },
      { value: "without_protocol", label: "Да, без протокола" },
      { value: "no", label: "Нет" },
    ],
  },
  {
    kind: "text",
    id: "C4",
    field: "fire_mchs_protocol_number",
    question: "Введите номер протокола МЧС.",
    placeholder: "Например: 1234/А-25",
    minLength: 2,
  },
  {
    kind: "text",
    id: "C5",
    field: "incident_description",
    question:
      "Расскажите своими словами, что произошло и что пострадало. Чем подробнее, тем точнее эксперт оценит ущерб.",
    placeholder: "Например: выгорела кухня, копоть в коридоре, повреждён шкаф",
    minLength: 30,
    multiline: true,
  },
];

// === Block D — Theft ===
export const THEFT_STEPS: Step[] = [
  {
    kind: "date",
    id: "D1",
    field: "theft_event_date",
    question: "Когда вы обнаружили взлом или пропажу?",
  },
  {
    kind: "choice",
    id: "D2",
    field: "theft_entry_method",
    question: "Как преступники проникли в квартиру?",
    options: [
      { value: "door", label: "Дверь" },
      { value: "window", label: "Окно" },
      { value: "balcony", label: "Балкон" },
      { value: "unknown", label: "Не знаю" },
      { value: "other", label: "Другое" },
    ],
  },
  {
    kind: "choice",
    id: "D3",
    field: "theft_police_filed",
    question: "Подали заявление в полицию?",
    options: [
      { value: "with_kusp", label: "Да, есть КУСП" },
      { value: "pending", label: "Да, ещё ждём" },
      { value: "no", label: "Нет" },
    ],
  },
  {
    kind: "text",
    id: "D4",
    field: "theft_kusp_number",
    question: "Введите номер КУСП.",
    placeholder: "Например: 12345/2026",
    minLength: 2,
  },
  {
    kind: "text",
    id: "D5",
    field: "incident_description",
    question:
      "Расскажите своими словами, что пропало или повреждено и при каких обстоятельствах.",
    placeholder: "Например: ноутбук, украшения, повреждена входная дверь",
    minLength: 30,
    multiline: true,
  },
];

// === Block E — Natural disaster ===
export const NATURAL_STEPS: Step[] = [
  {
    kind: "date",
    id: "E1",
    field: "natural_event_date",
    question: "Когда произошло происшествие?",
  },
  {
    kind: "choice",
    id: "E2",
    field: "natural_disaster_type",
    question: "Что случилось?",
    options: [
      { value: "wind", label: "Ураган / сильный ветер" },
      { value: "hail", label: "Град" },
      { value: "tree_fall", label: "Падение дерева" },
      { value: "lightning", label: "Удар молнии" },
      { value: "flood_natural", label: "Наводнение / паводок" },
      { value: "other", label: "Другое" },
    ],
  },
  {
    kind: "multi_choice",
    id: "E3",
    field: "natural_affected_zones",
    question: "Что пострадало? Можно выбрать несколько.",
    minSelected: 1,
    options: [
      { value: "facade", label: "Фасад" },
      { value: "windows", label: "Окна, остекление" },
      { value: "roof", label: "Крыша" },
      { value: "yard", label: "Двор / прилегающая территория" },
      { value: "interior", label: "Внутри квартиры" },
    ],
  },
  {
    kind: "text",
    id: "E4",
    field: "incident_description",
    question:
      "Расскажите своими словами, какой ущерб видите и что произошло.",
    placeholder: "Например: разбито окно в спальне, упал шкаф",
    minLength: 30,
    multiline: true,
  },
];

export type Branch = "flood" | "fire" | "theft" | "natural";

export function getBranchSteps(branch: Branch): Step[] {
  switch (branch) {
    case "flood":
      return FLOOD_STEPS;
    case "fire":
      return FIRE_STEPS;
    case "theft":
      return THEFT_STEPS;
    case "natural":
      return NATURAL_STEPS;
  }
}

// Conditional skipping: if a step's predicate returns false given current
// answers, the engine skips it. Defined here to keep the script declarative.
export const STEP_PRECONDITIONS: Record<string, (answers: Record<string, unknown>) => boolean> = {
  // Skip the manual ФИО / phone questions when the user came in via Госуслуги.
  A1: (a) => a.auth_method !== "gosuslugi",
  A2: (a) => a.auth_method !== "gosuslugi",
  // Skip address / area / finish_level questions when the policy already
  // provided them.
  A3: (a) => a.policy_found !== true,
  A4: (a) => a.policy_found !== true,
  A6: (a) => a.policy_found !== true,
  C4: (a) => a.fire_mchs_called === "with_protocol",
  D4: (a) => a.theft_police_filed === "with_kusp",
};

export function shouldShowStep(stepId: string, answers: Record<string, unknown>): boolean {
  const pred = STEP_PRECONDITIONS[stepId];
  return pred ? pred(answers) : true;
}
