import { describe, expect, it } from "vitest";
import { buildCsv, calculateRollups, filterItems, itemTotal, sortItems } from "@/lib/calculations";
import { demoData } from "@/lib/demo-data";

describe("specification calculations", () => {
  it("calculates line totals and project rollups", () => {
    expect(itemTotal({ quantity: 3, unitPrice: 12.5 })).toBe(37.5);
    const rollups = calculateRollups(demoData.items);
    expect(rollups.itemCount).toBe(12);
    expect(rollups.totalValue).toBeGreaterThan(0);
    expect(rollups.approvedValue).toBeLessThan(rollups.totalValue);
    expect(rollups.longLeadCount).toBe(5);
  });

  it("filters by room and status without mutating the source", () => {
    const result = filterItems(demoData.items, { query: "", spaceId: "space-living", category: "", status: "Reviewing" });
    expect(result.map((item) => item.name)).toEqual(["Rift-Cut Oak Wall Panel", "Hand-Knotted Wool Area Rug"]);
    expect(demoData.items).toHaveLength(12);
  });

  it("sorts calculated totals and exports a quoted CSV", () => {
    const sorted = sortItems(demoData.items, demoData.spaces, "total", "desc");
    expect(itemTotal(sorted[0])).toBeGreaterThanOrEqual(itemTotal(sorted[1]));
    const csv = buildCsv(demoData.items, demoData.spaces);
    expect(csv).toContain('"Item","Space","Category"');
    expect(csv).toContain('"Honed Travertine Floor Tile"');
  });
});
