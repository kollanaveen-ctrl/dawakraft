"use client";
// Step 2 for a box: each face photo gets four corner dots (auto-suggested, draggable), is
// straightened into a flat rectangle, and the straightened faces build the 3D pack shot.
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { BOX_FACES, type BoxFace, type FaceCanvases, type FaceCorners, type FaceRotations } from "@/lib/faces";
import { detectCornersOnCanvas, type CornerGuess } from "@/lib/image/corners";
import { depthConsistency, estimateAspect, orderQuad, type Quad } from "@/lib/image/perspective";
import { packFromFaces } from "@/lib/image/packshot";
import { loadFaceSource, straightenFace } from "@/lib/image/straighten";
import { CornerEditor } from "./CornerEditor";

/** Wait this long after the last corner move before re-straightening the full-size faces. */
const PACK_DEBOUNCE_MS = 250;
const FACE_NAMES: Record<BoxFace, string> = { front: "Front", side: "Side", top: "Top" };
const DEPTH_WARNING = "Side and top photos disagree on the box depth. Check their corners.";

type Props = {
  files: Record<BoxFace, File | null>;
  rots: FaceRotations;
  threeD: boolean;
  corners: FaceCorners;
  onRotate: (face: BoxFace) => void;
  onThreeD: (on: boolean) => void;
  onCorners: (face: BoxFace, quad: Quad) => void;
  /** Must be stable (a state setter). */
  onCut: (canvas: HTMLCanvasElement | null) => void;
  /** Must be stable (a state setter). */
  onFaceCanvases: (faces: FaceCanvases) => void;
  /** The "Not a box" tick box, owned by the parent. */
  notABoxToggle: ReactNode;
};

type FaceSource =
  | { state: "none" }
  | { state: "loading" }
  | { state: "error" }
  | { state: "ready"; canvas: HTMLCanvasElement; guess: CornerGuess };

type Loaded = { file: File; rot: number; canvas: HTMLCanvasElement | null; guess: CornerGuess | null };

/** Load one face photo, rotated upright, and suggest its corners. Rotation happens before detection. */
function useFaceSource(file: File | null, rot: number): FaceSource {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  useEffect(() => {
    if (!file) return;
    let live = true;
    loadFaceSource(file, rot).then(
      (canvas) => live && setLoaded({ file, rot, canvas, guess: detectCornersOnCanvas(canvas) }),
      () => live && setLoaded({ file, rot, canvas: null, guess: null }),
    );
    return () => {
      live = false;
    };
  }, [file, rot]);
  return useMemo((): FaceSource => {
    if (!file) return { state: "none" };
    if (!loaded || loaded.file !== file || loaded.rot !== rot) return { state: "loading" };
    if (!loaded.canvas || !loaded.guess) return { state: "error" };
    return { state: "ready", canvas: loaded.canvas, guess: loaded.guess };
  }, [file, rot, loaded]);
}

type Ready = { face: BoxFace; canvas: HTMLCanvasElement; quad: Quad; found: boolean };
type Built = { failed: BoxFace[]; is3D: boolean };

function statusText(sources: Record<BoxFace, FaceSource>, ready: Ready[], built: Built | null, threeD: boolean): { text: string; err: boolean } {
  const all = BOX_FACES.map((f) => sources[f]);
  if (all.some((s) => s.state === "error")) return { text: "A photo couldn't be opened. Go back, remove it, and choose a JPG or PNG photo.", err: true };
  if (all.some((s) => s.state === "loading") || !built) return { text: "Opening the photos…", err: false };
  if (built.failed.length) {
    const name = FACE_NAMES[built.failed[0]].toLowerCase();
    return { text: `The dots on the ${name} photo don't make a box shape. Drag them back onto its corners.`, err: true };
  }
  const missed = ready.find((r) => !r.found);
  if (missed) return { text: `Couldn't find the box edges on the ${missed.face} photo. Drag the four dots onto its corners.`, err: false };
  if (built.is3D) return { text: "3D pack shot ready. Drag any dot that isn't on a corner of the box.", err: false };
  if (!threeD) return { text: "Front straightened.", err: false };
  return { text: "Front straightened. Mark a Side or Top photo in step 1 to build a 3D pack.", err: false };
}

export function BoxCleanup({ files, rots, threeD, corners, onRotate, onThreeD, onCorners, onCut, onFaceCanvases, notABoxToggle }: Props) {
  const view = useRef<HTMLCanvasElement>(null);
  const [active, setActive] = useState<BoxFace>("front");
  const [built, setBuilt] = useState<Built | null>(null);
  const front = useFaceSource(files.front, rots.front);
  const side = useFaceSource(files.side, rots.side);
  const top = useFaceSource(files.top, rots.top);
  const sources = useMemo(() => ({ front, side, top }), [front, side, top]);

  // The corners in use: the user's, or the auto-suggestion for faces they haven't touched.
  const ready = useMemo(
    () =>
      BOX_FACES.flatMap((face): Ready[] => {
        const s = sources[face];
        if (s.state !== "ready") return [];
        const mine = corners[face];
        return [{ face, canvas: s.canvas, quad: mine ?? s.guess.quad, found: Boolean(mine) || s.guess.found }];
      }),
    [sources, corners],
  );
  const busy = BOX_FACES.some((f) => sources[f].state === "loading");

  useEffect(() => {
    if (busy || !ready.length) return;
    const t = setTimeout(() => {
      const straight = ready.map((r) => ({ face: r.face, canvas: straightenFace(r.canvas, r.quad) }));
      const faces: FaceCanvases = Object.fromEntries(straight.filter((s) => s.canvas).map((s) => [s.face, s.canvas]));
      const pack = packFromFaces(faces, threeD);
      onFaceCanvases(faces);
      onCut(pack?.canvas ?? null);
      const cv = view.current;
      if (cv && pack) {
        cv.width = pack.canvas.width;
        cv.height = pack.canvas.height;
        cv.getContext("2d")?.drawImage(pack.canvas, 0, 0);
      }
      setBuilt({ failed: straight.filter((s) => !s.canvas).map((s) => s.face), is3D: Boolean(pack?.is3D) });
    }, PACK_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [busy, ready, threeD, onCut, onFaceCanvases]);

  const present = BOX_FACES.filter((f) => files[f]);
  const shown = present.includes(active) ? active : "front";
  const current = ready.find((r) => r.face === shown);
  const shownSource = sources[shown];
  const aspect = (f: BoxFace) => {
    const r = ready.find((x) => x.face === f);
    return r ? estimateAspect(orderQuad(r.quad)) : null;
  };
  const frontAspect = aspect("front");
  const depth = frontAspect ? depthConsistency(frontAspect, aspect("side"), aspect("top")) : null;
  const status = statusText(sources, ready, built, threeD);
  const hasDepthPhoto = Boolean(files.side || files.top);

  return (
    <div className="stack">
      <div className="check-bg">
        <canvas ref={view} width={10} height={10} aria-label="Product picture for the circular" />
      </div>
      {depth && !depth.ok && (
        <p className="corner-warn" role="status">
          {DEPTH_WARNING}
        </p>
      )}
      <div className="card stack">
        <div>
          <h2>Mark the corners of each side</h2>
          <p className="muted">Each photo is straightened from its four dots, so the box keeps its real shape and the small print stays readable.</p>
        </div>
        {notABoxToggle}
        {hasDepthPhoto && (
          <label className="confirm">
            <input type="checkbox" checked={threeD} onChange={(e) => onThreeD(e.target.checked)} />
            <span>
              Show as a 3D pack
              <br />
              <span className="muted">Uses the photos marked Side and Top in step 1.</span>
            </span>
          </label>
        )}
        {present.length > 1 && (
          <div className="face-tabs" role="group" aria-label="Box side to edit">
            {present.map((f) => (
              <button key={f} type="button" className="face-tab" aria-pressed={f === shown} onClick={() => setActive(f)}>
                {FACE_NAMES[f]}
              </button>
            ))}
          </div>
        )}
        <div className="row">
          <button className="btn" type="button" onClick={() => onRotate(shown)}>
            Rotate {FACE_NAMES[shown].toLowerCase()} 90°
          </button>
        </div>
        {current ? (
          <CornerEditor
            key={`${shown}-${rots[shown]}`}
            image={current.canvas}
            quad={current.quad}
            suggested={shownSource.state === "ready" ? shownSource.guess.quad : undefined}
            faceLabel={shown}
            onChange={(q) => onCorners(shown, q)}
          />
        ) : (
          <p className="muted">{shownSource.state === "error" ? "This photo couldn't be opened." : "Opening the photo…"}</p>
        )}
        <p className={`status${status.err ? " err" : ""}`} role="status">
          {status.text}
        </p>
      </div>
    </div>
  );
}
