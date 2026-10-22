import { describe, expect, it } from "vitest";
import { assignRole, removePhoto, roleOf, type Faces } from "../faces";
import { boxGeometry } from "../image/packshot";
import {
  NEW_LAUNCH_DAYS,
  companyGroups,
  companyKey,
  effectiveHighlight,
  highlightOnToggle,
  isNewLaunch,
  matchesSegment,
  nextLaunchedAt,
} from "../segments";
import type { Product } from "../types";

const NOW = Date.parse("2026-10-21T09:00:00.000Z");
const daysAgo = (d: number) => new Date(NOW - d * 86_400_000).toISOString();

function product(over: Partial<Product>): Product {
  return {
    id: "p", name: "Exampol 650", composition: "Paracetamol IP 650 mg", uses: "", form: "Tablet", packSize: "10 x 15", mrp: 32.5,
    schedule: "None", manufacturer: "", marketedBy: "", storage: "", category: "Analgesic & antipyretic", scheme: "",
    highlight: "", template: "clean", imagePath: null, example: false, launchedAt: null,
    createdAt: daysAgo(1), updatedAt: daysAgo(1), ...over,
  };
}

describe("new launch vs existing", () => {
  it("counts as new for the launch window, then becomes existing by itself", () => {
    expect(isNewLaunch({ launchedAt: daysAgo(1) }, NOW)).toBe(true);
    expect(isNewLaunch({ launchedAt: daysAgo(NEW_LAUNCH_DAYS + 1) }, NOW)).toBe(false);
    expect(isNewLaunch({ launchedAt: null }, NOW)).toBe(false);
  });

  it("drops the 'New launch' highlight once the product is no longer new", () => {
    expect(effectiveHighlight({ highlight: "New launch", launchedAt: daysAgo(5) }, NOW)).toBe("New launch");
    expect(effectiveHighlight({ highlight: "New launch", launchedAt: daysAgo(90) }, NOW)).toBe("");
    expect(effectiveHighlight({ highlight: "Now in 15s", launchedAt: null }, NOW)).toBe("Now in 15s");
  });

  it("keeps the highlight line in step with the New launch tick box", () => {
    expect(highlightOnToggle("", true)).toBe("New launch");
    expect(highlightOnToggle("New launch", false)).toBe("");
    expect(highlightOnToggle("Bigger pack", false)).toBe("Bigger pack");
  });

  it("keeps the launch date while new, restarts it on relaunch, clears it for existing", () => {
    const now = new Date(NOW).toISOString();
    expect(nextLaunchedAt(daysAgo(3), true, now)).toBe(daysAgo(3));
    expect(nextLaunchedAt(daysAgo(200), true, now)).toBe(now);
    expect(nextLaunchedAt(null, true, now)).toBe(now);
    expect(nextLaunchedAt(daysAgo(3), false, now)).toBeNull();
  });
});

describe("company segments", () => {
  it("groups spellings of the same company and prefers Marketed by", () => {
    const list = [
      product({ marketedBy: "Cipla Ltd.", manufacturer: "Contract Mfg Pvt Ltd" }),
      product({ marketedBy: "CIPLA LIMITED" }),
      product({ manufacturer: "Cipla Ltd." }),
      product({ manufacturer: "Sun Pharma" }),
      product({}),
    ];
    expect(companyKey("Cipla Ltd.")).toBe(companyKey("CIPLA LIMITED"));
    expect(companyGroups(list)).toEqual([
      { key: "cipla", label: "Cipla Ltd.", count: 3 },
      { key: "sun pharma", label: "Sun Pharma", count: 1 },
    ]);
  });

  it("combines category, company, launch and search filters", () => {
    const p = product({ marketedBy: "Cipla Ltd.", launchedAt: daysAgo(2) });
    const base = { category: "All", company: "All", launch: "all" as const, query: "" };
    expect(matchesSegment(p, { ...base, company: "cipla", launch: "new" }, NOW)).toBe(true);
    expect(matchesSegment(p, { ...base, launch: "existing" }, NOW)).toBe(false);
    expect(matchesSegment(p, { ...base, category: "Antibiotic" }, NOW)).toBe(false);
    expect(matchesSegment(p, { ...base, company: "sun pharma" }, NOW)).toBe(false);
    expect(matchesSegment(p, { ...base, query: "paracetamol" }, NOW)).toBe(true);
  });
});

describe("photo roles for the product picture", () => {
  const start: Faces = { front: 0, side: null, top: null, pack: null };

  it("gives each role to one photo and always keeps a front", () => {
    const withSide = assignRole(start, 1, "side", 3);
    expect(withSide).toEqual({ front: 0, side: 1, top: null, pack: null });
    expect(assignRole(withSide, 1, "top", 3)).toEqual({ front: 0, side: null, top: 1, pack: null });
    // Making the front photo the side: the photo that was the side is now free, so it becomes the front.
    expect(assignRole(withSide, 0, "side", 3)).toEqual({ front: 1, side: 0, top: null, pack: null });
    expect(roleOf(withSide, 2)).toBe("none");
  });

  it("marks the strip or bottle photo and never makes it the front", () => {
    const withPack = assignRole(start, 2, "pack", 3);
    expect(withPack).toEqual({ front: 0, side: null, top: null, pack: 2 });
    expect(roleOf(withPack, 2)).toBe("pack");
    // The front photo becomes the strip: the next free photo (1, not the strip) becomes the front.
    expect(assignRole({ ...start, pack: 2 }, 0, "pack", 3)).toEqual({ front: 1, side: null, top: null, pack: 0 });
  });

  it("shifts roles when a photo is removed", () => {
    expect(removePhoto({ front: 2, side: 0, top: 1, pack: 3 }, 0, 4)).toEqual({ front: 1, side: null, top: 0, pack: 2 });
    expect(removePhoto({ front: 0, side: null, top: null, pack: 1 }, 1, 2)).toEqual({ front: 0, side: null, top: null, pack: null });
    expect(removePhoto(start, 0, 1)).toEqual(start);
  });
});

describe("3D box shape", () => {
  it("takes the depth from the side photo, matched to the front height", () => {
    const g = boxGeometry({ width: 400, height: 600 }, { width: 150, height: 300 }, null);
    // end depth = 150 * (600/300) = 300px, drawn at 42% along an 18° angle (up and to the left)
    expect(g).toEqual({ w: 400, h: 600, dx: 120, dy: 39 });
  });

  it("uses the top photo when there is no end photo, and is flat with neither", () => {
    // top depth = 100 * (400/400) = 100px → 42 → 42 × cos 18° ≈ 40
    expect(boxGeometry({ width: 400, height: 600 }, null, { width: 400, height: 100 })?.dx).toBe(40);
    expect(boxGeometry({ width: 400, height: 600 }, null, null)).toBeNull();
  });

  it("assumes a typical carton depth when asked, so a front photo alone still looks 3D", () => {
    // 30% of 400 = 120px → 50.4 → 50.4 × cos 18° ≈ 48
    expect(boxGeometry({ width: 400, height: 600 }, null, null, true)?.dx).toBe(48);
  });

  it("keeps odd photos from making a paper-thin or huge box", () => {
    const thin = boxGeometry({ width: 400, height: 600 }, { width: 1, height: 600 }, null);
    const huge = boxGeometry({ width: 400, height: 600 }, { width: 5000, height: 600 }, null);
    expect(thin?.dx).toBe(Math.round(0.15 * 400 * 0.42 * Math.cos((18 * Math.PI) / 180)));
    expect(huge?.dx).toBe(Math.round(1.5 * 400 * 0.42 * Math.cos((18 * Math.PI) / 180)));
  });
});
