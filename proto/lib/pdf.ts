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

  const photoImgs = photos.slice(0, 6).map((b64) =>
    `<img src="data:image/jpeg;base64,${b64}" />`
  ).join("");

  const caseId = (context.id ?? "").slice(0, 8).toUpperCase();
  const date = new Date().toLocaleDateString("ru-RU");
  const confidence = Math.round(report.claude_output.average_confidence * 100);

  return `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<title>Отчёт об оценке ущерба — ${caseId}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, "Helvetica Neue", Arial, sans-serif; font-size: 12px; color: #111; padding: 24px; max-width: 800px; margin: 0 auto; }
  .header { background: #21A038; color: #fff; border-radius: 8px; padding: 16px 20px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-start; }
  .header-left h1 { font-size: 18px; font-weight: 700; margin-bottom: 4px; }
  .amount { font-size: 30px; font-weight: 800; }
  .range { font-size: 12px; opacity: 0.85; margin-top: 2px; }
  .header-right { text-align: right; font-size: 11px; opacity: 0.85; }
  .disclaimer { background: #fff8e1; border: 1px solid #ffe082; border-radius: 6px; padding: 8px 12px; font-size: 11px; color: #7b5e00; margin-bottom: 16px; }
  h2 { font-size: 13px; font-weight: 700; color: #21A038; border-bottom: 1px solid #e0e0e0; padding-bottom: 4px; margin: 16px 0 8px; }
  .info-grid { display: grid; grid-template-columns: 140px 1fr; gap: 4px 12px; font-size: 11px; }
  .info-label { color: #666; }
  .summary-box { background: #f5faf6; border-radius: 6px; padding: 10px 12px; font-size: 11px; line-height: 1.5; color: #333; margin-bottom: 6px; }
  .confidence { font-size: 11px; color: #666; }
  .photos { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 4px; }
  .photos img { height: 90px; width: auto; border-radius: 4px; object-fit: cover; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 4px; }
  th { background: #f0f0f0; text-align: left; padding: 5px 8px; border-bottom: 2px solid #ccc; font-size: 10px; text-transform: uppercase; color: #555; }
  td { padding: 5px 8px; border-bottom: 1px solid #eee; }
  .total-row td { background: #f0f8f1; font-weight: 700; }
  .mono { font-family: monospace; color: #888; font-size: 10px; }
  .right { text-align: right; }
  .center { text-align: center; }
  .bold { font-weight: 700; }
  .total-box { background: #21A038; color: #fff; border-radius: 8px; padding: 14px 20px; margin-top: 20px; display: flex; justify-content: space-between; align-items: center; }
  .total-box .label { font-size: 12px; opacity: 0.85; }
  .total-box .value { font-size: 22px; font-weight: 800; }
  .total-box .sub { font-size: 11px; opacity: 0.75; margin-top: 2px; }
  .expert-warning { background: #fff3cd; border: 1px solid #ffc107; border-radius: 6px; padding: 8px 12px; font-size: 11px; color: #856404; margin-top: 12px; }
  .footer { font-size: 10px; color: #aaa; margin-top: 16px; text-align: center; }
  @media print {
    body { padding: 12px; }
    .header { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .total-box { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
</head>
<body>

<div class="header">
  <div class="header-left">
    <h1>Claim Assistant</h1>
    <div class="amount">${rub(report.range.base)}</div>
    <div class="range">Диапазон: ${rub(report.range.min)} — ${rub(report.range.max)} (±${Math.round(report.sigma * 100)}%)</div>
  </div>
  <div class="header-right">
    Кейс&nbsp;${caseId}<br>${date}
  </div>
</div>

<div class="disclaimer">
  ⚠ Прототип — данные не передаются в страховую компанию. Используется для UX-тестирования.
</div>

<h2>Данные клиента и инцидента</h2>
<div class="info-grid">
  <span class="info-label">ФИО</span><span>${context.name || "—"}</span>
  <span class="info-label">Телефон</span><span>${context.phone || "—"}</span>
  <span class="info-label">Адрес</span><span>${context.address || "—"}</span>
  <span class="info-label">Регион</span><span>${context.region || "—"}</span>
  <span class="info-label">Площадь квартиры</span><span>${context.apartment_area_m2} м²</span>
  <span class="info-label">Площадь ущерба (в расчёте)</span><span>${report.area_pick?.value ?? context.affected_area_m2 ?? "—"} м² <em style="color:#555">(источник: ${report.area_pick?.source ?? "заявлено клиентом"})</em></span>
  <span class="info-label">Год ремонта</span><span>${context.last_renovation_year}</span>
  <span class="info-label">Уровень отделки</span><span>${context.finish_level ?? "—"}</span>
  ${context.event_date ? `<span class="info-label">Дата события</span><span>${context.event_date}</span>` : ""}
  ${context.ceiling_height ? `<span class="info-label">Высота потолков</span><span>${context.ceiling_height} м</span>` : ""}
</div>

<h2>AI-заключение</h2>
<div class="summary-box">${report.claude_output.summary || "—"}</div>
<div class="confidence">Уверенность AI: ${confidence}%</div>

${photos.length > 0 ? `<h2>Фотографии (${Math.min(photos.length, 6)} из ${photos.length})</h2><div class="photos">${photoImgs}</div>` : ""}

${report.works.length > 0 ? `
<h2>Перечень работ</h2>
<table>
  <thead><tr><th>Код</th><th>Наименование</th><th>Объём</th><th class="right">Цена/ед.</th><th class="right">Итого</th></tr></thead>
  <tbody>
    ${worksRows}
    <tr class="total-row">
      <td colspan="4" class="right">Итого работы:</td>
      <td class="right">${rub(worksTotal)}</td>
    </tr>
  </tbody>
</table>` : ""}

${report.materials.length > 0 ? `
<h2>Материалы</h2>
<table>
  <thead><tr><th>Код</th><th>Наименование</th><th>Объём</th><th class="right">Цена/ед.</th><th class="right">Итого</th></tr></thead>
  <tbody>
    ${matsRows}
    <tr class="total-row">
      <td colspan="4" class="right">Итого материалы:</td>
      <td class="right">${rub(matsTotal)}</td>
    </tr>
  </tbody>
</table>` : ""}

<div class="total-box">
  <div>
    <div class="label">Итоговая оценка ущерба</div>
    <div class="value">${rub(report.range.base)}</div>
    <div class="sub">Диапазон: ${rub(report.range.min)} — ${rub(report.range.max)}</div>
  </div>
  <div style="text-align:right">
    <div class="label">Работы + материалы</div>
    <div style="font-size:14px;font-weight:700">${rub(worksTotal)} + ${rub(matsTotal)}</div>
  </div>
</div>

${report.routed_to_expert ? `
<div class="expert-warning">
  ⚠ Кейс передан эксперту — сумма превышает порог автоматического урегулирования.
</div>` : ""}

<div class="footer">
  Сформировано автоматически системой Claim Assistant · ${new Date().toLocaleString("ru-RU")} · Кейс ${caseId}
</div>

</body>
</html>`;
}
