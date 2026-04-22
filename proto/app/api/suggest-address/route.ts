import { NextRequest, NextResponse } from "next/server";

interface DadataSuggestion {
  value: string;
  unrestricted_value: string;
  data: Record<string, unknown>;
}

interface DadataResponse {
  suggestions: DadataSuggestion[];
}

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("q");
  if (!query || query.length < 2) {
    return NextResponse.json({ suggestions: [] });
  }

  const token = process.env.DADATA_API_KEY;
  if (!token) {
    // No key — graceful degradation, clients will fall back to free text
    return NextResponse.json({ suggestions: [] });
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
    if (!res.ok) return NextResponse.json({ suggestions: [] });
    const data = (await res.json()) as DadataResponse;
    return NextResponse.json({
      suggestions: (data.suggestions ?? []).map((s) => ({ value: s.value })),
    });
  } catch {
    return NextResponse.json({ suggestions: [] });
  }
}
