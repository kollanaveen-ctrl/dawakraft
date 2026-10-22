"use client";
// Step 2 for a box: the faces are straightened automatically (no dots to place), built into the 3D
// box, and the strip, bottle or tube photo is placed in front, as in a printed catalogue.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { PACK_KINDS, type BoxFace, type FaceCanvases, type FaceRotations, type PackKind } from "@/lib/faces";
import { buildPackImage, type PackResult } from "@/lib/image/packshot";

const SLIDER_DEBOUNCE_MS = 180;
const FACE_NAMES: Record<BoxFace, string> = { front: "front", side: "left end", top: "top" };

type Props = {
  files: { front: File; side: File | null; top: File | null; pack: File | null };
  packKind: PackKind;
  rots: FaceRotations;
  threeD: boolean;
  tol: number;
  cropped: boolean;
  onCropped: (on: boolean) => void;
  onRotate: (face: keyof FaceRotations) => void;
  onThreeD: (on: boolean) => void;
  onTol: (tol: number) => void;
  onPackKind: (kind: PackKind) => void;
  /** Must be stable (a state setter). */
  onCut: (canvas: HTMLCanvasElement | null) => void;
  /** Must be stable (a state setter). */
  onFaceCanvases: (faces: FaceCanvases) => void;
  /** The "Not a box" tick box, owned by the parent. */
  notABoxToggle: ReactNode;
};

type Status = { text: string; err: boolean };

function statusFor(res: PackResult, hasPack: boolean): Status {
  const missed = res.unfound?.[0];
  if (missed) {
    return {
      text: `Couldn't find the edges of the ${FACE_NAMES[missed]} photo, so it's used as photographed. Retake it on a dark plain sheet, or crop it to the box in your phone's gallery and tick "Photos are cropped to the box".`,
      err: false,
    };
  }
  if (hasPack && res.packOk === false) {
    return { text: "Couldn't separate the strip or bottle from its background, so it's left out for now. Move the slider, or retake it on a dark plain sheet.", err: true };
  }
  if (res.is3D) return { text: "Product picture ready. If a photo looks sideways, rotate it below.", err: false };
  return { text: "Front straightened.", err: false };
}

export function BoxCleanup(props: Props) {
  const { files, packKind, rots, threeD, tol, cropped, onCropped, onRotate, onThreeD, onTol, onPackKind, onCut, onFaceCanvases, notABoxToggle } = props;
  const view = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<Status>({ text: "Opening the photos…", err: false });
  const [tolShown, setTolShown] = useState(tol);
  // The parent builds `files` fresh on every render, so the effect below depends on each photo.
  const { front, side, top, pack } = files;

  useEffect(() => {
    const t = setTimeout(() => onTol(tolShown), SLIDER_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [tolShown, onTol]);

  useEffect(() => {
    let live = true;
    (async () => {
      setStatus({ text: "Working…", err: false });
      await new Promise((r) => setTimeout(r, 20));
      if (!live) return;
      const res = await buildPackImage({
        front,
        side,
        top,
        pack,
        packKind,
        rots,
        removeBg: true,
        tol,
        threeD,
        cropped,
      }).catch(() => null);
      if (!live) return;
      if (!res) {
        setStatus({ text: "A photo couldn't be opened. Go back, remove it, and choose a JPG or PNG photo.", err: true });
        onCut(null);
        return;
      }
      const cv = view.current;
      if (cv) {
        cv.width = res.canvas.width;
        cv.height = res.canvas.height;
        cv.getContext("2d")?.drawImage(res.canvas, 0, 0);
      }
      onCut(res.canvas);
      onFaceCanvases(res.faces ?? {});
      setStatus(statusFor(res, Boolean(pack)));
    })();
    return () => {
      live = false;
    };
  }, [front, side, top, pack, packKind, rots, tol, threeD, cropped, onCut, onFaceCanvases]);

  const labels: [keyof FaceRotations, string, unknown][] = [
    ["front", "front", files.front],
    ["side", "left end", files.side],
    ["top", "top", files.top],
    ["pack", "strip / bottle", files.pack],
  ];
  const rotatable = labels.filter(([, , file]) => file);

  return (
    <div className="two">
      <div className="check-bg">
        <canvas ref={view} width={10} height={10} aria-label="Product picture for the catalogue and circular" />
      </div>
      <div className="card stack">
        <div>
          <h2>Your product picture</h2>
          <p className="muted">The box is straightened automatically and shown at an angle, like your printed catalogue.</p>
        </div>
        {notABoxToggle}
        {files.pack && (
          <label className="field">
            <span>Beside the box</span>
            <select value={packKind} onChange={(e) => onPackKind(e.target.value as PackKind)}>
              {PACK_KINDS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="confirm">
          <input type="checkbox" checked={cropped} onChange={(e) => onCropped(e.target.checked)} />
          <span>
            Photos are cropped to the box
            <br />
            <span className="muted">Tick this if you cropped each box photo to its edges in your gallery. They are used as they are.</span>
          </span>
        </label>
        <label className="confirm">
          <input type="checkbox" checked={threeD} onChange={(e) => onThreeD(e.target.checked)} />
          <span>
            Show the box in 3D
            <br />
            <span className="muted">Uses the Left end photo if you marked one; otherwise the front&apos;s edge colours.</span>
          </span>
        </label>
        <label className="field">
          <span>
            How much background to remove <span className="hint">Raise it if background is left; lower it if the pack gets cut.</span>
          </span>
          <input type="range" min={12} max={120} value={tolShown} onChange={(e) => setTolShown(Number(e.target.value))} />
        </label>
        <div className="row">
          {rotatable.map(([face, label]) => (
            <button key={face} className="btn" type="button" onClick={() => onRotate(face)}>
              Rotate {label} 90°
            </button>
          ))}
        </div>
        <p className={`status${status.err ? " err" : ""}`} role="status">
          {status.text}
        </p>
      </div>
    </div>
  );
}
