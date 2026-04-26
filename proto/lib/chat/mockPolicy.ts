// Demo-only mock for the "found policy" suggestion. In prod, replace with a
// real policy lookup by ФИО + телефон.

export interface MockPolicy {
  number: string;
  type: string;
  address: string;
  region: string; // internal key, matches data/region_coefficients.json
  apartment_area_m2: number;
  finish_level: "econom" | "standard" | "comfort" | "premium";
  valid_from: string;  // ISO yyyy-mm-dd
  valid_until: string;
  insured_sum_rub: number;
}

const ADDRESSES: Array<Omit<MockPolicy, "number" | "type" | "valid_from" | "valid_until" | "insured_sum_rub">> = [
  { address: "Москва, Тверская ул., д. 12, кв. 45", region: "moscow", apartment_area_m2: 54, finish_level: "standard" },
  { address: "Москва, Кутузовский просп., д. 26, кв. 78", region: "moscow", apartment_area_m2: 72, finish_level: "comfort" },
  { address: "Санкт-Петербург, Невский просп., д. 88, кв. 12", region: "spb", apartment_area_m2: 48, finish_level: "standard" },
  { address: "Москва, ул. Покровка, д. 4, кв. 23", region: "moscow", apartment_area_m2: 38, finish_level: "econom" },
  { address: "Москва, Ленинский просп., д. 70, кв. 110", region: "moscow", apartment_area_m2: 92, finish_level: "premium" },
  { address: "Екатеринбург, ул. Малышева, д. 84, кв. 17", region: "ekb", apartment_area_m2: 64, finish_level: "comfort" },
  { address: "Казань, ул. Баумана, д. 21, кв. 9", region: "kazan", apartment_area_m2: 51, finish_level: "standard" },
];

const SUMS = [2_500_000, 3_500_000, 4_800_000, 6_200_000];

function pad(n: number, width: number): string {
  return String(n).padStart(width, "0");
}

export function randomPolicy(): MockPolicy {
  const a = ADDRESSES[Math.floor(Math.random() * ADDRESSES.length)];
  const today = new Date();
  // Random validity window: started 1–11 months ago, ends 12 months after start.
  const monthsAgo = 1 + Math.floor(Math.random() * 11);
  const validFrom = new Date(today.getFullYear(), today.getMonth() - monthsAgo, 1);
  const validUntil = new Date(validFrom.getFullYear() + 1, validFrom.getMonth(), validFrom.getDate());
  const number = `СБС-${validFrom.getFullYear()}-${pad(Math.floor(Math.random() * 1_000_000_00), 8)}`;
  return {
    number,
    type: "Страхование квартиры от залива и иных рисков",
    address: a.address,
    region: a.region,
    apartment_area_m2: a.apartment_area_m2,
    finish_level: a.finish_level,
    valid_from: validFrom.toISOString().split("T")[0],
    valid_until: validUntil.toISOString().split("T")[0],
    insured_sum_rub: SUMS[Math.floor(Math.random() * SUMS.length)],
  };
}
