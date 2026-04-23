"use client";

import type { Report, IncidentContext } from "@/types";

function rub(n: number) {
  return new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(n);
}

export async function generatePDF(
  report: Report,
  context: IncidentContext,
  photos: string[]
): Promise<void> {
  const html = buildHTML(report, context, photos);
  const win = window.open("", "_blank");
  if (!win) {
    alert("Разрешите всплывающие окна в браузере для сохранения PDF");
    return;
  }
  win.document.write(html);
  win.document.close();
  setTimeout(() => { win.focus(); win.print(); }, 600);
}

function buildHTML(report: Report, context: IncidentContext, photos: string[]): string {
  const worksTotal = report.works.reduce((s, w) => s + w.total, 0);
  const matsTotal = report.materials.reduce((s, m) => s + m.total, 0);

  const worksRows = report.works.map((w) => `
    <tr>
      <td class="mono">${w.code}</td>
      <td>${w.name}</td>
      <td class="center">${w.volume} ${w.unit}</td>
      <td class="right">${rub(w.unit_price)}</td>
      <td class="right bold">${rub(w.total)}</td>
    </tr>`).join("");

  const matsRows = report.materials.map((m) => `
    <tr>
      <td class="mono">${m.code}</td>
      <td>${m.name}</td>
      <td class="center">${m.volume} ${m.unit}</td>
      <td class="right">${rub(m.unit_price)}</td>
      <td class="right bold">${rub(m.total)}</td>
    </tr>`).join("");

  const photosToShow = photos.slice(0, 3);
  const photoImgs = photosToShow.map((b64) =>
    `<img src="data:image/jpeg;base64,${b64}" />`
  ).join("");

  const eventTypeLabels: Record<string, string> = {
    flood: "Залив квартиры",
    fire: "Пожар",
    theft: "Взлом / кража",
    natural: "Стихийное бедствие",
  };
  const eventTypeLabel = eventTypeLabels[context.event_type] ?? "—";

  const caseId = (context.id ?? "").slice(0, 8).toUpperCase();
  const date = new Date().toLocaleDateString("ru-RU");
  const confidence = Math.round(report.claude_output.average_confidence * 100);

  return `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<title>Отчёт об оценке ущерба — ${caseId}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Golos+Text:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { background: #f5f6f7; }
  body {
    font-family: "Golos Text", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 12px;
    color: #1a1a1a;
    padding: 24px;
    max-width: 860px;
    margin: 0 auto;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  /* Hero */
  .hero {
    background: #21A038;
    color: #fff;
    border-radius: 24px;
    padding: 28px 32px;
    margin-bottom: 14px;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 20px;
    position: relative;
    overflow: hidden;
  }
  .hero-brand { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; font-weight: 700; font-size: 13px; letter-spacing: 0.02em; opacity: 0.9; }
  .hero-logo { width: 30px; height: 30px; background: rgba(255,255,255,0.2); border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; font-size: 16px; font-weight: 800; color: #fff; }
  .hero-label { font-size: 13px; opacity: 0.85; margin-bottom: 6px; font-weight: 500; }
  .hero-amount { font-size: 42px; font-weight: 800; letter-spacing: -0.03em; line-height: 1; }
  .hero-range { font-size: 12px; opacity: 0.85; margin-top: 8px; }
  .hero-meta { text-align: right; font-size: 11px; opacity: 0.9; line-height: 1.6; }
  .hero-meta strong { font-weight: 600; font-size: 12px; display: block; }

  /* Generic card */
  .card {
    background: #fff;
    border-radius: 20px;
    padding: 20px 24px;
    margin-bottom: 12px;
  }
  .card h2 {
    font-size: 15px;
    font-weight: 700;
    color: #1a1a1a;
    margin-bottom: 14px;
    letter-spacing: -0.01em;
  }
  .card-sm { padding: 14px 18px; }

  /* Disclaimer */
  .disclaimer {
    background: #fff;
    border-radius: 16px;
    padding: 14px 18px;
    font-size: 11px;
    color: #7b5e00;
    margin-bottom: 12px;
    display: flex;
    align-items: flex-start;
    gap: 12px;
  }
  .disclaimer-icon { width: 32px; height: 32px; background: #fff8e1; border-radius: 10px; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: 16px; }
  .disclaimer-text strong { color: #1a1a1a; font-size: 12px; display: block; margin-bottom: 2px; }

  /* Two-column grid */
  .two-col {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin-bottom: 12px;
    align-items: stretch;
  }
  .two-col > .card { height: 100%; display: flex; flex-direction: column; }
  .two-col > .card > *:last-child { margin-top: auto; }
  .info-grid { display: grid; grid-template-columns: 130px 1fr; gap: 8px 14px; font-size: 11px; line-height: 1.5; }
  .info-label { color: #8a8a8a; }
  .info-value { color: #1a1a1a; }
  .info-value-block { white-space: pre-wrap; }

  /* AI Summary */
  .summary-text { font-size: 12px; line-height: 1.55; color: #333; margin-bottom: 10px; }
  .source-line { font-size: 11px; color: #666; line-height: 1.5; padding-top: 8px; border-top: 1px solid #eceef0; }
  .source-line strong { color: #1a1a1a; font-weight: 600; }
  .confidence-chip {
    display: inline-flex; align-items: center; gap: 6px;
    background: #e8f5ea; color: #21A038;
    padding: 4px 10px; border-radius: 999px;
    font-size: 11px; font-weight: 600;
    margin-top: 10px;
  }

  /* Photos */
  .photos { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
  .photos img { width: 100%; height: 320px; border-radius: 14px; object-fit: cover; }

  /* Tables */
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th {
    text-align: left;
    padding: 10px 10px;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #8a8a8a;
    font-weight: 600;
    border-bottom: 1px solid #eceef0;
  }
  td { padding: 10px 10px; border-bottom: 1px solid #f3f4f5; color: #1a1a1a; }
  tr:last-child td { border-bottom: none; }
  .total-row td { background: #f5f6f7; font-weight: 700; border-bottom: none; }
  .total-row td:first-child { border-top-left-radius: 12px; border-bottom-left-radius: 12px; }
  .total-row td:last-child { border-top-right-radius: 12px; border-bottom-right-radius: 12px; }
  .mono { font-family: "SFMono-Regular", Menlo, Consolas, monospace; color: #a0a0a0; font-size: 10px; }
  .right { text-align: right; }
  .center { text-align: center; }
  .bold { font-weight: 700; }

  /* Total box */
  .total-box {
    background: #21A038;
    color: #fff;
    border-radius: 24px;
    padding: 24px 28px;
    margin-top: 12px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 20px;
  }
  .total-box .label { font-size: 12px; opacity: 0.85; margin-bottom: 4px; font-weight: 500; }
  .total-box .value { font-size: 30px; font-weight: 800; letter-spacing: -0.02em; line-height: 1; }
  .total-box .sub { font-size: 11px; opacity: 0.8; margin-top: 6px; }
  .total-box .breakdown { text-align: right; font-size: 12px; opacity: 0.9; }
  .total-box .breakdown strong { font-size: 14px; font-weight: 700; opacity: 1; }

  /* Expert warning */
  .expert-warning {
    background: #fff3cd;
    border-radius: 16px;
    padding: 14px 18px;
    font-size: 11px;
    color: #856404;
    margin-top: 12px;
    display: flex;
    align-items: flex-start;
    gap: 12px;
  }
  .expert-warning-icon { width: 32px; height: 32px; background: #fff8e1; border-radius: 10px; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: 16px; }

  .footer { font-size: 10px; color: #a0a0a0; margin-top: 18px; text-align: center; letter-spacing: 0.02em; }

  @media print {
    body { padding: 12px; background: #f5f6f7; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .hero, .total-box, .card, .disclaimer, .expert-warning { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .photos img { height: 260px; }
    .two-col { gap: 10px; }
  }
</style>
</head>
<body>

<div class="hero">
  <div>
    <div class="hero-brand"><span class="hero-logo">S</span> Claim Assistant · Отчёт</div>
    <div class="hero-label">Предварительная оценка ущерба</div>
    <div class="hero-amount">${rub(report.range.base)}</div>
    <div class="hero-range">Диапазон: ${rub(report.range.min)} — ${rub(report.range.max)} · ±${Math.round(report.sigma * 100)}%</div>
  </div>
  <div class="hero-meta">
    <strong>Кейс ${caseId}</strong>
    ${date}
  </div>
</div>

<div class="disclaimer">
  <span class="disclaimer-icon">⚠</span>
  <div class="disclaimer-text">
    <strong>Прототип</strong>
    Данные не передаются в страховую компанию. Используется для UX-тестирования и демонстрации.
  </div>
</div>

<div class="two-col">
  <div class="card">
    <h2>Данные клиента и инцидента</h2>
    <div class="info-grid">
      <span class="info-label">ФИО</span><span class="info-value">${context.name || "—"}</span>
      <span class="info-label">Телефон</span><span class="info-value">${context.phone || "—"}</span>
      <span class="info-label">Адрес</span><span class="info-value">${context.address || "—"}</span>
      <span class="info-label">Площадь квартиры</span><span class="info-value">${context.apartment_area_m2} м²</span>
      <span class="info-label">Площадь ущерба</span><span class="info-value">${report.area_pick?.value ?? context.affected_area_m2 ?? "—"} м²</span>
      <span class="info-label">Год ремонта</span><span class="info-value">${context.last_renovation_year}</span>
      <span class="info-label">Категория ущерба</span><span class="info-value">${eventTypeLabel}</span>
      ${context.event_date ? `<span class="info-label">Дата события</span><span class="info-value">${context.event_date}</span>` : ""}
      <span class="info-label">Описание инцидента</span><span class="info-value info-value-block">${context.incident_description || "—"}</span>
    </div>
  </div>
  <div class="card">
    <h2>AI-заключение</h2>
    <div class="summary-text">${report.claude_output.summary || "—"}</div>
    ${report.area_pick ? `<div class="source-line"><strong>Площадь повреждений:</strong> ${report.area_pick.value} м² — источник: ${report.area_pick.source || "не указан"}</div>` : ""}
    <div class="confidence-chip">Уверенность AI · ${confidence}%</div>
  </div>
</div>

${photos.length > 0 ? `
<div class="card">
  <h2>Фотографии (${photosToShow.length} из ${photos.length})</h2>
  <div class="photos">${photoImgs}</div>
</div>` : ""}

${report.works.length > 0 ? `
<div class="card">
  <h2>Перечень работ</h2>
  <table>
    <thead><tr><th>Код</th><th>Наименование</th><th class="center">Объём</th><th class="right">Цена / ед.</th><th class="right">Итого</th></tr></thead>
    <tbody>
      ${worksRows}
      <tr class="total-row">
        <td colspan="4" class="right">Итого работы:</td>
        <td class="right">${rub(worksTotal)}</td>
      </tr>
    </tbody>
  </table>
</div>` : ""}

${report.materials.length > 0 ? `
<div class="card">
  <h2>Материалы</h2>
  <table>
    <thead><tr><th>Код</th><th>Наименование</th><th class="center">Объём</th><th class="right">Цена / ед.</th><th class="right">Итого</th></tr></thead>
    <tbody>
      ${matsRows}
      <tr class="total-row">
        <td colspan="4" class="right">Итого материалы:</td>
        <td class="right">${rub(matsTotal)}</td>
      </tr>
    </tbody>
  </table>
</div>` : ""}

<div class="total-box">
  <div>
    <div class="label">Итоговая оценка ущерба</div>
    <div class="value">${rub(report.range.base)}</div>
    <div class="sub">Диапазон: ${rub(report.range.min)} — ${rub(report.range.max)}</div>
  </div>
  <div class="breakdown">
    <div class="label">Работы + материалы</div>
    <strong>${rub(worksTotal)} + ${rub(matsTotal)}</strong>
  </div>
</div>

${report.routed_to_expert ? `
<div class="expert-warning">
  <span class="expert-warning-icon">⚠</span>
  <div>Кейс передан эксперту — сумма превышает порог автоматического урегулирования.</div>
</div>` : ""}

<div class="footer">
  Сформировано автоматически · ${new Date().toLocaleString("ru-RU")} · Кейс ${caseId}
</div>

</body>
</html>`;
}
