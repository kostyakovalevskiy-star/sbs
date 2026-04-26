# RDP — Чат-бот форма для сбора первичных данных

**Развёрнутое описание продукта (Resolution / Design Proposal)**
Замена форм `/flow/intro` и `/flow/flood` на conversational-интерфейс.

| | |
|---|---|
| **Модуль** | `proto/app/flow/chat` (новый) — заменяет `intro` + `flood` |
| **Версия** | 0.1 — Draft for review |
| **Автор** | Product, направление «Оценка ущерба» |
| **Дата** | 26 апреля 2026 г. |
| **Связанные документы** | [PRD_Claim_Assistant.md](PRD_Claim_Assistant.md) §6 «Customer Journey», §17 «Открытые вопросы» |

---

## 1. Контекст и проблема

Текущий флоу `/flow/intro` (9 полей) → `/flow/flood` (6 полей) — это две классические длинные формы с лейблами и инпутами. Наблюдаемые проблемы:

- **Когнитивная перегрузка**: клиент видит сразу 9 пустых полей на экране — типичная reaction «закрою и позвоню оператору».
- **Недостаточная мотивация заполнять**: нет ощущения прогресса, не понятно, зачем спрашивают площадь и год ремонта.
- **Слабый персонажный тон**: в стрессовой ситуации (квартиру залило) сухая форма раздражает.
- **Поля типа «Что произошло?» (textarea)** часто заполняются одной строкой — потому что нет наводящих вопросов.

Конкуренты в страховании (Lemonade Maya, Lassie, Trōv) и российские (Тинькофф-страхование «помощник», Mafin) используют conversational UX и показывают drop-off снижается на 15–30% против длинных форм, время заполнения растёт на ~10% но completion rate выше.

## 2. Цель

Заменить две статичные формы на единый чат-флоу, в котором:
- бот ведёт пользователя по тем же обязательным полям, что и сейчас, но **по одному вопросу за раз**;
- пользователь видит «диалог», а не «форму»;
- сохраняется вся текущая валидация и совместимость с `localStorage.claim_draft` (без изменений в downstream-страницах `/flow/camera`, `/flow/review`).

### Метрики успеха (через 4 недели A/B vs. текущая форма)

| Метрика | Текущее | Цель |
|---|---|---|
| Completion rate (intro+flood → camera) | baseline | **+10 п.п.** |
| Доля бросивших на intro | baseline | **−15%** |
| Средняя длина `incident_description` | ~40 симв. | **≥ 90 симв.** |
| Среднее время прохождения intro+flood | baseline | **≤ +15%** (рост допустим) |
| CSAT шага «расскажите о событии» | baseline | **+0.4** |

## 3. Референсы

| Скрин | Что забираем |
|---|---|
| Lemonade «What's the address you'd like to insure?» | Структура: **вопрос сверху → ответ-«пузырь» справа → карандашик для редактирования**, фон — бесшовный (без border-обводок чата) |
| Lemonade «What kind of property is it?» | **Choice cards** с иконкой + текстом для категорий — используем для `event_type`, `finish_level`, `wall_material`, `ceiling_height`, `has_uk_act` |
| Lemonade «Burglar alarm / Security camera» | Multi-select cards с галочкой — на нашем флоу не нужны (нет multi-select), но визуальный язык забираем |
| Reso ОСАГО | **«Авто-подсказки» как сообщение бота** — на нашем кейсе DaData address suggestions выводим как inline-сообщение бота: *«Вы имели в виду: Москва, ул. Ленина, 5?»* — кнопка «Да» / «Другой адрес» |

## 4. Scope

### В Scope MVP

- Новый роут `/flow/chat` — единая страница, заменяющая `intro` + `flood` для `event_type=flood`.
- Сценарий-скрипт ведёт по 9 полям intro + 6 полям flood (см. §6).
- Branching на `event_type`: если `flood` — продолжаем сценарий flood, иначе — отдаём в `/thank-you` (как сейчас).
- Полная совместимость со схемой `DraftState` в `localStorage` — никаких миграций.
- Адресный автокомплит (DaData) — как inline confirm от бота.
- Редактирование любого ответа кликом по карандашу: возврат к шагу с pre-filled значением.
- Прогресс-бар сверху (как сейчас, зелёный Sber `#21A038`).
- Кнопка «Завершить позже» (drop-out → `/thank-you?abandoned=1`) — сохраняется.

### Вне Scope MVP (отдельные RDP)

- Замена `/flow/camera` и `/flow/review` — остаются прежними.
- LLM-driven диалог (свободный ввод вместо choice cards) — пока сценарий **скриптованный**, без ИИ-парсинга.
- Голосовой ввод.
- Поддержка `event_type ≠ flood` (fire, theft, natural) развёрнутым чат-флоу — пока остаётся короткий «упрощённый флоу».

## 5. Маппинг полей → вопросов чата

Источник правды по обязательности и валидации — текущие [intro/page.tsx:129-137](proto/app/flow/intro/page.tsx#L129-L137) и [flood/page.tsx:78-87](proto/app/flow/flood/page.tsx#L78-L87).

### Блок A — Intro (Шаг 1 из 5)

| # | Поле | Вопрос бота | UI ответа | Обязат. | Валидация |
|---|---|---|---|---|---|
| A1 | `name` | «Здравствуйте! Я помогу оформить событие. Как к вам обращаться? Назовите ФИО полностью.» | text input | ✓ | непустое |
| A2 | `phone` | «Спасибо, {имя}! По какому номеру с вами связаться?» | tel input, маска `+7 (___) ___-__-__` | ✓ | 10 цифр после +7 |
| A3 | `address` (+ авто-`region`) | «Введите адрес объекта — улица, дом, квартира.» | text input + DaData suggestions как **сообщения бота** под вопросом | ✓ | непустое |
| A3.1 | (confirm) | «Вы имели в виду: *Москва, ул. Ленина, 5, кв. 12*?» | choice cards: «Да, верно» / «Другой адрес» | — | если «другой» → возврат к A3 |
| A4 | `apartment_area_m2` | «Какая площадь квартиры в м²? *(опционально, поможет точнее посчитать)*» | numeric input + кнопка «Пропустить» | ✗ | 5–2000 либо пусто |
| A5 | `last_renovation_year` | «В каком году делали последний ремонт?» | numeric / year picker + «Пропустить» | ✗ | 1950 – текущий год |
| A6 | `finish_level` | «Какой уровень отделки в квартире?» | 4 choice cards с описаниями (эконом / стандарт / комфорт / премиум) — иконка + 1-строчное пояснение | ✓ | из списка |
| A7 | `event_type` | «Что произошло?» | 4 choice cards с иконками: 💧 Залив · 🔥 Пожар · 🔓 Кража · 🌪️ Стихия | ✓ | из списка |

**Регион берётся автоматически из адреса** (см. §5.4) — пользователь не выбирает регион вручную.

**Свободное описание `incident_description`** теперь специфично по ветке (см. §5.5–§5.7) — нет универсального textarea.

**Branching после A7:**
- `flood` → блок B (см. §5.3)
- `fire` → блок C (см. §5.5)
- `theft` → блок D (см. §5.6)
- `natural` → блок E (см. §5.7)

### 5.3 Блок B — Flood (Шаг 2 из 5)

| # | Поле | Вопрос бота | UI | Обязат. | Валидация |
|---|---|---|---|---|---|
| B0 | `incident_description` | (3 уточнения, см. §6.2 — для flood остаётся compound) | compound | ✓ | склейка ≥ 90 симв. |
| B1 | `event_date` | «Когда произошёл залив?» | choice cards: «Сегодня» / «Вчера» / «Раньше» → date picker | ✓ | ≤ сегодня |
| B2 | `floor` | «На каком этаже ваша квартира?» | numeric input | ✓ | 1–100 |
| B3 | `affected_area_m2` | «Какая суммарная площадь повреждений по всем комнатам? Это м² пола / стен / потолка, где видны следы воды.» | numeric input | ✓ | > 0 |
| B4 | `ceiling_height` | «Какая высота потолков?» | choice cards: 2.5 м · 2.7 м · 3.0 м · «Другая» | ✓ | если «другая» → 2–6 м |
| B5 | `wall_material` | «Из чего построен дом?» | 4 choice cards с иконками: панель / кирпич / монолит / гипсокартон | ✓ | из списка |
| B6 | `has_uk_act` | «Получили акт от управляющей компании?» | 2 choice cards: «Да, есть» / «Нет, ещё не оформили» | ✓ | bool |
| — | (CTA) | «Готово! Теперь сделаем фотографии повреждений» | кнопка «Перейти к камере» → `/flow/camera` | — | — |

### 5.4 Авто-извлечение `region` из адреса

DaData возвращает в каждом suggest-объекте поля `data.region_kladr_id` и `data.region_iso_code` (например `RU-MOW`, `RU-SPE`, `RU-KDA`). Поскольку наш `regionData.regions` уже использует короткие ключи (`moscow`, `spb`, `krasnodar`, …), нужна **таблица соответствий** `lib/regionMap.ts`:

```ts
const regionMap: Record<string, string> = {
  'RU-MOW': 'moscow',
  'RU-MOS': 'moscow_oblast',
  'RU-SPE': 'spb',
  'RU-LEN': 'leningrad_oblast',
  // … остальные регионы из data/region_coefficients.json
}
```

Логика:
1. После confirm адреса (A3.1 = «Да, верно») берём первый suggest и читаем `data.region_iso_code`.
2. `draft.intro.region = regionMap[isoCode] ?? 'moscow'` (fallback с warning).
3. Если регион не нашёлся в карте — пишем `'moscow'`, логируем событие `region_map_miss(isoCode, query)` для пополнения карты.

**Никакого вопроса про регион в чате нет** — это техническое поле, проставляется автоматически. Если пользователь начинает редактировать адрес (✏️) — `region` пересчитывается заново.

### 5.5 Блок C — Fire (event_type = fire)

| # | Поле | Вопрос бота | UI | Обязат. | Валидация |
|---|---|---|---|---|---|
| C1 | `fire.event_date` | «Когда произошёл пожар?» | choice cards: «Сегодня» / «Вчера» / «Раньше» → date picker | ✓ | ≤ сегодня |
| C2 | `fire.fire_source` | «Где, по вашему мнению, начался пожар?» | choice cards: «Кухня» / «Электропроводка» / «От соседей» / «Другое» / «Не знаю» | ✓ | из списка |
| C3 | `fire.mchs_called` | «Вызывали МЧС?» | choice cards: «Да, есть протокол» / «Да, без протокола» / «Нет» | ✓ | enum |
| C4 | `fire.mchs_protocol_number` | «Введите номер протокола МЧС *(если есть на руках)*» | text input + «Пропустить» | если C3 = «есть протокол» → ✓ | непустое |
| C5 | `fire.incident_description` | «Опишите коротко, что пострадало.» | textarea single | ✓ | ≥ 30 симв. |
| — | (CTA) | «Передаём заявку эксперту. С вами свяжутся в течение часа по телефону {phone}.» | финальный экран → `/thank-you` | — | — |

### 5.6 Блок D — Theft (event_type = theft)

| # | Поле | Вопрос бота | UI | Обязат. | Валидация |
|---|---|---|---|---|---|
| D1 | `theft.event_date` | «Когда вы обнаружили взлом / пропажу?» | choice cards + date picker | ✓ | ≤ сегодня |
| D2 | `theft.entry_method` | «Как преступники проникли в квартиру?» | choice cards: «Дверь» / «Окно» / «Балкон» / «Не знаю» / «Другое» | ✓ | из списка |
| D3 | `theft.police_filed` | «Подали заявление в полицию?» | choice cards: «Да, есть КУСП» / «Да, ещё ждём» / «Нет» | ✓ | enum |
| D4 | `theft.kusp_number` | «Введите номер КУСП *(если есть)*» | text input + «Пропустить» | если D3 = «есть КУСП» → ✓ | непустое |
| D5 | `theft.incident_description` | «Что пропало или повреждено? Перечислите коротко.» | textarea single | ✓ | ≥ 30 симв. |
| — | (CTA) | (как в C) — `/thank-you` | — | — | — |

### 5.7 Блок E — Natural disaster (event_type = natural)

| # | Поле | Вопрос бота | UI | Обязат. | Валидация |
|---|---|---|---|---|---|
| E1 | `natural.event_date` | «Когда произошло происшествие?» | choice cards + date picker | ✓ | ≤ сегодня |
| E2 | `natural.disaster_type` | «Что случилось?» | choice cards: «Ураган / сильный ветер» / «Град» / «Падение дерева» / «Удар молнии» / «Наводнение / паводок» / «Другое» | ✓ | из списка |
| E3 | `natural.affected_zones` | «Что пострадало?» **(можно выбрать несколько)** | multi-select cards: «Фасад» / «Окна, остекление» / «Крыша» / «Двор / прилегающая территория» / «Внутри квартиры» | ✓ | ≥ 1 |
| E4 | `natural.incident_description` | «Опишите подробнее, какой ущерб видите.» | textarea single | ✓ | ≥ 30 симв. |
| — | (CTA) | (как в C) — `/thank-you` | — | — | — |

### 5.8 Расширение `DraftState` для не-flood веток

В `types/index.ts` добавляем три опциональных блока к `DraftState.intro`:

```ts
interface DraftState {
  intro?: {
    // ... существующие поля
    fire?: {
      event_date?: string
      fire_source?: 'kitchen' | 'wiring' | 'neighbors' | 'other' | 'unknown'
      mchs_called?: 'with_protocol' | 'without_protocol' | 'no'
      mchs_protocol_number?: string
      incident_description?: string
    }
    theft?: {
      event_date?: string
      entry_method?: 'door' | 'window' | 'balcony' | 'unknown' | 'other'
      police_filed?: 'with_kusp' | 'pending' | 'no'
      kusp_number?: string
      incident_description?: string
    }
    natural?: {
      event_date?: string
      disaster_type?: 'wind' | 'hail' | 'tree_fall' | 'lightning' | 'flood_natural' | 'other'
      affected_zones?: ('facade' | 'windows' | 'roof' | 'yard' | 'interior')[]
      incident_description?: string
    }
  }
  flood?: { /* без изменений */ }
}
```

`incident_description` для не-flood — единственный textarea (а не compound), поскольку у каждой ветки уже есть структурированные поля выше.

## 6. Сценарий и динамика

### 6.1 Анатомия сообщения

```
┌─ Bot question ──────────────────────┐
│  [avatar] Какой уровень отделки?    │
│                                     │
│  [card] [card] [card] [card]        │  ← inline UI control
└─────────────────────────────────────┘
                        ┌─ User answer ──┐
                        │  [✏️] Стандарт │  ← pencil = edit, click → возврат к шагу
                        └────────────────┘
```

- Аватар бота — Sber-зелёный круг с символом «С» (или иконкой стрелки) в шапке-сообщения. **Не показываем** аватар повторно для серий сообщений от бота.
- «Пузырь ответа» выровнен **справа**, нейтральный серый `#F1F3F5`, без обводки.
- Карандаш `✏️` — слева от ответа, появляется при наведении на десктопе и **всегда видим на мобилке** (как у Lemonade).
- Между сообщениями `gap: 12px`, между блоком вопроса и блоком ответа `gap: 8px`.

### 6.2 Раскрытие свободного описания (только для flood — B0)

Только в flood-ветке `incident_description` собирается **compound** — 3 коротких уточняющих вопроса вместо одного textarea:

1. **«Когда вы заметили залив?»** *(одна строка)*
2. **«Откуда пошла вода — сверху, из своей квартиры, не знаете?»** *(choice cards: «Сверху от соседей» / «Своя квартира — труба, кран, стиралка» / «Не знаю» / «Другое — описать»)*
3. **«Что больше всего пострадало?»** *(одна строка)*

Итог: `incident_description = "Заметил {B0.1}. Источник: {B0.2}. Пострадало: {B0.3}."` — стабильно ≥ 90 символов, структурированный текст для downstream AI-pipeline.

Для **fire / theft / natural** `incident_description` собирается одним textarea (см. C5/D5/E4) — у этих веток уже есть структурированные специфичные поля выше, дополнительные уточнения избыточны.

### 6.3 Edit-flow

Клик на ✏️ у любого ответа:
1. Сообщение «свернуть» в режим редактирования: ответ становится снова active question.
2. Все последующие сообщения **остаются видимыми, но «затемнены»** (opacity 0.4) — UX: «вы редактируете прошлый шаг, дальше всё помним».
3. После подтверждения нового значения:
   - Если правка совместима (поменяли name) → восстанавливаем все следующие.
   - Если правка **меняет ветку** (поменяли `event_type` с flood на fire) → отбрасываем все ответы блока B с подтверждением: «Вы изменили тип события. Ответы про залив будут сброшены. Продолжить?»

### 6.4 Авто-сейв и возврат

- На каждое подтверждённое сообщение — `saveDraft()` в `localStorage.claim_draft` (как сейчас).
- При перезагрузке: восстанавливаем чат-историю из `draft.intro` + `draft.flood`, проигрывая все известные пары «вопрос-ответ» **мгновенно** (без анимации typing), и продолжаем с первого незаполненного поля.
- Идентификатор шага сохраняется в `draft.current_step` (новые значения: `chat:intro` / `chat:flood`).

### 6.5 Прогресс

- Шапка та же (sticky, Sber-зелёная полоска).
- Прогресс = `filled_required / total_required`. Total для `flood`-ветки = 13 (8 intro + 5 flood, без опц.); для иных событий = 8.
- Подпись: «Шаг 1 из 5 — Чат-помощник» (счёт шагов остаётся как у текущего флоу — этот чат покрывает шаги 1–2 из 5).

### 6.6 Анимация и тайминг

- При появлении нового сообщения бота — **typing-индикатор** «...» 400 мс, затем сообщение появляется через `fade+slide-up 200мс`.
- После ответа пользователя — **delay 250 мс** перед typing-индикатором следующего вопроса. Это создаёт ощущение разговора, но не раздражает (тестировать в QA).
- Все анимации можно отключить пользователем через `prefers-reduced-motion` (медиазапрос).
- Скролл — авто к последнему сообщению при появлении нового; при ручном скролле вверх блокируем авто-скролл, показываем кнопку «↓ Новое сообщение».

## 7. Архитектура

### 7.1 Файлы

```
proto/
├─ app/flow/chat/
│  └─ page.tsx                  ← новый роут
├─ components/chat/
│  ├─ ChatContainer.tsx         ← скролл, история, typing
│  ├─ BotMessage.tsx
│  ├─ UserMessage.tsx           ← включает кнопку ✏️
│  ├─ ChoiceCards.tsx           ← cards с иконкой + label
│  ├─ TextInput.tsx             ← inline поле ввода под последним вопросом
│  ├─ AddressInput.tsx          ← обёртка с DaData suggestions
│  └─ TypingIndicator.tsx
├─ lib/chat/
│  ├─ script.ts                 ← decларативный сценарий: массив Step[]
│  ├─ engine.ts                 ← state machine: текущий шаг, history, edit
│  └─ validators.ts             ← переиспользуем из текущих pages
└─ types/chat.ts                ← типы Step, Answer, Message
```

### 7.2 Модель данных скрипта (`script.ts`)

```ts
type Step =
  | { kind: 'text'; id: string; field: string; question: string; placeholder?: string;
      validate: (v: string) => string | null; optional?: boolean }
  | { kind: 'choice'; id: string; field: string; question: string;
      options: { value: string; label: string; icon?: ReactNode; hint?: string }[] }
  | { kind: 'address'; id: string; field: string; question: string }
  | { kind: 'date'; id: string; field: string; question: string;
      shortcuts: { label: string; value: () => string }[] }
  | { kind: 'numeric'; id: string; field: string; question: string;
      min?: number; max?: number; suffix?: string; optional?: boolean }
  | { kind: 'compound'; id: string; field: string;       // для A9
      subSteps: Step[]; combine: (answers: Record<string,string>) => string }
  | { kind: 'branch'; id: string; condition: (state: ChatState) => string /* nextStepId */ }
```

Скрипт — это **массив Step[]**. Engine идёт по нему линейно, branch-step выбирает следующий id. Легко тестировать, просто менять порядок и тексты.

### 7.3 State machine (`engine.ts`)

```ts
interface ChatState {
  history: Message[];           // что отрисовано
  answers: Record<string, any>; // field → value (= то, что пишем в DraftState)
  currentStepId: string;
  editingMessageId?: string;    // если правим прошлый ответ
}
```

Действия: `submitAnswer`, `editMessage(id)`, `cancelEdit`, `goToStep(id)`.

После каждого `submitAnswer` — `mapAnswersToDraft(state.answers)` и `localStorage.setItem('claim_draft', ...)`.

### 7.4 Совместимость с DraftState

Никаких изменений в `types/index.ts`. Маппинг `chat.answers → draft.intro / draft.flood` делает функция `mapAnswersToDraft`, повторяющая логику из текущих `saveDraft()` обоих файлов:

- Phone: `normalizePhoneDigits(answers.phone)`
- Numeric: `parseFloat(answers.apartment_area_m2) || undefined`
- Booleans: `answers.has_uk_act === 'yes'`
- Compound A9: `combine(answers.A9_subSteps) → answers.incident_description`

После последнего шага `current_step = 'camera'`, и `router.push('/flow/camera')`.

## 8. Визуальный язык

| Элемент | Спека |
|---|---|
| Фон страницы | `#f5f6f7` (как сейчас) |
| Сообщение бота | без bubble, шрифт `font-display` (как заголовки), 16/22 px, цвет `#0F172A` |
| Аватар бота | **AI-сгенерированный портрет** «оператор Светлана» в круге 32px (24px в pretitle), фон `bg-white border` 1px `#E5E7EB`. Стиль: дружелюбное профессиональное фото в Sber-зелёных тонах одежды, neutral background. Источник: Midjourney/SDXL → проверка PR/Legal на AI-disclosure → CDN. Иметь fallback в виде зелёного круга `#21A038` с буквой «С» если изображение не загрузилось. |
| Подпись бота | имя **«СберПомощник»** (без личного имени, по бренд-гайду), цвет `#6B7280`, 12px — **только перед первым сообщением серии** |
| Сообщение пользователя | bubble `bg-[#F1F3F5]`, radius 18px, padding 10/14, max-width 75% |
| Карандаш ✏️ | 16px, цвет `#9CA3AF`, в круге `bg-white border` 28px, слева от bubble, gap 8px |
| Choice card | `bg-white`, border 1px `#E5E7EB`, radius 16px, padding 14/16, иконка 32px слева, label 16/22 — выбранная карточка → `bg-[#F0FDF4]` `border-[#21A038]` |
| Multi-select | (не используем в MVP) |
| Кнопка «Готово / Перейти» | как сейчас — Sber-зелёная primary, radius 16, sticky bottom |
| Typing-индикатор | 3 точки, gray-400, мягкая bounce-анимация 1.2s |

## 9. Edge cases

| Кейс | Поведение |
|---|---|
| Пользователь молчит 30 сек после вопроса | бот добавляет под-сообщение «Если запутались — нажмите ✏️ на любом ответе, чтобы изменить» (один раз за сессию) |
| Сетевая ошибка DaData | бот: «Не получилось проверить адрес. Введите вручную: город, улица, дом, квартира.» |
| Пользователь вводит чушь в текстовом поле (5 раз подряд кликает «Готово» с пустым) | через 3 попытки: бот предлагает «Завершить позже» с явной кнопкой |
| `prefers-reduced-motion: reduce` | typing-индикатор → 100 мс, без animations, без auto-scroll smooth |
| Возврат через `Назад` в браузере на середине чата | сохраняем state в localStorage, при возврате восстанавливаем последний шаг |
| Размер экрана < 360px | choice cards в одну колонку (как у Lemonade в узком режиме) |
| Edit `event_type` с flood → fire | confirm dialog, после подтверждения сбрасываем `draft.flood` целиком |

## 10. Доступность

- Каждое сообщение бота — `<div role="status" aria-live="polite">` чтобы screen reader проговаривал.
- Choice cards — `<button>` с `aria-pressed`, фокус-кольцо явное.
- Typing-индикатор — `aria-label="Помощник печатает..."`.
- ✏️ — `aria-label="Изменить ответ: {field-label}"`.

## 11. Аналитика (события для текущего трекера)

Дополняем существующий event-stream:

| Событие | Параметры |
|---|---|
| `chat_started` | `entry_point` (intro\|deep_link) |
| `chat_question_shown` | `step_id`, `field` |
| `chat_answer_submitted` | `step_id`, `field`, `time_to_answer_ms`, `is_edit` |
| `chat_edit_clicked` | `step_id` |
| `chat_validation_failed` | `step_id`, `error_code` |
| `chat_branch_taken` | `from_step`, `to_step`, `reason` (e.g. `event_type=fire`) |
| `chat_completed` | `total_time_ms`, `total_edits`, `branch` (flood\|other) |
| `chat_abandoned` | `last_step_id` |

## 12. План миграции и rollout

### Фаза 1 — Build (Спринт 1, 1 неделя)
- Скаффолд `/flow/chat` с фиксированным контентом (без редактирования и анимаций).
- Engine с линейным проходом по сценарию.
- Маппинг answers → DraftState.
- Внутреннее тестирование.

### Фаза 2 — UX-полировка (Спринт 2, 1 неделя)
- Анимации, typing, edit-flow, error states.
- DaData как сообщения бота.
- A11y-проверка.

### Фаза 3 — A/B (Спринт 3–4)
- Feature-flag `chat_flow_enabled`. На главной странице 50/50 split: половина → `/flow/intro`, половина → `/flow/chat`.
- Метрики (см. §2). Если completion rate ≥ baseline и метрики §2 в зелёной зоне — выкатываем на 100%, депрекейтим `/flow/intro` и `/flow/flood` (оставляем редиректами 30 дней).

### Фаза 4 — Cleanup
- Удаление `intro/page.tsx` и `flood/page.tsx`.
- Перенос документации шага «1 из 5» на `/flow/chat`.

## 13. Риски

| Риск | Митигация |
|---|---|
| Чат ощущается «медленнее» формы | typing-индикатор ≤ 400 мс, возможность скипнуть анимацию долгим тапом на ответ — UX-тест на 5 пользователях до A/B |
| Пользователь вводит мусор в свободные поля | в A9 заменили textarea на 3 структурированных под-вопроса |
| Engine state становится сложным после нескольких edit | Step[] декларативный, history линейная — все правки тестируются property-based тестами |
| Падает DaData | fallback на ручной ввод (см. §9) |
| Регресс existing flow | route `/flow/intro` остаётся работающим до фазы 4 — A/B по флагу |

## 14. Решённые вопросы и оставшийся бэклог

### Зафиксировано (продуктовые решения от 26.04.2026)

- ✅ **Тон бота.** «СберПомощник», без имени-человека, без эмодзи. Нейтрально-деловой тон.
- ✅ **`apartment_area_m2` и `last_renovation_year`.** Включаем в чате как **опциональные** с явной кнопкой «Пропустить» (поля A4 и A5).
- ✅ **Регион.** Пользователь не выбирает — берём автоматически из DaData по адресу (см. §5.4).
- ✅ **Аватар.** AI-сгенерированный портрет «оператор» в Sber-стилистике (см. §8). Fallback — зелёный круг с «С».
- ✅ **`event_type ≠ flood`.** Короткие специализированные ветки по 4–5 вопросов на каждую (fire / theft / natural — см. §5.5–§5.7), затем `/thank-you`.
- ✅ **Дизайн-токены.** `sber.green` уже зашит в `tailwind.config.ts`. `font-display` подтянем из существующих pages при скаффолде. Дополнительные токены (`bg-bot-bubble`, `border-card`) добавляем в config в Фазу 1.

### Открытые задачи перед билдом

1. **`regionMap.ts`.** Нужно сгенерировать таблицу `RU-XXX → key из data/region_coefficients.json` для всех ~85 регионов РФ. Можно полу-автоматизировать скриптом по списку ISO-кодов и `regions[*].name`. Owner: backend.
2. **AI-портрет бота.** Сгенерировать 3–5 вариантов в Midjourney/SDXL → согласовать с PR (AI-disclosure при необходимости) и Legal (использование в продакшене). Owner: дизайн + юр. Срок: до старта Фазы 2.
3. **Multi-select cards (для E3).** В текущем UI multi-select cards нет (есть только single-choice в Lemonade-референсе). Спроектировать паттерн: галочка в углу карты, активная карта `bg-[#F0FDF4] border-[#21A038]`, нижняя кнопка «Готово» появляется при ≥1 выборе. Owner: дизайн.
4. **`fire.fire_source = 'neighbors'`.** Если пожар «от соседей» — нужны ли дополнительные уточнения (этаж, контакт)? Решить до Фазы 1 или оставить в `incident_description`.
5. **Перевод существующих black-out текстов.** Все текущие placeholders / labels в [intro/page.tsx](proto/app/flow/intro/page.tsx) и [flood/page.tsx](proto/app/flow/flood/page.tsx) переписать в реплики бота — копирайтинг под Sber tone-of-voice (1 итерация ревью с PO).

## 15. Definition of Done

- `/flow/chat` собирает ровно те же 9 + 6 полей, что и старые формы, и пишет их в тот же `draft.intro` / `draft.flood`.
- Старые `/flow/intro`, `/flow/flood` работают параллельно (для feature-flag и A/B).
- Все валидации из §5 покрыты unit-тестами.
- Edit любого ответа работает, ветвление при смене `event_type` — с confirm.
- Lighthouse Mobile Performance ≥ 85, A11y = 100.
- Мобильный safari iOS 16+, Chrome Android — визуально совпадают со скетчами.
- Метрики из §11 пишутся в текущий event stream.