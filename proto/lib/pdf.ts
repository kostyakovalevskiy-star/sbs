"use client";

import type { Report, IncidentContext } from "@/types";
import { formatRub, formatDate } from "./utils";

export async function generatePDF(
  report: Report,
  context: IncidentContext,
  photos: string[]
): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  let y = margin;

  // --- Header ---
  doc.setFillColor(33, 160, 56); // sber green
  doc.rect(0, 0, pageWidth, 20, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Claim Assistant", margin, 13);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Кейс: ${context.id.slice(0, 8).toUpperCase()}`, pageWidth - margin - 50, 8);
  doc.text(`Дата: ${formatDate(new Date().toISOString())}`, pageWidth - margin - 50, 14);

  y = 28;

  // --- Disclaimer ---
  doc.setTextColor(180, 0, 0);
  doc.setFontSize(8);
  doc.text(
    "ПРОТОТИП — Данные не передаются в страховую компанию. Оценка носит ориентировочный характер.",
    margin, y, { maxWidth: pageWidth - margin * 2 }
  );
  y += 8;

  // --- Client info ---
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Данные клиента", margin, y);
  y += 5;

  autoTable(doc, {
    startY: y,
    head: [],
    body: [
      ["ФИО", context.name || "—"],
      ["Телефон", context.phone || "—"],
      ["Адрес", context.address || "—"],
      ["Регион", context.region || "—"],
      ["Тип события", "Залив квартиры"],
      ["Площадь повреждений", `${context.affected_area_m2 ?? "—"} м²`],
    ],
    columnStyles: {
      0: { cellWidth: 45, fontStyle: "bold", fillColor: [245, 245, 245] },
      1: { cellWidth: pageWidth - margin * 2 - 45 },
    },
    styles: { fontSize: 9, cellPadding: 2 },
    margin: { left: margin, right: margin },
    theme: "plain",
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;

  // --- AI Summary ---
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("AI-заключение", margin, y);
  y += 5;

  doc.setFillColor(245, 248, 245);
  const summaryLines = doc.splitTextToSize(
    report.claude_output.summary || "Нет данных",
    pageWidth - margin * 2 - 4
  );
  const summaryHeight = summaryLines.length * 5 + 4;
  doc.rect(margin, y, pageWidth - margin * 2, summaryHeight, "F");
  doc.setTextColor(50, 50, 50);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(summaryLines, margin + 2, y + 4);
  y += summaryHeight + 6;
  doc.setTextColor(0, 0, 0);

  // --- Photos ---
  if (photos.length > 0) {
    const photosToShow = photos.slice(0, 6);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Фотографии", margin, y);
    y += 5;

    const cols = 3;
    const imgW = (pageWidth - margin * 2 - (cols - 1) * 3) / cols;
    const imgH = imgW * 0.75;

    for (let i = 0; i < photosToShow.length; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = margin + col * (imgW + 3);
      const imgY = y + row * (imgH + 3);

      if (imgY + imgH > doc.internal.pageSize.getHeight() - margin) {
        doc.addPage();
        y = margin;
      }

      try {
        doc.addImage(
          `data:image/jpeg;base64,${photosToShow[i]}`,
          "JPEG",
          x,
          imgY,
          imgW,
          imgH
        );
      } catch {
        doc.setDrawColor(200);
        doc.rect(x, imgY, imgW, imgH);
        doc.setFontSize(7);
        doc.text(`Фото ${i + 1}`, x + 2, imgY + imgH / 2);
      }
    }

    const rows = Math.ceil(photosToShow.length / cols);
    y += rows * (imgH + 3) + 4;
  }

  // --- Works table ---
  if (report.works.length > 0) {
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Перечень работ", margin, y);
    y += 3;

    autoTable(doc, {
      startY: y,
      head: [["Код", "Наименование", "Ед.", "Объём", "Цена/ед.", "Итого"]],
      body: report.works.map((w) => [
        w.code,
        w.name,
        w.unit,
        w.volume.toString(),
        formatRub(w.unit_price),
        formatRub(w.total),
      ]),
      foot: [["", "", "", "", "Итого работы:", formatRub(report.works.reduce((s, w) => s + w.total, 0))]],
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [33, 160, 56], textColor: 255, fontStyle: "bold" },
      footStyles: { fontStyle: "bold" },
      columnStyles: {
        0: { cellWidth: 18 },
        1: { cellWidth: "auto" },
        2: { cellWidth: 12 },
        3: { cellWidth: 14 },
        4: { cellWidth: 22 },
        5: { cellWidth: 22 },
      },
      margin: { left: margin, right: margin },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 5;
  }

  // --- Materials table ---
  if (report.materials.length > 0) {
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Материалы", margin, y);
    y += 3;

    autoTable(doc, {
      startY: y,
      head: [["Код", "Наименование", "Ед.", "Объём", "Цена/ед.", "Итого"]],
      body: report.materials.map((m) => [
        m.code,
        m.name,
        m.unit,
        m.volume.toString(),
        formatRub(m.unit_price),
        formatRub(m.total),
      ]),
      foot: [["", "", "", "", "Итого материалы:", formatRub(report.materials.reduce((s, m) => s + m.total, 0))]],
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [80, 80, 80], textColor: 255, fontStyle: "bold" },
      footStyles: { fontStyle: "bold" },
      columnStyles: {
        0: { cellWidth: 18 },
        1: { cellWidth: "auto" },
        2: { cellWidth: 12 },
        3: { cellWidth: 14 },
        4: { cellWidth: 22 },
        5: { cellWidth: 22 },
      },
      margin: { left: margin, right: margin },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 5;
  }

  // --- Total ---
  doc.setFillColor(33, 160, 56);
  doc.rect(margin, y, pageWidth - margin * 2, 14, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text(`Базовая оценка: ${formatRub(report.range.base)}`, margin + 4, y + 9);
  doc.setFontSize(9);
  doc.text("до ±15%", pageWidth - margin - 20, y + 9);
  y += 18;

  // --- Footer disclaimer ---
  doc.setTextColor(120, 120, 120);
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text(
    "Оценка сформирована автоматически системой Claim Assistant на основе предоставленных фотоматериалов и носит ориентировочный характер. Данные не передаются в страховую компанию.",
    margin, y, { maxWidth: pageWidth - margin * 2 }
  );

  doc.save(`claim-report-${context.id.slice(0, 8)}.pdf`);
}
