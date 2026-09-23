import { describe, expect, it } from "vitest";
import { validateItem, validateUpload } from "../lib/validation";
import { demoData } from "../lib/demo-data";
import { buildCsv } from "../lib/calculations";
import { buildPdf } from "../lib/export-pdf";
describe("safe schedule inputs and exports", () => {
  it("rejects invalid numbers, statuses, and unsafe image URLs", () => {
    for (const patch of [{ quantity: -1 }, { unitPrice: Infinity }, { leadTimeWeeks: 1.5 }, { status: "Oops" }, { imageUrl: "javascript:alert(1)" }]) expect(() => validateItem({ ...demoData.items[0], ...patch })).toThrow();
    expect(validateItem(demoData.items[0]).name).toBe(demoData.items[0].name);
  });
  it("limits attachment size and accepted formats", () => {
    expect(() => validateUpload({ name: "test.svg", type: "image/svg+xml", size: 100 })).toThrow();
    expect(() => validateUpload({ name: "test.pdf", type: "application/pdf", size: 11 * 1024 * 1024 })).toThrow();
  });
  it("neutralizes spreadsheet formulas and escapes multiline notes", () => {
    const csv = buildCsv([{ ...demoData.items[0], name: "=HYPERLINK(\"https://evil.test\")", notes: "line 1\nline 2" }], demoData.spaces);
    expect(csv).toContain("'=HYPERLINK"); expect(csv).toContain('"line 1\nline 2"');
  });
  it("generates an actual multi-page PDF with a total", () => {
    const items = Array.from({ length: 80 }, (_, i) => ({ ...demoData.items[i % 12], id: String(i) }));
    const doc = buildPdf(demoData, items, new Date("2026-09-14"));
    expect(doc.getNumberOfPages()).toBeGreaterThan(1);
    const output = doc.output(); expect(output.startsWith("%PDF-")).toBe(true); expect(output).toContain("SCHEDULE TOTAL"); expect(output).toContain("Soho Residence");
  });
});
