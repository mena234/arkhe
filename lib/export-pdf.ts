import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { calculateRollups, formatCurrency, itemTotal } from "./calculations";
import type { ArkheData, SpecificationItem } from "./types";

export function buildPdf(data: ArkheData, items: SpecificationItem[], generatedAt = new Date()) {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const names = new Map(data.spaces.map((space) => [space.id, space.name]));
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  doc.setProperties({ title: `${data.project.name} — Specification Schedule`, author: "Arkhe", subject: "Material specification schedule" });
  doc.setTextColor(38, 35, 31).setFont("helvetica", "bold").setFontSize(23);
  doc.text("ARKHE", 40, 42);
  doc.setFont("helvetica", "normal").setFontSize(10);
  doc.text("SPATIAL SPECIFICATION SCHEDULE", 40, 60);
  doc.setFontSize(16);
  doc.text(doc.splitTextToSize(data.project.name, width - 80), 40, 87);
  doc.setFontSize(9).setTextColor(100, 95, 88);
  doc.text(doc.splitTextToSize(`${data.project.client} | ${data.project.location} | ${data.project.status}`, width - 80), 40, 107);
  doc.text(`Generated ${generatedAt.toLocaleDateString("en-US", { dateStyle: "long" })} | USD | ${items.length} items`, 40, 124);
  autoTable(doc, {
    startY: 143,
    head: [["Item", "Space", "Category", "Supplier", "Qty", "Unit price", "Total", "Lead", "Status"]],
    body: items.map((item) => [item.name, names.get(item.spaceId) ?? "", item.category, item.supplier, item.quantity, formatCurrency(item.unitPrice), formatCurrency(itemTotal(item)), `${item.leadTimeWeeks} wks`, item.status]),
    styles: { font: "helvetica", fontSize: 8, textColor: [56, 52, 47], cellPadding: 6, overflow: "linebreak", lineColor: [222, 217, 209], lineWidth: { bottom: 0.5 } },
    headStyles: { fillColor: [240, 237, 232], textColor: [56, 52, 47], fontStyle: "bold", lineWidth: 0 },
    alternateRowStyles: { fillColor: [249, 248, 245] },
    columnStyles: { 0: { cellWidth: 130 }, 1: { cellWidth: 80 }, 3: { cellWidth: 95 }, 4: { halign: "right" }, 5: { halign: "right" }, 6: { halign: "right" } },
    margin: { left: 40, right: 40, top: 40, bottom: 45 },
    rowPageBreak: "avoid",
  });
  let y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 25;
  if (y + 60 > height - 35) { doc.addPage(); y = 50; }
  doc.setDrawColor(184, 177, 168).line(40, y, width - 40, y);
  doc.setFont("helvetica", "bold").setFontSize(12).setTextColor(38, 35, 31);
  doc.text("SCHEDULE TOTAL", 40, y + 23);
  doc.text(formatCurrency(calculateRollups(items).totalValue), width - 40, y + 23, { align: "right" });
  doc.setFont("helvetica", "normal").setFontSize(8);
  doc.text("Pricing excludes freight, tax, and installation unless specified. Confirm availability and pricing with suppliers before ordering.", 40, y + 45);
  for (let page = 1; page <= doc.getNumberOfPages(); page++) {
    doc.setPage(page).setFontSize(8).setTextColor(110, 105, 98);
    doc.text("ARKHE | Specification schedule", 40, height - 20);
    doc.text(`${page} / ${doc.getNumberOfPages()}`, width - 40, height - 20, { align: "right" });
  }
  return doc;
}
