// The product picture. A box is drawn in 3D the way a printed pharma catalogue shows it: front
// facing you, the left end turned slightly towards you and a sliver of the top. Each face is
// straightened automatically from its detected edges (no dots to place); a face whose edges can't
// be found is used as photographed. The strip, bottle or tube photo is then cut out and placed in
// front of the box (companion.ts). Packs that are not a box keep background removal. It all runs
// on the phone.
import { BOX_FACES, type BoxFace, type FaceCanvases, type FaceRotations, type PackKind } from "../faces";
import { composeProductShot } from "./companion";
import { detectCornersOnCanvas } from "./corners";
import { cleanPhoto, cutout } from "./cutout";
import { fileToImage } from "./encode";
import { quadShare } from "./perspective";
import { loadFaceSource, straightenFace } from "./straighten";

/** Depth runs up and to the left: a low camera, so only a sliver of the top shows. */
const DEPTH_ANGLE = (18 * Math.PI) / 180;
/** Foreshortening of the left end: the front faces the camera, the end is turned away. */
const DEPTH_SCALE = 0.42;
const MIN_DEPTH_RATIO = 0.15;
const MAX_DEPTH_RATIO = 1.5;
/** Box depth assumed (share of the front width) when there is no photo of the end or top. */
const DEFAULT_DEPTH_RATIO = 0.3;
/** Share of the front photo stretched to stand in for a missing end or top panel. */
const EDGE_BAND = 0.025;
const SHADOW_PAD = 0.08;
/**
 * A detected face smaller than this share of its photo is a mistake (a white carton on a light sheet
 * lets the background eat into the box), so the photo is used as photographed instead. The narrow
 * end and the thin top fill much less of their photos than the front does.
 */
const MIN_FACE_SHARE: Record<BoxFace, number> = { front: 0.2, side: 0.05, top: 0.05 };

export type BoxGeometry = {
  /** Front face width and height, in pixels of the output. */
  w: number;
  h: number;
  /** Depth direction on screen: left and up. */
  dx: number;
  dy: number;
};

type Size = { width: number; height: number };

/**
 * Work out the box shape from the photo sizes: depth comes from the end (or top) photo. With
 * `assumeDepth`, a box with only a front photo gets a typical carton depth instead of none.
 */
export function boxGeometry(front: Size, side: Size | null, top: Size | null, assumeDepth = false): BoxGeometry | null {
  const w = front.width;
  const h = front.height;
  let depth: number | null = null;
  if (side && side.height > 0) depth = side.width * (h / side.height);
  else if (top && top.width > 0) depth = top.height * (w / top.width);
  else if (assumeDepth) depth = w * DEFAULT_DEPTH_RATIO;
  if (depth == null || !(w > 0 && h > 0)) return null;
  const d = Math.min(MAX_DEPTH_RATIO * w, Math.max(MIN_DEPTH_RATIO * w, depth)) * DEPTH_SCALE;
  return { w, h, dx: Math.round(d * Math.cos(DEPTH_ANGLE)), dy: Math.round(d * Math.sin(DEPTH_ANGLE)) };
}

type Ctx = CanvasRenderingContext2D;
type Pt = [number, number];

function face(ctx: Ctx, pts: [Pt, Pt, Pt, Pt], img: HTMLCanvasElement | null, fill: string, shade: string) {
  ctx.save();
  ctx.beginPath();
  pts.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.clip();
  ctx.fillStyle = fill;
  ctx.fill();
  if (img && img.width && img.height) {
    // Map the photo's corners onto the face: its x-axis → (p1 - p0), its y-axis → (p3 - p0).
    const [p0, p1, , p3] = pts;
    ctx.setTransform(
      (p1[0] - p0[0]) / img.width,
      (p1[1] - p0[1]) / img.width,
      (p3[0] - p0[0]) / img.height,
      (p3[1] - p0[1]) / img.height,
      p0[0],
      p0[1],
    );
    ctx.drawImage(img, 0, 0);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }
  ctx.fillStyle = shade;
  ctx.fill();
  ctx.restore();
}

/** A stand-in end or top panel: the front's outer edge stretched, so colours carry round the corner. */
function edgePanel(front: HTMLCanvasElement, edge: "left" | "top"): HTMLCanvasElement {
  const out = document.createElement("canvas");
  const band = Math.max(2, Math.round((edge === "left" ? front.width : front.height) * EDGE_BAND));
  out.width = edge === "left" ? band : front.width;
  out.height = edge === "left" ? front.height : band;
  out.getContext("2d")?.drawImage(front, 0, 0, out.width, out.height, 0, 0, out.width, out.height);
  return out;
}

export type ShotOptions = {
  /** Draw the box's own ground shadow (off when the picture adds one shadow for the whole group). */
  shadow?: boolean;
  /** Without an end or top photo, stretch the front's edges to fill them in. */
  synthesize?: boolean;
};

/**
 * Draw the box from face pictures (ideally straightened faces, whose sizes then give the box's true
 * proportions). Without an end or top photo the flat front is returned, unless `synthesize` is on.
 */
export function composePackShot(
  front: HTMLCanvasElement,
  side: HTMLCanvasElement | null,
  top: HTMLCanvasElement | null,
  { shadow = true, synthesize = false }: ShotOptions = {},
): HTMLCanvasElement {
  const g = boxGeometry(front, side, top, synthesize);
  if (!g) return front;
  const { w, h, dx, dy } = g;
  const pad = shadow ? Math.round(h * SHADOW_PAD) : 0;
  const out = document.createElement("canvas");
  out.width = w + dx + pad;
  out.height = h + dy + pad;
  const ctx = out.getContext("2d");
  if (!ctx) return front;

  if (shadow) {
    ctx.save();
    ctx.filter = `blur(${Math.max(4, Math.round(pad / 2))}px)`;
    ctx.fillStyle = "rgba(15,31,36,0.22)";
    ctx.beginPath();
    ctx.ellipse((w + dx) / 2, dy + h + pad * 0.2, (w + dx) / 2, pad * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  const endPanel = side ?? edgePanel(front, "left");
  const topPanel = top ?? edgePanel(front, "top");
  // Front, left end (in shade), top (catching the light).
  face(ctx, [[dx, dy], [dx + w, dy], [dx + w, dy + h], [dx, dy + h]], front, "#FFFFFF", "rgba(0,0,0,0)");
  face(ctx, [[0, 0], [dx, dy], [dx, dy + h], [0, h]], endPanel, "#C9D3D4", side ? "rgba(0,0,0,0.12)" : "rgba(0,0,0,0.2)");
  face(ctx, [[0, 0], [w, 0], [w + dx, dy], [dx, dy]], topPanel, "#E4EAEA", "rgba(255,255,255,0.12)");

  // Crisp edges where the faces meet, and a highlight on the front corner.
  ctx.strokeStyle = "rgba(15,31,36,0.16)";
  ctx.lineWidth = Math.max(1, Math.round(w / 320));
  ctx.beginPath();
  ctx.moveTo(dx, dy + h);
  ctx.lineTo(dx, dy);
  ctx.lineTo(dx + w, dy);
  ctx.moveTo(dx, dy);
  ctx.lineTo(0, 0);
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.beginPath();
  ctx.moveTo(dx + ctx.lineWidth, dy + h);
  ctx.lineTo(dx + ctx.lineWidth, dy + ctx.lineWidth);
  ctx.stroke();
  return out;
}

export type PackInput = {
  front: File | HTMLImageElement;
  side: File | null;
  top: File | null;
  /** The strip, bottle or tube photo that stands in front of the box. */
  pack?: File | null;
  packKind?: PackKind;
  rots: FaceRotations;
  removeBg: boolean;
  tol: number;
  threeD: boolean;
  /** Bottle, tube or strip on its own: no box, background removal instead. */
  notABox?: boolean;
  /** The box photos are already cropped to the box (in the phone's gallery): use them as they are. */
  cropped?: boolean;
};

export type PackResult = {
  canvas: HTMLCanvasElement;
  ok: boolean;
  is3D: boolean;
  /** Straightened faces (box path only), kept so they can be sent to the AI. */
  faces?: FaceCanvases;
  /** Box faces whose edges couldn't be found, so they are used as photographed. */
  unfound?: BoxFace[];
  /** False when the strip/bottle photo couldn't be separated from its background. */
  packOk?: boolean;
};

/** The box from straightened faces: in 3D when asked for (filling in a missing end), else the flat front. */
export function packFromFaces(faces: FaceCanvases, threeD: boolean, shadow = true): { canvas: HTMLCanvasElement; is3D: boolean } | null {
  if (!faces.front) return null;
  if (!threeD) return { canvas: faces.front, is3D: false };
  const canvas = composePackShot(faces.front, faces.side ?? null, faces.top ?? null, { shadow, synthesize: true });
  return { canvas, is3D: canvas !== faces.front };
}

type Straight = { face: BoxFace; canvas: HTMLCanvasElement; found: boolean };

/**
 * One face, straightened from its detected edges. When the edges can't be trusted, the background
 * is trimmed instead if that keeps most of the box, else the photo is used as photographed.
 */
async function straightenAuto(file: File, rot: number, tol: number, face: BoxFace, cropped: boolean): Promise<Straight> {
  const source = await loadFaceSource(file, rot);
  if (cropped) return { face, canvas: source, found: true };
  const area = source.width * source.height;
  const guess = detectCornersOnCanvas(source, tol);
  const trusted = guess.found && quadShare(guess.quad, source.width, source.height) >= MIN_FACE_SHARE[face];
  const flat = trusted ? straightenFace(source, guess.quad) : null;
  if (flat) return { face, canvas: flat, found: true };
  // cutout() clears pixels in place, so keep an untouched copy to fall back on.
  const whole = document.createElement("canvas");
  whole.width = source.width;
  whole.height = source.height;
  whole.getContext("2d")?.drawImage(source, 0, 0);
  const cut = cutout(source, tol);
  const keepsBox = cut.ok && (cut.canvas.width * cut.canvas.height) / area >= MIN_FACE_SHARE[face];
  return { face, canvas: keepsBox ? cut.canvas : whole, found: false };
}

/** Box path: straighten every face that has a photo (end panels carry composition, so always all of them). */
async function buildBoxPack(input: PackInput, front: File, shadow: boolean): Promise<PackResult> {
  const files: Record<BoxFace, File | null> = { front, side: input.side, top: input.top };
  const done = await Promise.all(
    BOX_FACES.map((face) => {
      const file = files[face];
      return file ? straightenAuto(file, input.rots[face], input.tol, face, Boolean(input.cropped)) : null;
    }),
  );
  const present = done.filter((f): f is Straight => f !== null);
  const faces: FaceCanvases = Object.fromEntries(present.filter((f) => f.found).map((f) => [f.face, f.canvas]));
  const shapes: FaceCanvases = Object.fromEntries(present.map((f) => [f.face, f.canvas]));
  const unfound = present.filter((f) => !f.found).map((f) => f.face);
  const pack = packFromFaces(shapes, input.threeD, shadow);
  if (!pack) throw new Error("No front photo");
  return { ...pack, ok: true, faces, unfound };
}

/** Flat path: rotate each photo and (optionally) remove its background, then build the pack shot. */
async function buildCutoutPack(input: PackInput, shadow: boolean): Promise<PackResult> {
  const prep = async (src: File | HTMLImageElement | null, rot: number, removeBg: boolean) => {
    if (!src) return null;
    const img = src instanceof HTMLImageElement ? src : await fileToImage(src);
    return cleanPhoto(img, rot, removeBg, input.tol);
  };
  // A saved photo (editing without new photos) is already cleaned, so only rotate it.
  const front = await prep(input.front, input.rots.front, input.removeBg && !(input.front instanceof HTMLImageElement));
  if (!front) throw new Error("No front photo");
  if (!input.threeD || (!input.side && !input.top)) return { canvas: front.canvas, ok: front.ok, is3D: false };
  const [side, top] = await Promise.all([
    prep(input.side, input.rots.side, input.removeBg),
    prep(input.top, input.rots.top, input.removeBg),
  ]);
  const canvas = composePackShot(front.canvas, side?.canvas ?? null, top?.canvas ?? null, { shadow });
  return { canvas, ok: front.ok && (side?.ok ?? true) && (top?.ok ?? true), is3D: canvas !== front.canvas };
}

/**
 * Build the product picture. New photos of a box are straightened automatically; a saved picture
 * (editing without new photos) or a pack that is not a box goes through background removal. A
 * strip, bottle or tube photo, when given with new box photos, is cut out and placed in front.
 */
export async function buildPackImage(input: PackInput): Promise<PackResult> {
  const isBox = !input.notABox && input.front instanceof File;
  const withPack = isBox && Boolean(input.pack);
  const base = isBox ? await buildBoxPack(input, input.front as File, !withPack) : await buildCutoutPack(input, true);
  if (!withPack || !input.pack) return base;
  const img = await fileToImage(input.pack);
  const cut = cleanPhoto(img, input.rots.pack, true, input.tol);
  if (!cut.ok) return { ...base, packOk: false };
  const canvas = composeProductShot(base.canvas, cut.canvas, input.packKind ?? "strip");
  return { ...base, canvas, packOk: true };
}
