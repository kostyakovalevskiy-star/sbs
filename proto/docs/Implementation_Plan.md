# Implementation Plan — Claim Assistant Prototype

## Overview
Прототип мобильного веб-приложения для самостоятельной фиксации страхового события (залив квартиры): пользователь отвечает на вопросы, снимает повреждения на камеру смартфона, получает AI-оценку ущерба со сметой в PDF. Целевая аудитория — 5–10 знакомых для сбора обратной связи по UX и качеству оценки. Стек: Next.js 15 (App Router) + TypeScript + Tailwind + shadcn/ui + Anthropic API (claude-sonnet-4-6) + Vercel KV, деплой на Vercel.

---

## Success Criteria
- [x] Все задачи завершены
- [x] `npm run build` проходит без ошибок
- [x] `npm run lint` без ошибок
- [ ] Приложение открывается на мобильном браузере (iOS Safari / Android Chrome)
- [ ] Пользователь проходит полный флоу «залив» от приветствия до PDF-отчёта
- [ ] Камера запускается на телефоне, фото нерезкое отклоняется
- [ ] Claude возвращает валидный JSON с оценкой
- [ ] PDF скачивается и содержит смету
- [ ] Админ-панель `/admin` закрыта паролем, калибровка сохраняется
- [x] EXIT_SIGNAL: true

---

## Tasks

### Task 1: Project Scaffold
**Priority:** 1
**Description:**
Инициализировать проект с нуля. Создать `package.json` с зависимостями, настроить Next.js 15 App Router, TypeScript, Tailwind CSS, shadcn/ui, ESLint. Создать базовые конфиги: `next.config.ts`, `tsconfig.json`, `tailwind.config.ts`, `postcss.config.mjs`, `components.json`. Добавить `.gitignore` (исключить `.env.local`, `.next/`, `node_modules/`). Создать `.env.example` с описанием всех 4 переменных окружения. Создать `app/globals.css` с импортом Tailwind и CSS-переменными shadcn/ui. Создать `app/layout.tsx` — корневой layout с `<html lang="ru">`, подключением шрифта Inter, `<body>`. Убедиться что `npm run dev` стартует без ошибок на `localhost:3000`.

**Acceptance Criteria:**
- `npm run dev` запускается, localhost:3000 отдаёт 200
- `npm run build` проходит чисто
- TypeScript strict mode включён
- Tailwind работает (класс `bg-green-600` применяется)
- shadcn/ui CLI инициализирован, компоненты можно добавлять через `npx shadcn-ui add`
- `.env.example` содержит `ANTHROPIC_API_KEY`, `ADMIN_PASSWORD`, `KV_REST_API_URL`, `KV_REST_API_TOKEN`

**Test:**
1. Запустить `npm install` — 0 ошибок
2. Запустить `npm run dev`, открыть `localhost:3000` — страница рендерится
3. Запустить `npm run build` — завершается успешно
4. Запустить `npm run lint` — 0 ошибок
5. Добавить `npx shadcn-ui add button`, импортировать `Button` в `app/page.tsx` — кнопка рендерится

---

### Task 2: TypeScript Types
**Priority:** 2
**Description:**
Создать файл `types/index.ts` со всеми интерфейсами проекта. Обязательные типы:

- `IncidentContext` — все поля контекста инцидента: `id: string`, `name: string`, `phone: string`, `region: string`, `address: string`, `apartment_area_m2: number`, `last_renovation_year: number`, `event_type: 'flood' | 'fire' | 'theft' | 'natural'`, плюс для залива: `floor: number`, `source_floor: number`, `event_date: string`, `affected_area_m2: number`, `ceiling_height: 2.5 | 2.7 | 3.0 | number`, `finish_level: 'economy' | 'standard' | 'improved' | 'premium'`, `wall_material: 'panel' | 'brick' | 'monolith' | 'drywall'`, `has_ук_act: boolean`
- `PhotoMeta` — `base64: string`, `exif: ExifData | null`, `laplacianVariance: number`, `filename?: string`
- `ExifData` — `date?: string`, `gps?: { lat: number; lon: number }`, `model?: string`
- `ClaudePhotoAnalysis` — поля одного фото: `damage_class`, `surface`, `material_predicted`, `area_estimate_m2`, `severity`, `confidence`, `sub_findings`
- `ClaudeOutput` — `photos: ClaudePhotoAnalysis[]`, `recommended_works: string[]`, `summary: string`, `average_confidence: number`
- `WorkItem` — `code: string`, `name: string`, `unit: string`, `volume: number`, `unit_price: number`, `total: number`
- `MaterialItem` — аналогично
- `Report` — `range: { min: number; base: number; max: number }`, `works: WorkItem[]`, `materials: MaterialItem[]`, `sigma: number`, `routed_to_expert: boolean`, `claude_output: ClaudeOutput`
- `CaseRecord` — `id: string`, `created_at: string`, `context: IncidentContext`, `report: Report | null`, `photos_count: number`, `status: 'complete' | 'expert'`
- `CalibrationConfig` — все 11 весов из `calibration_defaults.json`
- `WorkCatalogEntry`, `MaterialCatalogEntry`, `RegionCoefficients` — структуры справочников

**Acceptance Criteria:**
- Все интерфейсы экспортируются из `types/index.ts`
- Нет `any` типов
- TypeScript компилирует без ошибок
- Все поля из PRD секций 3, 4, 5 покрыты типами

**Test:**
1. Импортировать любой тип в `app/page.tsx` — компилируется без ошибок
2. Создать объект `IncidentContext` с неправильным `event_type: 'earthquake'` — TypeScript должен выдать ошибку
3. Запустить `npm run build` — 0 ошибок типов

---

### Task 3: Lib — utils.ts, kv.ts
**Priority:** 3
**Description:**
Создать два базовых вспомогательных модуля:

**`lib/utils.ts`:**
- `cn(...classes)` — утилита для Tailwind className merge (использует `clsx` + `tailwind-merge`)
- `formatRub(amount: number): string` — форматирует число как `₽ 123 456`
- `clamp(value: number, min: number, max: number): number`
- `generateId(): string` — `crypto.randomUUID()` или nanoid

**`lib/kv.ts`:**
- Экспортирует `getKV(key: string)`, `setKV(key: string, value: unknown)`, `listKV(prefix: string)`
- Если `KV_REST_API_URL` задан — использует `@upstash/redis` через REST API
- Если не задан — использует in-memory `Map` (для локальной разработки без Vercel KV)
- Типизирован: `getKV<T>(key: string): Promise<T | null>`

**Acceptance Criteria:**
- `formatRub(125000)` возвращает `₽ 125 000`
- `clamp(150, 0, 100)` возвращает `100`
- При отсутствии `KV_REST_API_URL` `kv.ts` не бросает ошибку, работает через in-memory Map
- `setKV` + `getKV` с одним ключом возвращает то же значение

**Test:**
1. Написать короткий тест в `lib/utils.ts` (или вручную проверить в `console.log` в `api/test/route.ts`): `formatRub(125000)` → `₽ 125 000`
2. В `.env.local` убрать `KV_REST_API_URL`, запустить `npm run dev`, выполнить `setKV('test', {a:1})` и `getKV('test')` — возвращает `{a:1}` без ошибок

---

### Task 4: Lib — camera.ts, exif.ts
**Priority:** 3
**Description:**
Создать клиентские библиотеки для работы с камерой и EXIF.

**`lib/camera.ts`** (только клиентская среда, не импортировать в Server Components):
- `startCamera(videoEl: HTMLVideoElement): Promise<MediaStream>` — вызывает `getUserMedia({ video: { facingMode: 'environment' } })`, присваивает `srcObject`
- `stopCamera(stream: MediaStream): void`
- `captureSnapshot(videoEl: HTMLVideoElement, canvasEl: HTMLCanvasElement): ImageData` — `drawImage` → `getImageData`
- `laplacianVariance(imageData: ImageData): number` — вычисляет variance of Laplacian вручную по пиксельным данным (~80 строк, без OpenCV)
- `getBrightness(imageData: ImageData): number` — средняя яркость по Y-каналу (0.299R + 0.587G + 0.114B)
- `resizeTo1600(canvas: HTMLCanvasElement): Promise<Blob>` — сжимает до 1600px по длинной стороне через offscreen canvas, возвращает JPEG blob
- `blobToBase64(blob: Blob): Promise<string>`

**`lib/exif.ts`:**
- `parseExif(file: File | Blob): Promise<ExifData | null>` — обёртка над `exifr.parse()`, извлекает дату, GPS, модель камеры
- Graceful fallback — если exifr бросает исключение или поля отсутствуют, возвращает `null`

**Acceptance Criteria:**
- `laplacianVariance` для чёрного изображения 100×100 возвращает 0
- `laplacianVariance` для изображения с резкими краями возвращает значение > 80
- `getBrightness` для белого изображения возвращает значение близкое к 255
- `resizeTo1600` для изображения 3200×2400 возвращает blob с длинной стороной 1600px
- `parseExif` не бросает исключение для JPEG без EXIF данных

**Test:**
1. На странице `/flow/camera` нажать кнопку «Снять» — камера открывается на мобильном устройстве
2. Сфотографировать размытый объект — toast «Фото нерезкое», фото не добавляется
3. Сфотографировать резкий объект — фото добавляется в список
4. Загрузить JPEG с GPS из галереи — `parseExif` вернул координаты (проверить в console.log)

---

### Task 5: Lib — calculator.ts
**Priority:** 4
**Description:**
Реализовать функцию расчёта сметы `lib/calculator.ts`.

Сигнатура: `calculate(claudeOutput: ClaudeOutput, context: IncidentContext, calibration: CalibrationConfig, catalogs: { works: WorkCatalogEntry[], materials: MaterialCatalogEntry[], regions: RegionCoefficients }): Report`

Алгоритм (строго по PRD секция 5):
1. Вычислить геометрию: `S = context.affected_area_m2`, `h = calibration.default_ceiling_height_m`, периметр `P = 2 * Math.sqrt(S * 1.2)`, площадь стен `S_walls = P * h - 2.0`
2. Для каждого кода работы из `claudeOutput.recommended_works`:
   - Найти запись в `catalogs.works`
   - Вычислить объём функцией `computeVolume(code, S, S_walls, P, claudeOutput)`
   - Применить региональный коэффициент и коэффициент отделки
   - Рассчитать `unit_price` и `total`
3. Вычислить материалы по нормам расхода из справочника
4. Применить физический износ по ВСН 53-86(р) если `calibration.wear_apply`: `wearK = Math.min(1, age / m.service_life_years)`, `m.total *= (1 - wearK)`
5. Сумма работ + материалов = `base`
6. Скидка при `average_confidence < 0.6`: умножить на `calibration.vision_low_confidence_discount`
7. Диапазон: `min = base * (1 - sigma)`, `max = base * (1 + sigma)`
8. `routed_to_expert = base > calibration.stp_threshold_rub`
9. Округлить все суммы до рублей

**Acceptance Criteria:**
- При передаче пустого `recommended_works = []` возвращает `base = 0`
- Физический износ корректно снижает итог при `wear_apply: true` и `age > 0`
- Региональный коэффициент 1.3 увеличивает итог на 30% относительно базы
- `routed_to_expert` = true при базе > порога STP
- Все числа в `WorkItem.total` и `MaterialItem.total` — целые рубли

**Test:**
1. Написать `api/test-calc/route.ts` (только для dev), вызвать `calculate()` с захардкоженным `claudeOutput` и `context` — убедиться что возвращается валидный `Report`
2. Передать `calibration.wear_apply = true`, `last_renovation_year = 2010` — `materials[0].total` меньше чем без износа
3. Передать `average_confidence = 0.5` — `base` уменьшен на `vision_low_confidence_discount`
4. Удалить `api/test-calc/route.ts` после проверки

---

### Task 6: Lib — prompts.ts
**Priority:** 4
**Description:**
Создать `lib/prompts.ts` с системным промптом для Claude и few-shot примерами.

- Константа `SYSTEM_PROMPT: string` — полный системный промпт по шаблону из PRD секция 4, включает: роль эксперта, задачу (6 полей per photo), инструкцию про reference объекты (монета/карта), схему JSON-ответа, запрет выдумывать цены
- Функция `buildUserMessage(context: IncidentContext, photos: PhotoMeta[], workCodes: string[]): MessageParam[]` — формирует массив content blocks для Anthropic API: system prompt + context JSON + 3 few-shot примера + imageBlocks для каждого фото (base64, media_type: 'image/jpeg')
- Константа `FEW_SHOT_CASES: string` — 3 захардкоженных примера в виде JSON-строки:
  1. Жёлтое пятно на потолке кухни ~0.5 м² → антигрибок + грунтовка + покраска потолка
  2. Пятно с плесенью на стене коридора ~3 м² → полный цикл со штукатуркой
  3. Вспучивание ламината в спальне ~6 м² → демонтаж + новый ламинат с подложкой
- Функция `parseClaudeResponse(text: string): ClaudeOutput` — strip markdown-обёртки (```json...```), `JSON.parse`, валидация наличия обязательных полей, бросает `ClaudeParseError` если невалидно

**Acceptance Criteria:**
- `buildUserMessage` возвращает массив с корректным типом для Anthropic SDK
- `parseClaudeResponse('```json\n{"photos":[],...}\n```')` корректно парсит JSON
- `parseClaudeResponse('invalid json')` бросает `ClaudeParseError`
- Системный промпт содержит все 6 обязательных полей анализа фото

**Test:**
1. Импортировать `SYSTEM_PROMPT` в REPL/console — убедиться что строка не пустая и содержит `damage_class`
2. Вызвать `parseClaudeResponse` с валидным и невалидным JSON — поведение соответствует acceptance criteria
3. Вызвать `buildUserMessage` с 3 фото, убедиться что в результате 3 image-блока

---

### Task 7: Lib — pdf.ts
**Priority:** 5
**Description:**
Реализовать генерацию PDF-отчёта в `lib/pdf.ts` на основе `jsPDF` + `jspdf-autotable`.

Функция: `generatePDF(report: Report, context: IncidentContext, photos: string[]): void` — генерирует и скачивает PDF через `doc.save(...)`.

Содержание PDF (строго по Implementation Plan секция PDF):
1. Шапка: текст «Claim Assistant», дата (`new Date().toLocaleDateString('ru-RU')`), номер кейса `context.id`
2. Данные клиента: ФИО, телефон, адрес, регион — в виде таблицы 2 колонки
3. Сводное AI-заключение: текст `report.claude_output.summary` в сером блоке
4. Thumbnails фото: максимум 6 фото, расположение 3 в ряд, `addImage` через base64
5. Таблица работ: колонки «Код», «Наименование», «Ед.», «Объём», «Цена за ед.», «Итого»
6. Таблица материалов: аналогичная структура
7. Строка итога: «Базовая оценка: ₽ XXX XXX» жирным + мелкий текст «до ±15%»
8. Дисклеймер: «Прототип. Данные не передаются в страховую компанию. Оценка носит ориентировочный характер.»

**Acceptance Criteria:**
- PDF скачивается при вызове функции в браузере
- Все 8 секций присутствуют в документе
- Таблицы корректно переносятся на следующую страницу при большом количестве строк
- Числа в таблицах отформатированы через `formatRub()`
- Файл называется `claim-report-{id}.pdf`

**Test:**
1. Временно вызвать `generatePDF` с тестовыми данными на странице `/result/[id]`
2. Открыть скачанный PDF — убедиться что все 8 секций есть
3. Проверить с 10 работами и 13 материалами — таблица не обрезается
4. Проверить с 6 фото — все thumbnails отображаются

---

### Task 8: Data Files — справочники JSON
**Priority:** 3
**Description:**
Создать все 5 справочников в директории `data/`. Это статические данные, которые бандлятся в код.

**`data/question_tree.json`** — дерево вопросов:
- Секция `intro`: 7 вопросов (id, label, type, options если select, required)
- Секция `flood`: 8 вопросов ветки «залив»
- Каждый вопрос: `{ id, label, type: 'text'|'number'|'select'|'date'|'boolean', options?: string[], placeholder?: string }`

**`data/works_catalog.json`** — 35 видов ремонтных работ:
- Каждая запись: `{ code, name, unit, base_price_rub, samples: number[] }`
- Коды по категориям: `DEM-*` (демонтаж), `PREP-*` (подготовка), `LEVEL-*` (выравнивание), `FINISH-*` (финишная отделка), `FLOOR-*` (полы), `PAINT-*` (покраска)

**`data/materials_catalog.json`** — 13 материалов:
- Каждая запись: `{ code, name, unit, base_price_rub, consumption_per_m2, service_life_years, samples: number[] }`

**`data/region_coefficients.json`** — 9 регионов:
- `{ "moscow": { works_coefficient: 1.0, materials_coefficient: 1.0 }, "spb": {...}, ... }`

**`data/calibration_defaults.json`** — дефолтные веса:
- `range_sigma: 0.15`, `finish_economy_factor`, `finish_standard_factor`, `finish_improved_factor`, `finish_premium_factor`, `vision_low_confidence_discount: 0.85`, `stp_threshold_rub: 300000`, `crack_threshold_mm: 3`, `mold_threshold_m2: 0.5`, `wear_apply: true`, `default_ceiling_height_m: 2.7`

**Acceptance Criteria:**
- Все 5 файлов валидный JSON (`JSON.parse` без ошибок)
- `question_tree.json` содержит ровно 7 вопросов в `intro` и 8 в `flood`
- `works_catalog.json` содержит минимум 20 записей с непустыми `code` и `base_price_rub > 0`
- `region_coefficients.json` содержит запись `moscow`
- `calibration_defaults.json` содержит все 11 весов

**Test:**
1. `JSON.parse(fs.readFileSync('data/works_catalog.json'))` — 0 ошибок
2. Проверить количество записей в каждом файле вручную
3. Импортировать `calibration_defaults.json` в `lib/calculator.ts` — TypeScript не ругается на типы

---

### Task 9: API Route — /api/analyze
**Priority:** 5
**Description:**
Реализовать `app/api/analyze/route.ts` — основной AI pipeline.

```
POST /api/analyze
Content-Type: multipart/form-data
Fields: context (JSON string), photos[] (File blobs)
```

Алгоритм (строго по Implementation Plan секция AI Pipeline):
1. Распарсить `multipart/form-data`: извлечь `context` (JSON) и `photos` (1–10 файлов)
2. Валидация: `photos.length` от 1 до 10, `context` обязателен и парсится без ошибок
3. Загрузить calibration через `getKV('calibration')` или дефолт из файла
4. Загрузить catalogs через `getKV('works_catalog')` + `getKV('materials_catalog')` или дефолты
5. Конвертировать каждое фото в base64 через `blobToBase64()`
6. Вызвать Anthropic API: `model: 'claude-sonnet-4-6'`, `max_tokens: 4096`, передать system prompt + context + все фото в image-блоках
7. Парсинг ответа через `parseClaudeResponse()`
8. Если `ClaudeParseError` → retry один раз
9. Если снова ошибка → `return NextResponse.json({ error: 'ai_parse_failed' }, { status: 422 })`
10. Вызвать `calculate()` с claudeOutput + context + calibration + catalogs
11. Сохранить `CaseRecord` в KV: ключ `case:{id}`, добавить id в список `cases:index`
12. Вернуть `{ id: string, report: Report }`

Обработка ошибок:
- Anthropic API недоступен → `{ error: 'anthropic_error', message }`, status 502
- Невалидный контекст → status 400
- Превышение лимита фото → status 400

**Acceptance Criteria:**
- POST с 1 валидным фото и контекстом возвращает `{ id, report }` с `report.range.base > 0`
- POST без фото возвращает 400
- Если Claude вернул невалидный JSON дважды — возвращает `{ error: 'ai_parse_failed' }`
- Кейс сохраняется в KV после успешного запроса

**Test:**
1. `curl -X POST localhost:3000/api/analyze -F "context={...}" -F "photos=@test.jpg"` — получить `{ id, report }`
2. `curl -X POST localhost:3000/api/analyze -F "context={...}"` (без фото) — получить 400
3. Проверить KV: `getKV('case:{id}')` — возвращает сохранённый `CaseRecord`
4. Проверить retry: временно сделать промпт невалидным — убедиться что есть один retry, затем `ai_parse_failed`

---

### Task 10: API Route — /api/calculate
**Priority:** 5
**Description:**
Реализовать `app/api/calculate/route.ts` — переиспользуемый endpoint для пересчёта сметы без вызова Claude.

```
POST /api/calculate
Content-Type: application/json
Body: { claudeOutput: ClaudeOutput, context: IncidentContext }
```

1. Загрузить calibration из KV или дефолт
2. Загрузить catalogs из KV или дефолты
3. Вызвать `calculate(claudeOutput, context, calibration, catalogs)`
4. Вернуть `{ report: Report }`

Используется в admin-панели для пересчёта после изменения калибровки.

**Acceptance Criteria:**
- POST с валидными `claudeOutput` и `context` возвращает `{ report }`
- Использует актуальную калибровку из KV (не дефолт) если она была сохранена

**Test:**
1. POST с тестовым `claudeOutput` → получить смету
2. Изменить калибровку через `/api/admin/calibration`, затем снова POST — результат изменился

---

### Task 11: API Routes — /api/admin/*
**Priority:** 5
**Description:**
Реализовать все admin API routes + middleware для проверки cookie.

**Middleware `middleware.ts`:**
- Перехватывает все запросы на `/admin/*` и `/api/admin/*` (кроме `/api/admin/login`)
- Читает `admin_session` cookie
- Если нет — редирект на `/admin/login`

**`/api/admin/login` (POST):**
- Принимает `{ password: string }`
- Сравнивает с `process.env.ADMIN_PASSWORD`
- Если совпадает: `Set-Cookie: admin_session=1; HttpOnly; Path=/; SameSite=Lax`
- Если нет: `{ error: 'unauthorized' }`, status 401

**`/api/admin/logout` (POST):**
- Сбрасывает cookie: `Set-Cookie: admin_session=; Max-Age=0`

**`/api/admin/calibration` (GET / PUT):**
- GET: читает из KV ключ `calibration`, если нет — дефолт из файла
- PUT: принимает `CalibrationConfig`, валидирует, сохраняет в KV

**`/api/admin/catalogs` (GET / PUT):**
- GET: читает `works_catalog` и `materials_catalog` из KV или файлов
- PUT: принимает `{ type: 'works' | 'materials', data: ... }`, сохраняет в KV

**`/api/admin/cases` (GET / POST):**
- GET: читает список всех `case:*` из KV, возвращает массив `CaseRecord[]` (без фото для экономии)
- POST: не нужен (кейсы создаёт `/api/analyze`)

**`/api/admin/cases/[id]` (GET):**
- GET: читает `case:{id}` из KV, возвращает полный `CaseRecord` включая фото

**Acceptance Criteria:**
- Запрос на `/admin/page` без cookie → редирект на `/admin/login`
- POST `/api/admin/login` с правильным паролем → cookie установлен
- POST `/api/admin/login` с неправильным паролем → 401
- PUT `/api/admin/calibration` с новым `range_sigma` → GET возвращает обновлённое значение
- GET `/api/admin/cases` возвращает массив (пустой если кейсов нет)

**Test:**
1. `curl -X POST localhost:3000/api/admin/login -d '{"password":"wrong"}' -H 'Content-Type: application/json'` → 401
2. `curl -X POST localhost:3000/api/admin/login -d '{"password":"correct"}'` → 200 + Set-Cookie
3. С cookie: `curl localhost:3000/api/admin/calibration` → дефолтная калибровка
4. `curl -X PUT localhost:3000/api/admin/calibration -d '{"range_sigma":0.2,...}'` → 200
5. `curl localhost:3000/api/admin/calibration` → `range_sigma: 0.2`

---

### Task 12: Page — / (Приветствие)
**Priority:** 6
**Description:**
Реализовать `app/page.tsx` — стартовая страница.

Содержание:
- Заголовок «Claim Assistant» с иконкой
- Подзаголовок «Зафиксируйте страховое событие и получите предварительную оценку ущерба»
- Красный баннер (или жёлтый): «Прототип — данные не передаются в страховую компанию»
- Кнопка «Зафиксировать страховое событие» (primary, зелёный `#21A038`)
- При клике: создать новый `draft` в localStorage с `id = generateId()`, `created_at`, пустыми полями; перейти на `/flow/intro`
- Если в localStorage уже есть незавершённый `draft` — показать баннер «Продолжить незавершённый кейс» с кнопкой «Продолжить» (редирект на последний шаг) и «Начать заново» (удалить draft, создать новый)
- Адаптивная вёрстка: центрировать по вертикали и горизонтали, хорошо выглядит на экране телефона 375px

**Acceptance Criteria:**
- Страница рендерится на мобильном 375px без горизонтального скролла
- Дисклеймер хорошо заметен (не мелкий серый текст)
- Клик по «Зафиксировать» → в localStorage появился `draft` с `id`
- При наличии черновика показывается опция продолжить

**Test:**
1. Открыть `localhost:3000` на мобильном устройстве или DevTools 375px — вёрстка не сломана
2. Нажать «Зафиксировать» → переход на `/flow/intro`, в localStorage есть `draft`
3. Вернуться на `/`, нажать F5 — баннер «Продолжить незавершённый кейс» отображается
4. Нажать «Начать заново» — старый черновик удалён, новый создан с новым id

---

### Task 13: Page — /flow/intro (7 вопросов)
**Priority:** 6
**Description:**
Реализовать `app/flow/intro/page.tsx` — форма с 7 вопросами.

Функциональность:
- Рендер вопросов из `question_tree.json → intro`
- Прогресс-бар «Шаг 2 из 7» (шаги: intro=2, flood=3, camera=4, review=5, loading=6, result=7)
- Отображать вопросы последовательно (по одному, анимация slide) или все сразу — выбрать по UX, рекомендуется все сразу с прокруткой для быстрого прохождения
- Автосохранение в `localStorage.draft.intro` при каждом `onChange`
- Восстановление значений из `draft.intro` при возврате
- Вопрос «Тип страхового события» — `select` с 4 вариантами: «Залив», «Пожар», «Взлом/кража», «Стихийное бедствие»
- Валидация при попытке перейти дальше: все `required` поля заполнены
- Кнопка «Далее»: если `event_type === 'flood'` → `/flow/flood`; иначе → `/thank-you`
- Маска для телефона: автоматически добавлять `+7 (___) ___-__-__`

**Acceptance Criteria:**
- Незаполненное `required` поле при нажатии «Далее» → highlight красным + сообщение
- При выборе «Залив» кнопка «Далее» ведёт на `/flow/flood`
- При выборе «Пожар» кнопка «Далее» ведёт на `/thank-you`
- Обновление значений сохраняется в localStorage, при F5 значения не теряются
- Вёрстка не сломана на 375px

**Test:**
1. Открыть `/flow/intro`, заполнить все поля, выбрать «Залив», нажать «Далее» → переход на `/flow/flood`
2. Перезагрузить страницу — все заполненные значения восстановились из localStorage
3. Нажать «Далее» с пустым полем «ФИО» → поле подсвечено красным
4. Выбрать «Пожар» → переход на `/thank-you`

---

### Task 14: Page — /flow/flood (8 вопросов)
**Priority:** 6
**Description:**
Реализовать `app/flow/flood/page.tsx` — форма специфичных вопросов для залива.

8 вопросов (из `question_tree.json → flood`):
1. Этаж квартиры (number, 1–50)
2. Этаж источника воды (number, 1–50)
3. Дата события (date picker, не позже сегодня)
4. Суммарная площадь повреждений (number, м², подсказка «включая все помещения»)
5. Высота потолков (select: «2.5 м» / «2.7 м» / «3.0 м» / «Другая»); если «Другая» — показать number input
6. Уровень отделки (select: «Эконом» / «Стандарт» / «Улучшенная» / «Премиум»), с кратким описанием каждого варианта
7. Материал стен (select: «Панельный» / «Кирпич» / «Монолит» / «Гипсокартон»)
8. Есть ли акт от УК (toggle «Да» / «Нет»)

Те же требования что для intro: автосохранение в `draft.flood`, восстановление, валидация, прогресс-бар (Step 3/7), кнопка «Далее» → `/flow/camera`, кнопка «Назад» → `/flow/intro`.

**Acceptance Criteria:**
- Все 8 вопросов отображаются
- При «Другая» высота потолков появляется числовое поле
- Кнопка «Назад» работает, черновик сохраняется
- После заполнения и нажатия «Далее» → переход на `/flow/camera`
- `draft.flood` в localStorage содержит все 8 значений

**Test:**
1. Заполнить все поля, выбрать «Другая» высота → ввести 3.2, нажать «Далее» → переход на камеру
2. Нажать «Назад» → вернуться на `/flow/intro`, все данные сохранены
3. Перезагрузить `/flow/flood` — все значения восстановлены

---

### Task 15: Page — /flow/camera (камера)
**Priority:** 7
**Description:**
Реализовать `app/flow/camera/page.tsx` — главный UX-эксперимент прототипа.

Компоненты:
- `<video autoplay playsinline muted>` — без `playsinline` iOS откроет плеер вместо камеры
- `<canvas>` для overlay поверх видео (абсолютное позиционирование)
- Инициализация: `startCamera(videoEl)` при монтировании, `stopCamera()` при размонтировании
- Кнопка «Снять фото» (большая, круглая, в центре снизу)
- Кнопка «Загрузить из галереи» (`<input type="file" accept="image/*" multiple>`)

Overlay (рисуется на canvas каждые 500мс):
- Счётчик `N / 10` в правом верхнем углу
- Рамка-цель (прямоугольник 60% кадра) по центру
- Индикатор яркости: «☀️ Освещение хорошее» (green) / «🌑 Освещение плохое» (red) — порог brightness < 60
- Если `DeviceOrientationEvent` доступен → live-уровень «📐 Держите ровно» (зелёный если tilt < 15°, красный если больше); если недоступен → статичный текст «Держите телефон ровно»
- Для первых 3 фото: подсказка «📏 Положите монету 10₽ для масштаба»

Логика снимка:
1. `captureSnapshot(videoEl, canvas)` → `laplacianVariance`
2. Если variance < threshold (80) → toast «Фото нерезкое, сделайте ещё раз», не добавлять
3. Если резкое → `resizeTo1600()` → добавить в `photos` state
4. Обновить `draft.photos` в localStorage (base64 + exif)

Список добавленных фото:
- Thumbnails снизу (горизонтальный скролл)
- Кнопка удалить на каждом фото

Минимум 1 фото — кнопка «Далее» неактивна пока нет ни одного. При наличии фото → `/flow/review`.

**Acceptance Criteria:**
- Камера запускается на iOS Safari и Android Chrome
- Нерезкое фото отклоняется с toast-уведомлением
- Резкое фото добавляется в список, thumbnail виден
- Overlay корректно отображается поверх видео
- Максимум 10 фото — после 10 кнопка «Снять» становится неактивной
- Кнопка «Далее» → `/flow/review`

**Test:**
1. Открыть на реальном iPhone/Android — камера открывается, задняя камера активна
2. Сфотографировать размытое изображение → toast «нерезкое»
3. Сфотографировать резкое изображение → thumbnail появился
4. Загрузить фото из галереи → те же проверки резкости
5. Добавить 10 фото → кнопка «Снять» задизейблена
6. Нажать «Далее» → переход на `/flow/review`

---

### Task 16: Page — /flow/review (проверка)
**Priority:** 7
**Description:**
Реализовать `app/flow/review/page.tsx` — экран финальной проверки перед отправкой.

Содержание:
- Заголовок «Проверьте данные перед отправкой»
- Блок «Данные об инциденте»: регион, адрес, площадь повреждений, тип отделки — краткий summary из `draft`
- Блок «Фотографии»: grid thumbnails всех фото с кнопкой «Удалить» на каждом
- Кнопка «Добавить ещё фото» → вернуть на `/flow/camera`
- Кнопка «Назад» → `/flow/camera`
- Кнопка «Отправить на анализ» (primary) → начать загрузку

При нажатии «Отправить»:
1. Показать loading overlay «Анализируем повреждения…» с анимацией (spinner или пульсирующий текст)
2. Сформировать `FormData`: `context = JSON.stringify(draft.intro + draft.flood)`, `photos[] = base64 blobs`
3. `POST /api/analyze`
4. При успехе: сохранить `draft.result = { id, report }` в localStorage, редирект на `/result/{id}`
5. При ошибке `ai_parse_failed` или сетевой ошибке: убрать loading, показать экран ошибки с кнопкой «Попробовать снова» (повторяет тот же POST)

**Acceptance Criteria:**
- Summary корректно отображает данные из черновика
- Loading overlay отображается во время запроса
- При успехе: редирект на `/result/{id}`
- При ошибке: кнопка «Попробовать снова», не белый экран
- Если фото удалены и их < 1 — кнопка «Отправить» недоступна

**Test:**
1. Пройти весь флоу до review, нажать «Отправить» → loading, затем переход на result
2. Симулировать ошибку (отключить интернет) → экран с кнопкой «Попробовать снова»
3. Нажать «Попробовать снова» → повторный запрос, при успехе переход на result

---

### Task 17: Page — /result/[id] (отчёт)
**Priority:** 7
**Description:**
Реализовать `app/result/[id]/page.tsx` — страница отчёта.

Данные: `id` из URL → `GET /api/admin/cases/{id}` или из `localStorage.draft.result` (если тот же браузер).

Содержание страницы:
- Если `routed_to_expert: true` → жёлтый баннер «Ваш случай передан эксперту для детального рассмотрения»
- Большим шрифтом: базовая оценка `formatRub(report.range.base)`, рядом `до ±15%` с мелким `(±{sigma}%)`
- Секция «AI-заключение»: текст `report.claude_output.summary` в карточке
- Таблица работ: scrollable на мобильном, колонки «Наименование», «Объём», «Итого»
- Таблица материалов: аналогично
- Итоговая строка суммы в таблицах
- Кнопка «Скачать PDF» → вызов `generatePDF(report, context, photos)`
- Кнопка «Скачать JSON» → `URL.createObjectURL(new Blob([JSON.stringify(caseRecord, null, 2)]))` + `a.click()`
- Кнопка «Начать новый кейс» → очистить `draft` из localStorage, редирект на `/`

**Acceptance Criteria:**
- Страница загружается по URL `/result/{id}` в любом браузере (данные из KV)
- Базовая оценка отображается крупно и заметно
- Таблицы не ломают вёрстку на 375px (горизонтальный скролл)
- PDF скачивается с корректным содержимым
- JSON скачивается и содержит полный `CaseRecord`

**Test:**
1. Пройти полный флоу → попасть на `/result/{id}`, проверить все секции
2. Открыть тот же URL `/result/{id}` в другом браузере — страница загружается из KV
3. Нажать «Скачать PDF» → PDF скачан
4. Нажать «Скачать JSON» → JSON скачан, содержит `context`, `report`, `photos_count`
5. Нажать «Начать новый кейс» → редирект на `/`, черновик очищен

---

### Task 18: Page — /thank-you (не-залив)
**Priority:** 6
**Description:**
Реализовать `app/thank-you/page.tsx` — страница для событий не-залив (пожар, кража, стихийное).

Содержание:
- Иконка / иллюстрация (checkmark или конверт)
- Заголовок «Спасибо! Ваша заявка принята»
- Текст: «Для данного типа страхового события автоматический расчёт пока не доступен. Эксперт рассмотрит ваш кейс в ближайшее время.»
- Блок «Ваши данные сохранены»: ФИО, телефон, тип события — из `draft`
- Кнопка «Скачать JSON-пакет» → JSON с `draft.intro` для эксперта
- Кнопка «Начать новый кейс»

При переходе сюда: сохранить `CaseRecord` в KV со статусом `expert` (без `report`).

**Acceptance Criteria:**
- После выбора «Пожар» на `/flow/intro` → попасть на `/thank-you`
- JSON скачивается и содержит данные вопросов
- Кейс сохранён в KV и виден в `/admin/history` со статусом «Передан эксперту»

**Test:**
1. Пройти флоу с «Пожар», дойти до `/thank-you` → все секции отображаются
2. Нажать «Скачать JSON» → скачан файл с `intro` данными
3. Открыть `/admin/history` → кейс виден со статусом «expert»

---

### Task 19: Admin — /admin/login
**Priority:** 8
**Description:**
Реализовать `app/admin/login/page.tsx` — страница входа в Admin.

Содержание:
- Форма с одним полем `<input type="password">`
- Кнопка «Войти»
- При submit: `POST /api/admin/login`, при успехе → редирект на `/admin`, при ошибке → «Неверный пароль»
- Простой centered layout, без лишних элементов

**Acceptance Criteria:**
- Неправильный пароль → inline ошибка «Неверный пароль»
- Правильный пароль → редирект на `/admin`
- Cookie устанавливается (httpOnly, не видна в JS)

**Test:**
1. Открыть `/admin` без cookie → редирект на `/admin/login`
2. Ввести неверный пароль → сообщение об ошибке
3. Ввести верный пароль (`ADMIN_PASSWORD` из `.env.local`) → попасть на дашборд

---

### Task 20: Admin — /admin (Dashboard)
**Priority:** 8
**Description:**
Реализовать `app/admin/page.tsx` — дашборд администратора.

Метрики (читаются из KV через `GET /api/admin/cases`):
- Всего кейсов: count
- Завершённых (статус `complete`): count
- Передано эксперту (статус `expert` или `routed_to_expert: true`): count
- Средняя базовая оценка: среднее по `report.range.base`
- Средний confidence Vision: среднее по `report.claude_output.average_confidence`
- Гистограмма типов повреждений: bar chart по `damage_class` (можно простой CSS-бар без библиотек)

Навигация: sidebar или tab bar с ссылками на `Калибровка`, `Справочники`, `История`.

Кнопка «Выйти» → `POST /api/admin/logout`, редирект на `/admin/login`.

**Acceptance Criteria:**
- Все 5 метрик отображаются (0 если кейсов нет)
- Гистограмма показывает хотя бы один bar
- Кнопка «Выйти» завершает сессию
- Навигация ведёт на все 4 раздела

**Test:**
1. После нескольких тестовых кейсов открыть дашборд → метрики не нулевые
2. Нажать «Выйти» → редирект на `/admin/login`, повторный переход на `/admin` → снова редирект на login

---

### Task 21: Admin — /admin/calibration
**Priority:** 8
**Description:**
Реализовать `app/admin/calibration/page.tsx` — управление весами.

11 параметров калибровки с контролами:
- `range_sigma` (0.05–0.35): ползунок + числовое поле
- `finish_economy_factor`, `_standard_factor`, `_improved_factor`, `_premium_factor` (0.5–3.0): ползунки
- `vision_low_confidence_discount` (0.5–1.0): ползунок
- `stp_threshold_rub` (50000–1000000): числовое поле с форматированием
- `crack_threshold_mm` (1–10): ползунок
- `mold_threshold_m2` (0.1–5.0): ползунок
- `wear_apply`: checkbox
- `default_ceiling_height_m` (2.3–4.0): ползунок

При загрузке: `GET /api/admin/calibration` → заполнить поля текущими значениями.

Кнопки:
- «Сохранить и применить» → `PUT /api/admin/calibration`, toast «Сохранено»
- «Сбросить к дефолту» → загрузить значения из `calibration_defaults.json` и отобразить (не сохранять до явного «Сохранить»)
- «Экспорт JSON» → скачать текущую конфигурацию как файл

**Acceptance Criteria:**
- Все 11 контролов отображаются с текущими значениями
- Изменение `range_sigma` и «Сохранить» → следующий расчёт использует новое значение
- «Сбросить к дефолту» восстанавливает дефолтные значения в форме (без автосохранения)
- Экспорт JSON → скачан валидный файл

**Test:**
1. Изменить `range_sigma` с 0.15 на 0.20, нажать «Сохранить»
2. Создать новый кейс через флоу — `report.sigma` = 0.20
3. Нажать «Сбросить к дефолту» → `range_sigma` = 0.15 в форме, не сохранено
4. Обновить страницу → значение всё ещё 0.20 (изменения не применились)

---

### Task 22: Admin — /admin/catalogs
**Priority:** 9
**Description:**
Реализовать `app/admin/catalogs/page.tsx` — управление справочниками.

Две вкладки: «Работы» и «Материалы».

На каждой вкладке:
- Таблица всех записей: `code`, `name`, `unit`, `base_price_rub` (inline-редактируемое поле)
- Сохранение изменённой цены: «Сохранить» внизу таблицы или автосохранение на blur
- Кнопка «Скачать XLSX» → через библиотеку `xlsx` сформировать и скачать Excel-файл
- Кнопка «Загрузить XLSX»: `<input type="file" accept=".xlsx">`, парсинг через `xlsx`, preview изменений в модальном окне («Будет обновлено N записей»), кнопка «Подтвердить» → `PUT /api/admin/catalogs`
- Кнопка «Восстановить из репозитория» → `PUT /api/admin/catalogs` с дефолтными данными

**Acceptance Criteria:**
- Inline-редактирование цены работает
- XLSX скачивается и открывается в Excel без ошибок
- Загрузка XLSX: preview показывает количество изменённых строк, подтверждение обновляет KV
- «Восстановить из репозитория» → цены сбрасываются к дефолтным

**Test:**
1. Изменить `base_price_rub` для одной работы, сохранить
2. Создать кейс → смета использует новую цену
3. Скачать XLSX → файл открывается в Excel
4. Загрузить изменённый XLSX → preview показывает изменения, подтвердить → цены обновлены
5. «Восстановить» → цена вернулась к дефолтной

---

### Task 23: Admin — /admin/history
**Priority:** 9
**Description:**
Реализовать `app/admin/history/page.tsx` — история кейсов.

Таблица кейсов (данные из `GET /api/admin/cases`):
- Колонки: «Дата», «Тип события», «Регион», «Оценка (₽)», «Статус», «Действия»
- Статус: «Завершён» (зелёный badge) / «Эксперт» (жёлтый badge)
- Действие: кнопка «Открыть» → модальное окно или страница карточки кейса

Фильтры:
- По типу события: select (все / залив / пожар / кража / стихийное)
- По статусу: select (все / завершён / эксперт)

Экспорт:
- Кнопка «Экспорт CSV» → скачать таблицу как CSV

Карточка кейса при клике «Открыть»:
- Данные клиента
- Thumbnails фото с EXIF метаданными (дата, GPS если есть)
- JSON ответов на вопросы (collapsible)
- AI-заключение
- Таблица работ и материалов
- Ссылка «Скачать PDF»

**Acceptance Criteria:**
- Таблица показывает все кейсы из KV
- Фильтры работают без перезагрузки страницы
- CSV скачивается с корректными колонками
- Карточка кейса показывает все данные включая фото

**Test:**
1. Создать 3 кейса (2 завершённых, 1 эксперт), открыть историю → 3 строки
2. Применить фильтр «Эксперт» → 1 строка
3. Скачать CSV → файл содержит все строки до фильтрации (или текущие — уточнить)
4. Нажать «Открыть» на кейсе → карточка с фото и сметой

---

### Task 24: PWA Public Assets
**Priority:** 10
**Description:**
Создать минимальные PWA ресурсы в директории `public/`:

- `public/manifest.json` — `{ name: 'Claim Assistant', short_name: 'ClaimAI', start_url: '/', display: 'standalone', background_color: '#ffffff', theme_color: '#21A038', icons: [192, 512] }`
- `public/icon-192.png` — иконка 192×192px (можно placeholder: зелёный квадрат с буквами «CA»)
- `public/icon-512.png` — иконка 512×512px
- В `app/layout.tsx` добавить `<link rel="manifest" href="/manifest.json">` и `<meta name="theme-color" content="#21A038">`
- **Без** Service Worker (PWA installable не нужен для прототипа)

**Acceptance Criteria:**
- `localhost:3000/manifest.json` отдаёт валидный JSON
- `localhost:3000/icon-192.png` и `icon-512.png` отдают изображения
- На Android Chrome появляется тема (зелёный status bar)

**Test:**
1. `curl localhost:3000/manifest.json` — валидный JSON
2. Открыть в Chrome DevTools → Application → Manifest → нет критических ошибок
3. На Android Chrome цвет адресной строки зелёный

---

### Task 25: End-to-End проверка и деплой
**Priority:** 10
**Description:**
Финальная проверка всего флоу и деплой на Vercel.

Шаги деплоя (по PRD секция 8):
1. `npm run build` — убедиться что 0 ошибок
2. Push в GitHub репозиторий `claim-assistant-proto`
3. На Vercel: New Project → импорт репозитория
4. Добавить переменные окружения: `ANTHROPIC_API_KEY`, `ADMIN_PASSWORD`
5. Storage → Create → KV → подключить к проекту (автоматически добавит `KV_*` переменные)
6. Deploy
7. Получить публичный URL

End-to-end проверка на деплое:
- Пройти полный флоу с телефона (iOS Safari и Android Chrome)
- Проверить что камера запускается (задняя)
- Сделать залив-кейс, получить PDF
- Открыть `/admin`, проверить что кейс виден в истории
- Проверить что калибровка сохраняется и влияет на следующий кейс

**Acceptance Criteria:**
- Публичный URL открывается и работает на iOS Safari
- Полный флоу «залив» завершается успешно
- PDF скачивается
- Кейс виден в `/admin/history`
- `npm run build` на CI/Vercel проходит без ошибок

**Test:**
1. Открыть деплой на iPhone → пройти флоу залив → PDF скачан
2. Открыть деплой на Android Chrome → аналогично
3. Открыть `/admin` → ввести пароль → дашборд показывает 2 кейса
4. В истории открыть один кейс → все данные и фото видны

---

## Technical Constraints
- **Frontend:** Next.js 15 App Router, TypeScript strict, React 19, Tailwind CSS, shadcn/ui
- **Backend:** Vercel Serverless Functions (Next.js API Routes), без постоянного сервера
- **AI:** Anthropic API, модель `claude-sonnet-4-6`, vision через base64 image blocks
- **Database:** Vercel KV (Upstash Redis через REST API); для локальной разработки — in-memory Map-заглушка
- **Хостинг:** Vercel (Hobby plan — бесплатно для ~50 кейсов)
- **Изображения:** resize на клиенте до 1600px, сервер не пересжимает
- **Сессия:** localStorage для черновика клиента; httpOnly cookie для admin-сессии
- **PDF:** jsPDF + jspdf-autotable, генерация в браузере
- **Нет:** Service Worker, WebXR, СберID, PostgreSQL, Docker, CI/CD пайплайна

---

## Out of Scope
- Интеграция с СберID, СБС, DaData — заменена простой формой ФИО/телефон
- Vector DB с похожими кейсами — заменена 3 few-shot примерами в промпте
- Fine-tuned Vision-модель — используется Claude Sonnet 4.6 напрямую
- AR-рулетка (WebXR) — не поддерживается iOS Safari, заменена монетой/картой
- Temporal, Kafka, микросервисы — один serverless endpoint
- Multi-region кэш, K8s, observability — не нужно для 50 кейсов
- A/B тест camera hints — слишком мало пользователей
- PWA installable (Service Worker) — открывается по ссылке в браузере
- Полный RBAC в админке — один пароль через env
- WCAG 2.1 AA, локализация — базовые ARIA от shadcn/ui
- PostgreSQL, S3, аудит-лог — localStorage + Vercel KV
- Расчёт ущерба для пожара, кражи, стихийного — только залив с полным AI-флоу
- Rate limiting на `/admin/login` — не нужно для прототипа
- Session expiry для admin cookie — не нужно для прототипа
- Автоматические тесты (unit, integration, e2e) — одноразовый прототип
- Оптимизация токенов Anthropic API — на 50 кейсах не имеет смысла
- Красивый кастомный дизайн — дефолт shadcn/ui + зелёный акцент `#21A038`
