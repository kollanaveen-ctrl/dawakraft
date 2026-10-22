# ADR 0006: Automatic straightening and a catalogue-style product picture

- **Status:** Accepted. Replaces the manual corner dots in [ADR 0004](0004-on-device-pack-shots.md).
- **Date:** recorded 2026-10-22

## Context

ADR 0004 let the user place four corner dots on each box face. Testers found dragging dots on a phone fiddly, and the dots were the step most likely to slow a first-time user down.

The company's printed catalogue shows a box with its left end visible and the real strip, bottle or tube standing in front. Distributors want circulars that look like that. On a medicine circular the pack in the picture must still be the real one, so the strip, bottle or tube has to be the user's own photo.

## Decision

- **No manual corners.** Each box photo (front, left end, top) is straightened automatically from the edges found by `src/lib/image/corners.ts`, then flattened by `src/lib/image/straighten.ts`. The user does not drag anything.
- **Size sanity check.** A detected face is trusted only if it covers enough of its photo: at least 20% for the front and 5% for the left end or top (`MIN_FACE_SHARE` in `src/lib/image/packshot.ts`). If a face fails the check, the background is trimmed when that keeps the box. If it doesn't, the photo is used as photographed and the status tells the user to retake it on a dark plain sheet or crop it in the gallery.
- **"Already cropped" escape hatch.** The tick box **Photos are cropped to the box** skips edge finding and uses the photos as they are.
- **Left end, as in the catalogue.** Photo role "Left end" replaces the old "Side" (which meant the right side). The box is drawn front-on, with the left end turned slightly toward the viewer, a sliver of the top, and a low camera (`src/lib/image/packshot.ts`).
- **Missing end or top.** With only a front photo, the end and top are filled in from the colours along the front's edges, with an assumed depth of 30% of the width, so the box still looks 3D.
- **Real pack photo, composited.** The user's strip, bottle or tube photo is cut out (`src/lib/image/cutout.ts`) and placed in front of the box's right end (`src/lib/image/companion.ts`). Placement follows the company catalogue: a strip stands about 1.22 times the box height, tilted -3°, overlapping 45% of its width; a bottle stands 0.82 times the box height, upright; a tube lies across the front. The layout maths (`shotLayout`) is pure and unit-tested.
- **Photo advice.** Dark plain sheet for boxes and silver strips; white only for dark or amber bottles. Stand back about 1 m and zoom 2×.
- All of this still runs in the browser. It costs nothing and photos don't leave the device for this step.

## Alternatives considered

- **Keep the manual dots and add a magnifier** (the earlier roadmap item): still fiddly on a phone, and it only helps the placing, not the fiddliness.
- **Generate the strip or bottle with AI:** the picture could show a wrong strength, logo or design. Not acceptable for medicines.
- **A paid background-removal service:** cost per image, and photos sent to a third party (as in ADR 0004).
- **Automatic detection with no check or fallback:** a wrong detection on a busy background would reach the circular unnoticed.

## Consequences

- **White cartons on white paper** can't be separated from the paper by colour. That is why the app advises a dark sheet, and why the size check and the "used as photographed" fallback exist.
- **No manual fix for a wrong detection.** The user can retake the photo, crop it in the gallery, or rotate it. There is no way to drag the edges.
- **Layout numbers come from one catalogue.** The strip, bottle and tube placement may need tuning once more reference catalogues are available.
- **Background removal on strips, bottles and tubes** still depends on the photo. Shiny packs and busy backgrounds can leave edges to clean up.
- The magnifier item in the [roadmap](../ROADMAP.md) is dropped, since there are no corner dots to magnify.
- Tested in `src/lib/__tests__/companion.test.ts` (placement) and `src/lib/__tests__/perspective.test.ts` (straightening and corner suggestions). The detection on real photos is checked by hand (see [TESTING](../TESTING.md)).
