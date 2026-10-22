import { describe, expect, it } from "vitest";
import { packNeedsTurn, shotLayout } from "../image/companion";

const BOX = { width: 1000, height: 400 };
const STRIP = { width: 300, height: 600 };

describe("placing the strip, bottle or tube beside the box", () => {
  it("stands a strip in front of the box's right end, taller than the box and slightly tilted", () => {
    const L = shotLayout(BOX, STRIP, "strip");
    const box = L.box;
    if (!box) throw new Error("expected a box");
    // 1.22 × the box height, keeping the strip's shape.
    expect(L.pack.h).toBeCloseTo(488, 0);
    expect(L.pack.w).toBeCloseTo(244, 0);
    // Overlaps the box's right end, and reaches past it.
    expect(L.pack.x).toBeLessThan(box.x + box.w);
    expect(L.pack.x + L.pack.w).toBeGreaterThan(box.x + box.w);
    // Its bottom sits just below the box's bottom (it stands in front).
    expect(L.pack.y + L.pack.h).toBeGreaterThan(box.y + box.h);
    expect(L.pack.angle).toBeLessThan(0);
  });

  it("keeps the whole group, tilt and shadow room included, inside the picture", () => {
    for (const kind of ["strip", "bottle", "tube"] as const) {
      const L = shotLayout(BOX, kind === "tube" ? { width: 800, height: 160 } : STRIP, kind);
      expect(L.box?.x).toBeGreaterThanOrEqual(0);
      expect(L.box?.y).toBeGreaterThanOrEqual(0);
      expect(L.pack.x).toBeGreaterThan(0);
      expect(L.pack.y).toBeGreaterThan(0);
      expect(L.pack.x + L.pack.w).toBeLessThan(L.width);
      expect(L.pack.y + L.pack.h).toBeLessThan(L.height);
      expect(L.ground.cy).toBeLessThan(L.height);
    }
  });

  it("stands a bottle level in front and lays a tube across the front", () => {
    const bottle = shotLayout(BOX, { width: 200, height: 500 }, "bottle");
    expect(bottle.pack.angle).toBe(0);
    expect(bottle.pack.h).toBeCloseTo(0.82 * 400, 0);
    const tube = shotLayout(BOX, { width: 800, height: 160 }, "tube");
    expect(tube.pack.w).toBeGreaterThan(tube.pack.h);
    const tubeBox = tube.box;
    if (!tubeBox) throw new Error("expected a box");
    expect(tube.pack.y + tube.pack.h).toBeGreaterThan(tubeBox.y + tubeBox.h);
  });

  it("narrows a very wide pack so it never hides most of the box", () => {
    const L = shotLayout(BOX, { width: 1200, height: 600 }, "strip");
    expect(L.pack.w).toBeCloseTo(750, 0);
  });

  it("draws the pack alone when there is no box", () => {
    const L = shotLayout(null, STRIP, "bottle");
    expect(L.box).toBeNull();
    expect(L.pack.h).toBe(1000);
    expect(L.pack.w).toBe(500);
  });

  it("turns a strip photo upright and a tube photo on its side", () => {
    expect(packNeedsTurn({ width: 600, height: 300 }, "strip")).toBe(true);
    expect(packNeedsTurn(STRIP, "strip")).toBe(false);
    expect(packNeedsTurn(STRIP, "tube")).toBe(true);
    expect(packNeedsTurn(STRIP, "bottle")).toBe(false);
  });
});
