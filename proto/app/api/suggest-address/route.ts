import { NextRequest, NextResponse } from "next/server";

interface DadataSuggestion {
  value: string;
  unrestricted_value: string;
  data: {
    region_iso_code?: string;
    region_kladr_id?: string;
    region?: string;
    region_with_type?: string;
    [key: string]: unknown;
  };
}

interface DadataResponse {
  suggestions: DadataSuggestion[];
}

interface OutSuggestion {
  value: string;
  region_iso_code?: string;
  region?: string;
}

// Demo fallback — used when DADATA_API_KEY is not configured. Lets the chat
// flow show real-looking address suggestions in dev/preview.
const MOCK_ADDRESSES: OutSuggestion[] = [
  // Москва
  { value: "г Москва, ул Ленина, д 1", region_iso_code: "RU-MOW", region: "Москва" },
  { value: "г Москва, ул Ленина, д 5", region_iso_code: "RU-MOW", region: "Москва" },
  { value: "г Москва, ул Ленина, д 12", region_iso_code: "RU-MOW", region: "Москва" },
  { value: "г Москва, ул Ленина, д 24, к 1", region_iso_code: "RU-MOW", region: "Москва" },
  { value: "г Москва, Ленинский пр-кт, д 1", region_iso_code: "RU-MOW", region: "Москва" },
  { value: "г Москва, Ленинский пр-кт, д 70", region_iso_code: "RU-MOW", region: "Москва" },
  { value: "г Москва, Ленинский пр-кт, д 109", region_iso_code: "RU-MOW", region: "Москва" },
  { value: "г Москва, Тверская ул, д 12", region_iso_code: "RU-MOW", region: "Москва" },
  { value: "г Москва, Тверская ул, д 22", region_iso_code: "RU-MOW", region: "Москва" },
  { value: "г Москва, Кутузовский пр-кт, д 26", region_iso_code: "RU-MOW", region: "Москва" },
  { value: "г Москва, Кутузовский пр-кт, д 30", region_iso_code: "RU-MOW", region: "Москва" },
  { value: "г Москва, ул Покровка, д 4", region_iso_code: "RU-MOW", region: "Москва" },
  { value: "г Москва, ул Покровка, д 22", region_iso_code: "RU-MOW", region: "Москва" },
  { value: "г Москва, ул Арбат, д 35", region_iso_code: "RU-MOW", region: "Москва" },
  { value: "г Москва, ул Арбат, д 51", region_iso_code: "RU-MOW", region: "Москва" },
  { value: "г Москва, Профсоюзная ул, д 12", region_iso_code: "RU-MOW", region: "Москва" },
  { value: "г Москва, ул Маросейка, д 6/8 с 1", region_iso_code: "RU-MOW", region: "Москва" },
  { value: "г Москва, ул Большая Никитская, д 24/1 с 1", region_iso_code: "RU-MOW", region: "Москва" },
  { value: "г Москва, Садовая-Кудринская ул, д 22", region_iso_code: "RU-MOW", region: "Москва" },

  // Санкт-Петербург
  { value: "г Санкт-Петербург, Невский пр-кт, д 28", region_iso_code: "RU-SPE", region: "Санкт-Петербург" },
  { value: "г Санкт-Петербург, Невский пр-кт, д 88", region_iso_code: "RU-SPE", region: "Санкт-Петербург" },
  { value: "г Санкт-Петербург, ул Рубинштейна, д 7", region_iso_code: "RU-SPE", region: "Санкт-Петербург" },
  { value: "г Санкт-Петербург, ул Рубинштейна, д 23", region_iso_code: "RU-SPE", region: "Санкт-Петербург" },
  { value: "г Санкт-Петербург, ул Восстания, д 14", region_iso_code: "RU-SPE", region: "Санкт-Петербург" },
  { value: "г Санкт-Петербург, Лиговский пр-кт, д 50", region_iso_code: "RU-SPE", region: "Санкт-Петербург" },
  { value: "г Санкт-Петербург, Литейный пр-кт, д 24", region_iso_code: "RU-SPE", region: "Санкт-Петербург" },

  // Екатеринбург
  { value: "г Екатеринбург, ул Малышева, д 84", region_iso_code: "RU-SVE", region: "Свердловская область" },
  { value: "г Екатеринбург, ул Ленина, д 24/8", region_iso_code: "RU-SVE", region: "Свердловская область" },
  { value: "г Екатеринбург, ул Куйбышева, д 44", region_iso_code: "RU-SVE", region: "Свердловская область" },

  // Новосибирск
  { value: "г Новосибирск, Красный пр-кт, д 22", region_iso_code: "RU-NVS", region: "Новосибирская область" },
  { value: "г Новосибирск, ул Ленина, д 9", region_iso_code: "RU-NVS", region: "Новосибирская область" },

  // Казань
  { value: "г Казань, ул Баумана, д 21", region_iso_code: "RU-TA", region: "Республика Татарстан" },
  { value: "г Казань, ул Баумана, д 60", region_iso_code: "RU-TA", region: "Республика Татарстан" },
  { value: "г Казань, ул Кремлёвская, д 12", region_iso_code: "RU-TA", region: "Республика Татарстан" },

  // Краснодар, Воронеж
  { value: "г Краснодар, ул Красная, д 40", region_iso_code: "RU-KDA", region: "Краснодарский край" },
  { value: "г Краснодар, ул Красная, д 124", region_iso_code: "RU-KDA", region: "Краснодарский край" },
  { value: "г Воронеж, ул Кирова, д 9", region_iso_code: "RU-VOR", region: "Воронежская область" },
];

function mockSuggest(query: string): OutSuggestion[] {
  const q = query.toLowerCase().trim();
  if (q.length < 2) return [];
  // Tokenize the query and require every token to appear (case-insensitive) in
  // the address. Lets users type "москва ленина" and still match.
  const tokens = q.split(/[\s,]+/).filter(Boolean);
  return MOCK_ADDRESSES.filter((a) => {
    const v = a.value.toLowerCase();
    return tokens.every((t) => v.includes(t));
  }).slice(0, 7);
}

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("q");
  if (!query || query.length < 2) {
    return NextResponse.json({ suggestions: [] });
  }

  const token = process.env.DADATA_API_KEY;
  if (!token) {
    return NextResponse.json({ suggestions: mockSuggest(query), mock: true });
  }

  try {
    const res = await fetch(
      "https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/address",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Token ${token}`,
        },
        body: JSON.stringify({ query, count: 7, from_bound: { value: "city" }, to_bound: { value: "house" } }),
      }
    );
    if (!res.ok) {
      // Fall back to local mock if upstream is down — keeps the demo usable.
      return NextResponse.json({ suggestions: mockSuggest(query), mock: true });
    }
    const data = (await res.json()) as DadataResponse;
    return NextResponse.json({
      suggestions: (data.suggestions ?? []).map((s) => ({
        value: s.value,
        region_iso_code: s.data?.region_iso_code,
        region: s.data?.region,
      })),
    });
  } catch {
    return NextResponse.json({ suggestions: mockSuggest(query), mock: true });
  }
}
