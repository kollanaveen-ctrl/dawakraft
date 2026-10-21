"use client";
import { useEffect, useRef, useState } from "react";
import type { FaceRotations } from "@/lib/faces";
import { buildPackImage, type PackResult } from "@/lib/image/packshot";

const SLIDER_DEBOUNCE_MS = 180;

type Props = {
  /** The new front photo, or the saved product image when editing without new photos. */
  front: File | HTMLImageElement | null;
  side: File | null;
  top: File | null;
  rots: FaceRotations;
  removeBg: boolean;
  threeD: boolean;
  tol: number;
  onRotate: (face: keyof FaceRotations) => void;
  onRemoveBg: (on: boolean) => void;
  onThreeD: (on: boolean) => void;
  onTol: (tol: number) => void;
  /** Called with the finished picture (or null if there is none). Must be stable (a state setter). */
  onCut: (canvas: HTMLCanvasElement | null) => void;
};

type Status = { text: string; err: boolean };

function statusFor(res: PackResult, isNewPhoto: boolean, removeBg: boolean): Status {
  if (!isNewPhoto) return { text: "Using the saved photo. Add new photos in step 1 to replace it.", err: false };
  if (!res.ok) return { text: "Couldn't separate the box from the background. Lower the slider, or retake the photo on a plainer surface.", err: true };
  if (res.is3D) return { text: "3D pack shot ready. If a side looks sideways, rotate it below.", err: false };
  if (!removeBg) return { text: "Background kept.", err: false };
  return { text: "Background removed. Check the edges of the box.", err: false };
}

export function CleanupStep(props: Props) {
  const { front, side, top, rots, removeBg, threeD, tol, onRotate, onRemoveBg, onThreeD, onTol, onCut } = props;
  const view = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<Status>({ text: "", err: false });
  const [tolShown, setTolShown] = useState(tol);
  const isNewPhoto = front instanceof File;
  const canBe3D = isNewPhoto && Boolean(side || top);
  const show3D = canBe3D && threeD;

  useEffect(() => {
    const t = setTimeout(() => onTol(tolShown), SLIDER_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [tolShown, onTol]);

  useEffect(() => {
    let live = true;
    (async () => {
      if (!front) {
        setStatus({ text: "Add a photo in step 1 to see it here.", err: false });
        onCut(null);
        return;
      }
      setStatus({ text: "Working…", err: false });
      await new Promise((r) => setTimeout(r, 20));
      if (!live) return;
      const res = await buildPackImage({ front, side, top, rots, removeBg, tol, threeD: show3D }).catch(() => null);
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
      setStatus(statusFor(res, isNewPhoto, removeBg));
    })();
    return () => {
      live = false;
    };
  }, [front, side, top, rots, removeBg, tol, show3D, isNewPhoto, onCut]);

  return (
    <div className="two">
      <div className="check-bg">
        <canvas ref={view} width={10} height={10} aria-label="Product picture for the circular" />
      </div>
      <div className="card stack">
        <h2>Clean up the product picture</h2>
        {canBe3D && (
          <label className="confirm">
            <input type="checkbox" checked={threeD} onChange={(e) => onThreeD(e.target.checked)} />
            <span>
              Show as a 3D pack
              <br />
              <span className="muted">Uses the photos marked Side and Top in step 1.</span>
            </span>
          </label>
        )}
        <label className="confirm">
          <input type="checkbox" checked={removeBg} onChange={(e) => onRemoveBg(e.target.checked)} />
          <span>
            Remove the background
            <br />
            <span className="muted">Works best when the box sits on a plain surface.</span>
          </span>
        </label>
        <label className="field">
          <span>
            How much to remove <span className="hint">Raise it if background is left; lower it if the box gets cut.</span>
          </span>
          <input type="range" min={12} max={120} value={tolShown} onChange={(e) => setTolShown(Number(e.target.value))} />
        </label>
        <div className="row">
          <button className="btn" type="button" onClick={() => onRotate("front")}>
            {show3D ? "Rotate front 90°" : "Rotate 90°"}
          </button>
          {show3D && side && (
            <button className="btn" type="button" onClick={() => onRotate("side")}>
              Rotate side 90°
            </button>
          )}
          {show3D && top && (
            <button className="btn" type="button" onClick={() => onRotate("top")}>
              Rotate top 90°
            </button>
          )}
        </div>
        <p className={`status${status.err ? " err" : ""}`}>{status.text}</p>
      </div>
    </div>
  );
}
