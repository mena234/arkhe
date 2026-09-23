import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { parseTourStep, positionTourCard, tourKeys, TOUR_LAST_STEP, TOUR_STEPS } from "@/lib/product-tour";

describe("product tour", () => {
  it("accepts only valid, bounded progress from storage or a navigation URL", () => {
    for (let step = 0; step <= TOUR_LAST_STEP; step++) expect(parseTourStep(String(step))).toBe(step);
    for (const value of [null, "", " ", "-1", "1.2", "01", "Infinity", "1e1", "NaN", "9999999999999999999", String(TOUR_LAST_STEP + 1)]) expect(parseTourStep(value)).toBeNull();
  });

  it("keeps first-visit preferences separate for different private projects", () => {
    expect(tourKeys("a").seen).not.toBe(tourKeys("b").seen);
    expect(tourKeys("a").active).not.toBe(tourKeys("a").seen);
  });

  it("uses actual controls on each route, including empty-workspace fallbacks", () => {
    const shell = readFileSync("components/app-shell.tsx", "utf8");
    for (const step of TOUR_STEPS) {
      const source = readFileSync(`app/(app)${step.route}/page.tsx`, "utf8") + shell;
      expect(source).toContain(`"${step.target}"`);
      if ("fallback" in step) expect(source).toContain(`"${step.fallback}"`);
    }
    expect(new Set(TOUR_STEPS.map((step) => step.route))).toEqual(new Set(["/dashboard", "/workspace", "/specifications", "/exports"]));
  });

  it("places callouts beside small targets when space is available", () => {
    const result = positionTourCard({ top: 100, left: 500, width: 100, height: 50 }, { width: 1200, height: 900 }, { width: 400, height: 360 });
    expect(result).toEqual({ left: 350, top: 166 });
  });

  it("keeps callouts within narrow, short, and desktop viewports", () => {
    for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 844, height: 390 }, { width: 1440, height: 900 }]) {
      for (const target of [null, { top: 20, left: 10, width: viewport.width - 20, height: viewport.height - 40 }, { top: viewport.height - 100, left: viewport.width - 100, width: 90, height: 90 }]) {
        const card = { width: Math.min(400, viewport.width - 32), height: Math.min(500, viewport.height - 32) };
        const position = positionTourCard(target, viewport, card);
        expect(position.left).toBeGreaterThanOrEqual(16);
        expect(position.top).toBeGreaterThanOrEqual(16);
        expect(position.left + card.width).toBeLessThanOrEqual(viewport.width - 16);
        expect(position.top + card.height).toBeLessThanOrEqual(viewport.height - 16);
      }
    }
  });
});
