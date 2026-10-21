"use client";
// One box face photo with four draggable corner dots joined by a line ("dot-connected corners"),
// and a small live preview of the face straightened from those dots.
import { useEffect, useMemo, useRef, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import { detectCornersOnCanvas } from "@/lib/image/corners";
import { mapQuad, orderQuad, rectSize, warpToRect, type Point, type Quad } from "@/lib/image/perspective";
import { bufferToCanvas, readPixels } from "@/lib/image/straighten";

const CORNER_NAMES = ["Top-left", "Top-right", "Bottom-right", "Bottom-left"];
/** The photo is shown from a copy no larger than this; corners stay in the full photo's pixels. */
const DISPLAY_MAX_SIDE = 1000;
/** The live preview warps a small copy so it keeps up with a finger on a phone. */
const PREVIEW_SOURCE_MAX_SIDE = 480;
const PREVIEW_MAX_SIDE = 220;
/** Arrow keys move a dot by this share of the photo width (Shift: five times as far). */
const NUDGE_SHARE = 1 / 250;
const NUDGE_FAST = 5;

type Props = {
  /** The face photo, already rotated upright. */
  image: HTMLCanvasElement;
  /** Corners in the photo's pixels: top-left, top-right, bottom-right, bottom-left. */
  quad: Quad;
  onChange: (quad: Quad) => void;
  /** "front", "side" or "top": used in the dots' labels. */
  faceLabel: string;
  /** Where "Reset corners" puts the dots. Detected from the photo when not given. */
  suggested?: Quad;
};

type Drag = { index: number; pointerId: number; dx: number; dy: number };

export function CornerEditor({ image, quad, onChange, faceLabel, suggested }: Props) {
  const stage = useRef<HTMLDivElement>(null);
  const photo = useRef<HTMLCanvasElement>(null);
  const preview = useRef<HTMLCanvasElement>(null);
  const drag = useRef<Drag | null>(null);
  const W = image.width;
  const H = image.height;
  const previewSource = useMemo(() => readPixels(image, PREVIEW_SOURCE_MAX_SIDE), [image]);

  useEffect(() => {
    const cv = photo.current;
    if (!cv) return;
    const s = Math.min(1, DISPLAY_MAX_SIDE / Math.max(W, H, 1));
    cv.width = Math.max(1, Math.round(W * s));
    cv.height = Math.max(1, Math.round(H * s));
    cv.getContext("2d")?.drawImage(image, 0, 0, cv.width, cv.height);
  }, [image, W, H]);

  useEffect(() => {
    const cv = preview.current;
    if (!cv || !previewSource) return;
    const small = orderQuad(mapQuad(quad, (p) => ({ x: (p.x * previewSource.width) / W, y: (p.y * previewSource.height) / H })));
    const size = rectSize(small, PREVIEW_MAX_SIDE);
    const out = warpToRect(previewSource, small, size.width, size.height);
    if (out) bufferToCanvas(out, cv);
  }, [quad, previewSource, W, H]);

  /** Pointer position in the photo's pixels. */
  function toPhoto(e: PointerEvent): Point | null {
    const r = stage.current?.getBoundingClientRect();
    if (!r || !r.width || !r.height) return null;
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  }

  function moveTo(index: number, x: number, y: number) {
    const p = { x: Math.min(W, Math.max(0, x)), y: Math.min(H, Math.max(0, y)) };
    onChange(mapQuad(quad, (q, k) => (k === index ? p : q)));
  }

  function onPointerDown(index: number, e: PointerEvent<HTMLButtonElement>) {
    const at = toPhoto(e);
    if (!at) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    e.currentTarget.focus();
    // Keep the grab offset so the dot doesn't jump under the finger.
    drag.current = { index, pointerId: e.pointerId, dx: quad[index].x - at.x, dy: quad[index].y - at.y };
  }

  function onPointerMove(index: number, e: PointerEvent<HTMLButtonElement>) {
    const d = drag.current;
    if (!d || d.index !== index || d.pointerId !== e.pointerId) return;
    const at = toPhoto(e);
    if (at) moveTo(index, at.x + d.dx, at.y + d.dy);
  }

  function onPointerEnd(e: PointerEvent<HTMLButtonElement>) {
    if (drag.current?.pointerId !== e.pointerId) return;
    drag.current = null;
    // If a dot was dragged past another, put the corners back in order so labels stay true.
    onChange(orderQuad(quad));
  }

  function onKeyDown(index: number, e: KeyboardEvent<HTMLButtonElement>) {
    const step = Math.max(1, W * NUDGE_SHARE) * (e.shiftKey ? NUDGE_FAST : 1);
    const moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    const m = moves[e.key];
    if (!m) return;
    e.preventDefault();
    moveTo(index, quad[index].x + m[0], quad[index].y + m[1]);
  }

  const stageStyle = { "--ar": W / Math.max(H, 1) } as CSSProperties;
  const points = quad.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <div className="corner-editor">
      <div ref={stage} className="corner-stage" style={stageStyle}>
        <canvas ref={photo} width={1} height={1} aria-label={`Photo of the ${faceLabel} face`} />
        <svg className="corner-lines" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
          <polygon points={points} vectorEffect="non-scaling-stroke" />
        </svg>
        {quad.map((p, k) => (
          <button
            key={CORNER_NAMES[k]}
            type="button"
            className="corner-handle"
            style={{ left: `${(p.x / W) * 100}%`, top: `${(p.y / H) * 100}%` }}
            aria-label={`${CORNER_NAMES[k]} corner of the ${faceLabel} face`}
            aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight"
            onPointerDown={(e) => onPointerDown(k, e)}
            onPointerMove={(e) => onPointerMove(k, e)}
            onPointerUp={onPointerEnd}
            onPointerCancel={onPointerEnd}
            onKeyDown={(e) => onKeyDown(k, e)}
          >
            <span aria-hidden="true" />
          </button>
        ))}
      </div>
      <div className="corner-foot">
        <figure className="corner-preview">
          <canvas ref={preview} width={1} height={1} aria-label={`The ${faceLabel} face, straightened`} />
          <figcaption className="muted">Straightened</figcaption>
        </figure>
        <div className="stack">
          <p className="muted">Drag each dot onto a corner of the {faceLabel} face. Arrow keys move the selected dot.</p>
          <button className="btn" type="button" onClick={() => onChange(suggested ?? detectCornersOnCanvas(image).quad)}>
            Reset corners
          </button>
        </div>
      </div>
    </div>
  );
}
