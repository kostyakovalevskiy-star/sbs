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
    kind: "text",
    id: "AM",
    field: "policy_number_manual",
    question:
      "Введите номер вашего полиса. Без полиса оформить страховое событие нельзя — если номера нет под рукой, нажмите «Завершить» вверху и вернитесь позже.",
    placeholder: "Например: SBS-1234567",
    minLength: 4,
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
      { value: "econom", label: "Эконом", hint: "Базовая отделка", iconName: "leaf" },
      { value: "standard", label: "Стандарт", hint: "Ламинат, обои, покраска", iconName: "home" },
      { value: "comfort", label: "Комфорт", hint: "Паркет, штукатурка", iconName: "sparkles" },
      { value: "premium", label: "Премиум", hint: "Дизайнерский ремонт", iconName: "crown" },
    ],
  },
  {
    kind: "choice",
    id: "A7",
    field: "event_type",
    question: "Выберите тип события — это поможет AI точнее определить ущерб.",
    options: [
      { value: "flood", label: "Залив", hint: "соседи / трубы", iconName: "droplets", iconTone: "blue" },
      { value: "fire", label: "Пожар", hint: "возгорание", iconName: "flame", iconTone: "orange" },
      { value: "theft", label: "Кража", hint: "взлом / хищение", iconName: "shield", iconTone: "red" },
      { value: "natural", label: "Стихия", hint: "град / шторм", iconName: "wind", iconTone: "gray" },
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
        kind: "choice",
        id: "B0.2",
        field: "B0_source",
        question: "Откуда пошла вода?",
        options: [
          { value: "neighbors_above", label: "Сверху от соседей", hint: "Протёк потолок", iconName: "arrow-down" },
          { value: "own_apt", label: "Своя квартира", hint: "Труба, кран, стиралка", iconName: "wrench" },
          { value: "unknown", label: "Не знаю", iconName: "help" },
          { value: "other", label: "Другое", iconName: "more" },
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
      const base = `Источник: ${src}. Пострадало: ${parts.B0_damage}.`;
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
      { value: "2.5", label: "2.5 м", hint: "Хрущёвка, типовая" },
      { value: "2.7", label: "2.7 м", hint: "Стандарт большинства новостроек" },
      { value: "3.0", label: "3.0 м", hint: "Высокие потолки, бизнес-класс" },
    ],
  },
  {
    kind: "choice",
    id: "B5",
    field: "wall_material",
    question: "Из чего построен дом?",
    options: [
      { value: "panel", label: "Панельный", hint: "Серия типовых ЖБ-панелей", iconName: "grid" },
      { value: "brick", label: "Кирпич", hint: "Кирпичная кладка", iconName: "boxes" },
      { value: "monolith", label: "Монолит", hint: "Железобетонный каркас", iconName: "box" },
      { value: "drywall", label: "Гипсокартон", hint: "Перегородки из ГКЛ", iconName: "layers" },
    ],
  },
  {
    kind: "choice",
    id: "B6",
    field: "has_uk_act",
    question: "Получили акт от управляющей компании?",
    options: [
      { value: "yes", label: "Да, есть", hint: "Документ на руках", iconName: "check" },
      { value: "no", label: "Нет", hint: "Ещё не оформили", iconName: "x" },
    ],
  },
];

// === Block P — Post-branch (always last, common to all branches) ===
// Captures damaged movable property + payout details before the user is
// routed to the photo session. Property is optional (skipped when nothing
// movable was hit); payout is mandatory because the claim can't pay out
// without a destination.
export const POST_STEPS: Step[] = [
  {
    kind: "text",
    id: "P0",
    field: "movable_property",
    question:
      "Какое движимое имущество пострадало? Укажите наименование и марку — например: «Холодильник Bosch KGE3», «Диван IKEA Friheten». Если ничего из имущества не пострадало — пропустите.",
    placeholder: "Холодильник Bosch, телевизор Samsung 55″, ковёр…",
    multiline: true,
    minLength: 0,
    optional: true,
  },
  {
    kind: "choice",
    id: "Q0",
    field: "payout_method",
    question: "Куда отправить выплату?",
    options: [
      {
        value: "sbp",
        label: "Система быстрых платежей",
        hint: "Перевод по номеру телефона",
        iconName: "zap",
        iconTone: "green",
      },
      {
        value: "card",
        label: "Реквизиты карты",
        hint: "По номеру карты",
        iconName: "rectangle",
        iconTone: "blue",
      },
    ],
  },
  {
    kind: "choice",
    id: "Q1",
    field: "sbp_phone_choice",
    question: "На какой номер отправить перевод?",
    options: [
      {
        value: "current",
        label: "На указанный ранее номер",
        hint: "Тот же, по которому связались",
        iconName: "check",
        iconTone: "green",
      },
      {
        value: "other",
        label: "Другой номер",
        hint: "Введу вручную",
        iconName: "more",
        iconTone: "gray",
      },
    ],
  },
  {
    kind: "phone",
    id: "Q1B",
    field: "sbp_phone_other",
    question: "Введите номер телефона для СБП.",
  },
  {
    kind: "text",
    id: "Q2",
    field: "card_number",
    question: "Введите номер карты для перевода.",
    placeholder: "0000 0000 0000 0000",
    minLength: 13,
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
      { value: "kitchen", label: "Кухня", hint: "Плита, духовка", iconName: "chef" },
      { value: "wiring", label: "Электропроводка", hint: "КЗ, искрение", iconName: "zap" },
      { value: "neighbors", label: "От соседей", hint: "Сверху или сбоку", iconName: "users" },
      { value: "other", label: "Другое", iconName: "more" },
      { value: "unknown", label: "Не знаю", iconName: "help" },
    ],
  },
  {
    kind: "choice",
    id: "C3",
    field: "fire_mchs_called",
    question: "Вызывали МЧС?",
    options: [
      { value: "with_protocol", label: "Да, есть протокол", hint: "Документ на руках", iconName: "file-check" },
      { value: "without_protocol", label: "Да, без протокола", hint: "Выезжали, но без документа", iconName: "bell" },
      { value: "no", label: "Нет", hint: "Не вызывали", iconName: "x" },
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
      { value: "door", label: "Дверь", hint: "Взлом замка / снятие петель", iconName: "door" },
      { value: "window", label: "Окно", hint: "Через стеклопакет", iconName: "rectangle" },
      { value: "balcony", label: "Балкон", hint: "С балкона / лоджии", iconName: "home" },
      { value: "unknown", label: "Не знаю", iconName: "help" },
      { value: "other", label: "Другое", iconName: "more" },
    ],
  },
  {
    kind: "choice",
    id: "D3",
    field: "theft_police_filed",
    question: "Подали заявление в полицию?",
    options: [
      { value: "with_kusp", label: "Да, есть КУСП", hint: "Номер на руках", iconName: "file-check" },
      { value: "pending", label: "Да, ещё ждём", hint: "Подали, ждём номер", iconName: "clock" },
      { value: "no", label: "Нет", hint: "Не обращались", iconName: "x" },
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
      { value: "wind", label: "Ураган", hint: "Сильный ветер", iconName: "wind" },
      { value: "hail", label: "Град", hint: "Крупный град", iconName: "cloud" },
      { value: "tree_fall", label: "Дерево", hint: "Падение дерева", iconName: "tree" },
      { value: "lightning", label: "Молния", hint: "Удар молнии", iconName: "zap" },
      { value: "flood_natural", label: "Наводнение", hint: "Паводок", iconName: "waves" },
      { value: "other", label: "Другое", iconName: "more" },
    ],
  },
  {
    kind: "multi_choice",
    id: "E3",
    field: "natural_affected_zones",
    question: "Что пострадало? Можно выбрать несколько.",
    minSelected: 1,
    options: [
      { value: "facade", label: "Фасад", hint: "Стены здания", iconName: "building" },
      { value: "windows", label: "Окна", hint: "Остекление", iconName: "rectangle" },
      { value: "roof", label: "Крыша", hint: "Кровля и водостоки", iconName: "home" },
      { value: "yard", label: "Двор", hint: "Прилегающая территория", iconName: "tree" },
      { value: "interior", label: "Интерьер", hint: "Внутри квартиры", iconName: "sofa" },
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
  // Manual policy number — only when policy lookup explicitly failed.
  AM: (a) => a.policy_found === false,
  C4: (a) => a.fire_mchs_called === "with_protocol",
  D4: (a) => a.theft_police_filed === "with_kusp",
  // Payout fan-out: SBP path asks for phone, card path asks for card number.
  Q1: (a) => a.payout_method === "sbp",
  Q1B: (a) => a.payout_method === "sbp" && a.sbp_phone_choice === "other",
  Q2: (a) => a.payout_method === "card",
};

export function shouldShowStep(stepId: string, answers: Record<string, unknown>): boolean {
  const pred = STEP_PRECONDITIONS[stepId];
  return pred ? pred(answers) : true;
}
