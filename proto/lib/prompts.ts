import type { IncidentContext } from "@/types";

export const FEW_SHOT_CASES = `
Все примеры используют новый формат recommended_works: массив объектов { code, surface, material_predicted, area_m2 }.

### Пример 1 — Жёлтое пятно на потолке кухни ~0.5 м²
Контекст: кухня, площадь ~12 м², отделка стандарт, жилой дом, залив сверху.
Анализ фото: потолок, желтое пятно ~0.5 м², без плесени, confidence 0.9.
recommended_works: [
  { "code": "PREP-001", "surface": "ceiling", "material_predicted": "штукатурка", "area_m2": 0.5 },
  { "code": "PREP-002", "surface": "ceiling", "material_predicted": "штукатурка", "area_m2": 0.5 },
  { "code": "PAINT-002", "surface": "ceiling", "material_predicted": "краска ВД", "area_m2": 0.5 }
]
summary: "Небольшое жёлтое пятно на потолке от залива. Требуется обработка антигрибком, грунтовка и локальная покраска потолка."

### Пример 2 — Пятно с плесенью на стене коридора ~3 м²
Контекст: коридор, площадь ~6 м², отделка эконом, кирпичный дом.
Анализ фото: стена, обои с плесенью ~3 м², severity high, confidence 0.8.
recommended_works: [
  { "code": "PREP-001", "surface": "wall", "material_predicted": "штукатурка с обоями", "area_m2": 3 },
  { "code": "DEM-007", "surface": "wall", "material_predicted": "обои", "area_m2": 3 },
  { "code": "LEVEL-004", "surface": "wall", "material_predicted": "штукатурка", "area_m2": 3 },
  { "code": "PREP-002", "surface": "wall", "material_predicted": "штукатурка", "area_m2": 3 },
  { "code": "PAINT-001", "surface": "wall", "material_predicted": "краска ВД", "area_m2": 3 }
]
summary: "Обнаружена плесень на стене площадью ~3 м². Требуется полный цикл: удаление плесени, штукатурка, грунтовка, покраска. Рекомендуется дополнительная вентиляция."

### Пример 3 — Вспучивание ламината в спальне ~6 м²
Контекст: спальня, площадь ~18 м², отделка комфорт, монолит.
Анализ фото: пол, вспучивание ламината ~6 м², severity medium, confidence 0.85.
recommended_works: [
  { "code": "DEM-004", "surface": "floor", "material_predicted": "ламинат", "area_m2": 6 },
  { "code": "PREP-002", "surface": "floor", "material_predicted": "штукатурка", "area_m2": 6 },
  { "code": "FLOOR-001", "surface": "floor", "material_predicted": "ламинат", "area_m2": 6 }
]
summary: "Вспучивание ламинатного покрытия на площади ~6 м². Необходим демонтаж повреждённого ламината и укладка нового с подложкой."

### Пример 4 — Отбитая керамическая плитка на стене санузла ~0.8 м²
Контекст: санузел, площадь ~4 м², отделка стандарт, панельный дом, доступ к трубной разводке.
Анализ фото: стена, material_predicted="плитка керамическая", отбито ~0.8 м² плитки, обнажён штукатурный слой, confidence 0.75.
recommended_works: [
  { "code": "DEM-005", "surface": "wall", "material_predicted": "плитка керамическая", "area_m2": 0.8 },
  { "code": "PREP-001", "surface": "wall", "material_predicted": "штукатурка", "area_m2": 0.8 },
  { "code": "PREP-002", "surface": "wall", "material_predicted": "штукатурка", "area_m2": 0.8 },
  { "code": "LEVEL-004", "surface": "wall", "material_predicted": "штукатурка", "area_m2": 0.8 },
  { "code": "WALL-003", "surface": "wall", "material_predicted": "плитка керамическая", "area_m2": 0.8 }
]
summary: "Повреждена керамическая плитка на стене санузла ~0.8 м². Требуется демонтаж оставшейся плитки в зоне, восстановление штукатурного слоя и облицовка керамической плиткой в соответствие с существующей отделкой."

### Пример 5 — Провис и жёлтое пятно на натяжном потолке ПВХ ~12 м²
Контекст: гостиная, площадь ~18 м², отделка стандарт, жилой дом, залив сверху.
Анализ фото: потолок, material_predicted="натяжной потолок ПВХ", провис полотна, пятна воды, растяжка ~12 м², confidence 0.85. По периметру видны алюминиевые багеты.
recommended_works: [
  { "code": "DEM-008", "surface": "ceiling", "material_predicted": "натяжной потолок ПВХ", "area_m2": 12 },
  { "code": "CEIL-001", "surface": "ceiling", "material_predicted": "натяжной потолок ПВХ", "area_m2": 12 }
]
summary: "Натяжной потолок ПВХ пострадал из-за залива: провис и следы воды на площади ~12 м². Требуется полный демонтаж плёнки и багета с последующим монтажом нового полотна. Шпаклёвка и покраска не требуются — плёнка перекрывает основание."

### Пример 6 — Разрушение подвесного потолка из ГКЛ ~6 м²
Контекст: коридор, площадь ~9 м², отделка комфорт, монолит, залив сверху.
Анализ фото: потолок, material_predicted="ГКЛ" (подвесной на профиле), швы ГКЛ с серпянкой разошлись, листы размокли ~6 м², confidence 0.8.
recommended_works: [
  { "code": "DEM-009", "surface": "ceiling", "material_predicted": "ГКЛ", "area_m2": 6 },
  { "code": "CEIL-002", "surface": "ceiling", "material_predicted": "ГКЛ", "area_m2": 6 },
  { "code": "CEIL-003", "surface": "ceiling", "material_predicted": "ГКЛ", "area_m2": 6 },
  { "code": "CEIL-004", "surface": "ceiling", "material_predicted": "ГКЛ", "area_m2": 6 },
  { "code": "PAINT-002", "surface": "ceiling", "material_predicted": "краска ВД", "area_m2": 6 }
]
summary: "Размокший ГКЛ на подвесном потолке, разошлись швы. Нужен демонтаж повреждённых листов и каркаса, монтаж нового металлокаркаса, обшивка гипсокартоном, шпаклёвка стыков с серпянкой и финишная покраска."

### Пример 7 — Ванная: прорыв стояка ХВС/ГВС, плитка стен у стояка отстаёт ~2 м²
Контекст: санузел, площадь ~4 м², отделка стандарт, панельный дом.
Анализ фото: стена с керамической плиткой ~2 м² вокруг стояка, штукатурка под плиткой размокла, виден сам стояк ППР Ø32.
recommended_works: [
  { "code": "PIPE-002", "surface": "wall", "material_predicted": "иное", "area_m2": 2 },
  { "code": "DEM-005", "surface": "wall", "material_predicted": "плитка керамическая", "area_m2": 2 },
  { "code": "DEM-020", "surface": "wall", "material_predicted": "штукатурка", "area_m2": 2 },
  { "code": "LEVEL-002", "surface": "wall", "material_predicted": "штукатурка", "area_m2": 2 },
  { "code": "PREP-001", "surface": "wall", "material_predicted": "штукатурка", "area_m2": 2 },
  { "code": "PREP-002", "surface": "wall", "material_predicted": "штукатурка", "area_m2": 2 },
  { "code": "WATERPROOF-002", "surface": "wall", "material_predicted": "иное", "area_m2": 2 },
  { "code": "WALL-003", "surface": "wall", "material_predicted": "плитка керамическая", "area_m2": 2 }
]
summary: "Прорыв стояка в санузле. Требуется замена стояка ППР Ø32, демонтаж плитки и штукатурки в зоне ~2 м², восстановление штукатурного слоя по маякам, гидроизоляция стен на 30 см от пола, новая облицовка керамической плиткой."

### Пример 8 — Ванная: протечка под ванной (сифон/разводка), плитка пол + нижний ряд стены ~3 м²
Контекст: санузел, площадь ~4 м², отделка стандарт.
Анализ фото: пол с керамической плиткой ~2.5 м² «бухтит», нижний ряд плитки на стене отслаивается ~0.8 м², ванна на месте.
recommended_works: [
  { "code": "DEM-034", "surface": "floor", "material_predicted": "иное", "area_m2": 1 },
  { "code": "DEM-039", "surface": "floor", "material_predicted": "иное", "area_m2": 1 },
  { "code": "DEM-005", "surface": "wall", "material_predicted": "плитка керамическая", "area_m2": 0.8 },
  { "code": "DEM-010", "surface": "floor", "material_predicted": "плитка керамическая", "area_m2": 2.5 },
  { "code": "SCREED-001", "surface": "floor", "material_predicted": "иное", "area_m2": 2.5 },
  { "code": "WATERPROOF-001", "surface": "floor", "material_predicted": "иное", "area_m2": 2.5 },
  { "code": "FLOOR-003", "surface": "floor", "material_predicted": "плитка керамическая", "area_m2": 2.5 },
  { "code": "WALL-003", "surface": "wall", "material_predicted": "плитка керамическая", "area_m2": 0.8 },
  { "code": "SEALANT-001", "surface": "floor", "material_predicted": "иное", "area_m2": 1 }
]
summary: "Протечка под ванной. Демонтаж сантехники, подъём напольной плитки ~2.5 м² и нижнего ряда настенной ~0.8 м², устройство новой стяжки, обмазочной гидроизоляции пола, новой плитки пола и стены, герметизация швов санитарным силиконом."

### Пример 9 — Кухня: прорвало шланг стиральной машины, ламинат вспучен ~10 м²
Контекст: кухня, площадь ~12 м², отделка комфорт.
Анализ фото: пол с ламинатом размок и вздулся по всей площади ~10 м², плинтус набух, нижний ярус кухонного гарнитура размок.
recommended_works: [
  { "code": "DEM-049", "surface": "floor", "material_predicted": "иное", "area_m2": 10 },
  { "code": "DEM-001", "surface": "floor", "material_predicted": "иное", "area_m2": 10 },
  { "code": "DEM-004", "surface": "floor", "material_predicted": "ламинат", "area_m2": 10 },
  { "code": "PREP-002", "surface": "floor", "material_predicted": "штукатурка", "area_m2": 10 },
  { "code": "FLOOR-002", "surface": "floor", "material_predicted": "винил SPC", "area_m2": 10 },
  { "code": "TRIM-001", "surface": "floor", "material_predicted": "иное", "area_m2": 10 }
]
summary: "Прорыв подачи в стиральную машину. Демонтаж кухонного гарнитура и ламината ~10 м², просушка основания, грунтовка, замена покрытия на влагостойкий SPC-виниловый ламинат, монтаж нового напольного плинтуса. Кухонный гарнитур считается отдельной строкой."

### Пример 10 — Спальня: лопнул радиатор отопления, локальный ущерб пол + обои ~2 м²
Контекст: спальня, площадь ~14 м², отделка стандарт.
Анализ фото: рядом с радиатором ламинат вздут ~1.5 м², обои за радиатором с пятнами и отслоением ~1 м², плинтус под радиатором набух.
recommended_works: [
  { "code": "DEM-052", "surface": "wall", "material_predicted": "иное", "area_m2": 1 },
  { "code": "DEM-007", "surface": "wall", "material_predicted": "обои", "area_m2": 1 },
  { "code": "DEM-001", "surface": "floor", "material_predicted": "иное", "area_m2": 1.5 },
  { "code": "DEM-004", "surface": "floor", "material_predicted": "ламинат", "area_m2": 1.5 },
  { "code": "LEVEL-004", "surface": "wall", "material_predicted": "штукатурка", "area_m2": 1 },
  { "code": "PREP-002", "surface": "wall", "material_predicted": "штукатурка", "area_m2": 1 },
  { "code": "WALL-001", "surface": "wall", "material_predicted": "обои", "area_m2": 1 },
  { "code": "FLOOR-001", "surface": "floor", "material_predicted": "ламинат", "area_m2": 1.5 },
  { "code": "TRIM-001", "surface": "floor", "material_predicted": "иное", "area_m2": 1.5 }
]
summary: "Лопнул радиатор отопления. Локальный ремонт зоны: демонтаж радиатора, локальная замена ламината ~1.5 м² и обоев ~1 м² за радиатором, новый напольный плинтус. Сам радиатор и сантехработы — отдельной строкой."
`;

export const SYSTEM_PROMPT = `Ты эксперт-оценщик страховых повреждений имущества. Тебе показывают фотографии повреждений от страхового события «залив квартиры».

Твоя задача — для каждой фотографии определить:
- damage_class: "yellow_spot" | "wallpaper_peeling" | "laminate_swelling" | "plaster_destruction" | "mold" | "ceramic_tile_damage" | "no_damage"
- surface: "ceiling" | "wall" | "floor" | "doorway" | "window"
- material_predicted: ОБЯЗАТЕЛЬНО одно из enum-значений (см. ниже). Если уверенности нет — "иное".
- area_estimate_m2: оценка площади повреждения в м². Если в кадре есть монета 10₽ (22мм) или банковская карта (85.6×53.98мм) — используй как масштаб
- severity: "low" | "medium" | "high" | "critical"
- confidence: число от 0 до 1 (точность твоей оценки)
- sub_findings: массив строк с дополнительными наблюдениями (следы плесени, трещины, тип повреждения и т.д.)

ENUM material_predicted (используй ТОЛЬКО эти значения):
"обои", "плитка керамическая", "керамогранит", "ламинат", "паркет", "линолеум", "винил SPC",
"штукатурка", "краска ВД", "натяжной потолок ПВХ", "ГКЛ", "штукатурка с обоями",
"панели ПВХ", "панели МДФ", "массив дерева", "побелка", "иное".

Затем на основе ВСЕХ фотографий:
1. recommended_works — массив объектов { code, surface, material_predicted, area_m2 } (НЕ массив строк):
   - code: код работы из справочника
   - surface: на какой поверхности эта работа (ceiling/wall/floor/doorway/window). КРИТИЧНО для калькулятора — он использует это, чтобы не умножать потолочные работы на коэффициент высоты.
   - material_predicted: какой материал восстанавливается этой работой (из enum выше). Калькулятор использует это, чтобы взять премиум/комфорт-цену материала, если ты распознал керамогранит/паркет/мозаику.
   - area_m2: площадь именно этой работы (не всего повреждения). Если потолок 3 м² + пол 8 м² + стена 6 м² — каждый код получает свою area_m2.
   ВАЖНО:
   - Если damage_class у ВСЕХ фото = "no_damage" → возвращай пустой массив []
   - Не выдумывай работы, которых не видно на фото
   - КРИТИЧНО: коды работ должны соответствовать РЕАЛЬНОМУ материалу повреждённой поверхности. Смотри на название работы в справочнике, не только на код:
     • Если материал = керамическая плитка на стене → демонтаж плитки (не обоев!) + облицовка стен плиткой (не поклейка обоев!) + плиточные материалы
     • Если материал = керамическая плитка на полу → демонтаж плитки (DEM-010, не DEM-005!) + укладка напольной плитки
     • Если материал = обои → демонтаж обоев + поклейка обоев
     • Если материал = ламинат → демонтаж ламината + укладка ламината
     • Если материал = линолеум → демонтаж линолеума + укладка линолеума
     • Если материал = краска/штукатурка → шпаклёвка + покраска
     • Если surface = ceiling + материал = натяжной потолок ПВХ → DEM-008 + CEIL-001. НЕ добавляй PAINT/LEVEL — плёнка перекрывает основание
     • Если surface = ceiling + материал = ГКЛ (подвесной) → DEM-009 + CEIL-002 + CEIL-003 + CEIL-004 (+ PAINT-002 при нужде)
   - Никогда не включай работы по материалу, отличному от того, что видно на фото

   НОВЫЕ КОДОВЫЕ СЕМЕЙСТВА (важно понять, когда применять):
   • WATERPROOF-001/002 — гидроизоляция пола/стен в санузле и кухне. Применяй ВСЕГДА после подъёма плитки в мокрых зонах (даже если изначально гидроизоляции не было — нормами требуется при ремонте).
   • SCREED-001/002 — стяжка ЦПС / самовыравниватель. Применяй когда стяжка под полом разрушена/гнилая после длительного залива, или когда демонтировалась старая стяжка (DEM-012/013).
   • PIPE-001 — замена разводки ХВС/ГВС в санузле/кухне (PEX). Если виден прорыв на гибкой подводке или разводке.
   • PIPE-002 — замена стояка ППР Ø32 (1.5–3 м, за п.м.). Если прорыв стояка ХВС/ГВС.
   • PIPE-003 — замена канализационной разводки. Если протечка фановой/канализационной трубы.
   • PARTITION-001 — возведение перегородки ГКЛ (если перегородка демонтирована или сильно пострадала).
   • WINDOW-001/002 — замена подоконника/откосов ПВХ. Применяй при заливе через окно, протечке по штапику.
   • SEALANT-001 — герметизация швов плитки/стыков силиконом. Добавляй после новой облицовки в санузле и в местах примыкания ванна/раковина к стене.
   • DEM-010 (плитка ПОЛ) ≠ DEM-005 (плитка СТЕНА) — выбирай по surface.
   • DEM-011 — линолеум/ковролин (ранее не было); DEM-012/013 — стяжка; DEM-014 — деревянный пол.
   • DEM-016..019 — демонтаж разных типов перегородок; DEM-020/021 — штукатурка/шпаклёвка со стен; DEM-022 — стеновые панели.
   • DEM-024..026 — демонтаж потолочных покрытий до основания.
   • DEM-027..033 — окна, двери, откосы, подоконник.
   • DEM-034..041 — сантехника (ванна/душ/унитаз/раковина/смеситель/полотенцесушитель/трубы).
   • DEM-042..048 — электрика (розетки/проводка/щит/люстры/светильники/кондиционер).
   • DEM-049..051 — кухня/встройка/шкафы.
   • DEM-052/053 — радиатор / вентрешётка.
   • DEM-054/055 — мусор и вывоз.
2. summary — 2-4 предложения профессионального заключения
3. average_confidence — среднее по всем фото

4. Три НЕЗАВИСИМЫЕ оценки площади повреждения (каждая — ровно той области, что пострадала; НЕ размер помещения).

   ВАЖНО ДЛЯ ПОЛЯ "source": это не короткий тег, а ЧЕЛОВЕКОЧИТАЕМОЕ ПОЯСНЕНИЕ, как получено значение. Всегда включай конкретные размеры (ширину, высоту, диаметр и т.п.), что именно измерялось, и по какой опоре. Формат: «{метод} — {что и где повреждено + размеры} = {~X м²}». Одно предложение.

   а) area_from_measure — ТОЛЬКО если есть скриншот из приложения Apple «Рулетка» (белые линии с цифрами "X см" / "X.XX м"), И эти цифры показывают ГРАНИЦЫ ПОВРЕЖДЕНИЯ (а не посторонний объект — кабельный люк, розетку, дверь). Примеры source:
      - "Measure — 40×50 см контур пятна на стене = ~0.2 м²"
      - "Measure — 1.2×0.8 м вспучивание ламината в спальне = ~0.96 м²"
      - если в кадре только 12 см диаметр кабельного люка (не повреждение) → null

   б) area_from_reference — ТОЛЬКО если в кадре виден масштабный объект (банковская карта 85.6×54 мм, монета 10₽ диаметр 22 мм, дверная ручка, розетка 86 мм) И ты можешь по нему оценить повреждение точнее чем "на глаз". Примеры source:
      - "банковская карта у пятна — пятно ~4 карты в ширину и ~5 в высоту → ~0.34×0.27 м = ~0.09 м²"
      - "розетка 86 мм рядом со сколом плитки — скол ~3 розетки в ширину, ~4 в высоту → ~0.26×0.34 м = ~0.09 м²"
      - Масштабных объектов нет → null

   в) area_visual — ВСЕГДА заполняй. Оценка «на глаз» из контекста помещения и типичных размеров. В source опиши рассуждение с размерами. Примеры:
      - "визуальная оценка — ниша шириной ~0.3 м, высота повреждённого участка ~2 м, плитка отсутствует на ~0.6 м²"
      - "визуальная оценка — жёлтое пятно на потолке кухни ~0.7×0.7 м ≈ 0.5 м², без плесени"
      - "визуальная оценка — вспучивание ламината вдоль стены спальни ~3×2 м = ~6 м²"

Эти три оценки НЕЗАВИСИМЫ. Если Measure показывает 0.2 м², а визуально кажется 4 м² — значит визуальная оценка завышена, оставь 0.2 в measure и 4 в visual. Сервер сам выберет приоритетный источник.

ВАЖНО:
- Цены НЕ выдумывай. Возвращай только коды работ
- Если масштабных объектов нет в кадре — оценивай площадь из контекста (тип помещения, размеры)
- Если на фото виден скриншот из приложения Apple «Рулетка» (Measure) — с белыми линиями-замерами и цифрами в формате "XX см", "X.XX м", "X' Y"" — ИСПОЛЬЗУЙ ЭТИ ЦИФРЫ КАК ТОЧНЫЕ. Они имеют приоритет над визуальной оценкой. В sub_findings отметь "measure_screenshot: true"
- Используй few-shot примеры ниже для калибровки

Few-shot примеры:
${FEW_SHOT_CASES}

5. act_document — отдельный анализ фотографии акта от компетентного органа.
   Если в подписи фото указан sceneId="act_document", это специальная фотография
   документа (акт от УК / МЧС / полиции / ЖЭК / ТСЖ и т.п.). По нему:
   - found: true если фото действительно похоже на официальный документ (бланк,
     печать, подпись, реквизиты органа). false если это фото повреждения, а не
     документа.
   - event_confirmed: true ТОЛЬКО если в тексте акта явно описан факт страхового
     события — слова «залив», «затопление», «протечка», «пожар», «возгорание»,
     «взлом», «кража», «хищение», «ущерб», «авария», «повреждение» в контексте
     адреса или конкретного помещения. false если документ есть, но события не
     подтверждает (например, просто справка о составе семьи).
   - ocr_text: обрезанная до ~600 символов выжимка из распознанного текста
     документа. Только то, что относится к событию: дата, адрес, описание,
     подпись, орган. Без повторов и шума.
   - issuing_authority: краткий ярлык органа («ТСЖ», «УК», «МЧС», «Полиция»,
     «ЖЭК», «Иное»). Если из документа невозможно определить — пустая строка.
   Если sceneId="act_document" фото нет среди приложенных, верни
   { "found": false, "event_confirmed": false, "ocr_text": "", "issuing_authority": "" }.
   Не путай: фотография повреждения с аккуратным углом — это НЕ акт.

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
  "recommended_works": [
    {
      "code": "CODE-001",
      "surface": "ceiling" | "wall" | "floor" | "doorway" | "window",
      "material_predicted": "<одно из enum выше>",
      "area_m2": 0.0
    }
  ],
  "summary": "...",
  "average_confidence": 0.0,
  "area_from_measure": { "value": 0.0, "source": "..." } | null,
  "area_from_reference": { "value": 0.0, "source": "..." } | null,
  "area_visual": { "value": 0.0, "source": "визуальная оценка" },
  "act_document": {
    "found": false,
    "event_confirmed": false,
    "ocr_text": "",
    "issuing_authority": ""
  }
}`;

export function buildUserMessage(
  context: IncidentContext,
  photos: Array<{ base64: string; sceneId?: string }>,
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
    const sceneTag = photos[i].sceneId ? ` [sceneId="${photos[i].sceneId}"]` : "";
    content.push({
      type: "text",
      text: `Фото ${i + 1}${sceneTag}:`,
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

  const validSurfaces = new Set(["ceiling", "wall", "floor", "doorway", "window"]);
  function normalizeWork(raw: unknown): import("@/types").WorkSpec | null {
    // Legacy: AI returned a bare code string. Wrap it.
    if (typeof raw === "string") {
      return { code: raw };
    }
    if (!raw || typeof raw !== "object") return null;
    const r = raw as Record<string, unknown>;
    if (typeof r.code !== "string" || r.code.length === 0) return null;
    const surface =
      typeof r.surface === "string" && validSurfaces.has(r.surface)
        ? (r.surface as import("@/types").Surface)
        : undefined;
    const material_predicted =
      typeof r.material_predicted === "string" && r.material_predicted.length > 0
        ? r.material_predicted
        : undefined;
    const area_m2 =
      typeof r.area_m2 === "number" && r.area_m2 > 0
        ? Math.round(r.area_m2 * 100) / 100
        : undefined;
    return { code: r.code, surface, material_predicted, area_m2 };
  }

  const recommended_works = (obj.recommended_works as unknown[])
    .map(normalizeWork)
    .filter((w): w is import("@/types").WorkSpec => w !== null);

  return {
    photos,
    recommended_works,
    summary: String(obj.summary),
    average_confidence: typeof obj.average_confidence === "number" ? obj.average_confidence : 0.7,
    area_from_measure: pickEstimate(obj.area_from_measure),
    area_from_reference: pickEstimate(obj.area_from_reference),
    area_visual,
  };
}
