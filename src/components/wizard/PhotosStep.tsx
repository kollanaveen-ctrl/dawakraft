"use client";
import { useEffect, useMemo } from "react";
import { roleOf, type FaceRole, type Faces } from "@/lib/faces";
import { plural } from "@/lib/format";

type Props = {
  files: File[];
  faces: Faces;
  editing: boolean;
  onAdd: (files: File[]) => void;
  onSetRole: (i: number, role: FaceRole) => void;
  onRemove: (i: number) => void;
};

const ROLE_LABELS: [FaceRole, string][] = [
  ["front", "Front"],
  ["side", "Side"],
  ["top", "Top"],
  ["none", "Other side"],
];

export function PhotosStep({ files, faces, editing, onAdd, onSetRole, onRemove }: Props) {
  const urls = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls]);

  function pick(list: FileList | null) {
    const images = [...(list ?? [])].filter((f) => f.type.startsWith("image/"));
    if (images.length) onAdd(images);
  }

  const count = files.length ? plural(files.length, "photo") : editing ? "Keeping the saved photo" : "No photos yet";
  const has3D = faces.side != null || faces.top != null;

  return (
    <div className="card stack">
      <div>
        <h2>Photograph every side of the box</h2>
        <p className="muted">
          Shoot on a plain, light surface with even light. Mark the photo that shows the front; it goes on the circular. All photos are read for details.
        </p>
        <p className="muted" style={{ marginTop: 6 }}>
          For a 3D pack shot, also mark a <b>Side</b> photo (the side to the right of the front) and, if you have it, the <b>Top</b>.
        </p>
      </div>
      <div className="row">
        <label className="btn primary">
          Take photo
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="vis-hidden"
            onChange={(e) => {
              pick(e.target.files);
              e.target.value = "";
            }}
          />
        </label>
        <label className="btn">
          Choose from gallery
          <input
            type="file"
            accept="image/*"
            multiple
            className="vis-hidden"
            onChange={(e) => {
              pick(e.target.files);
              e.target.value = "";
            }}
          />
        </label>
        <span className="muted">
          {count}
          {files.length > 0 && (has3D ? " · 3D pack shot on" : " · flat front photo")}
        </span>
      </div>
      <div className="thumbs">
        {files.map((f, i) => {
          const role = roleOf(faces, i);
          return (
            <div key={`${f.name}-${f.lastModified}-${i}`} className={`thumb${role === "front" ? " front" : role !== "none" ? " face" : ""}`}>
              {/* eslint-disable-next-line @next/next/no-img-element -- local preview of a picked file */}
              <img src={urls[i]} alt={`Box photo ${i + 1}`} />
              <div className="tbar">
                <select aria-label={`What photo ${i + 1} shows`} value={role} onChange={(e) => onSetRole(i, e.target.value as FaceRole)}>
                  {ROLE_LABELS.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <button type="button" aria-label={`Remove photo ${i + 1}`} onClick={() => onRemove(i)}>
                  ✕
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
