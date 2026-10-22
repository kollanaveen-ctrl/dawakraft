"use client";
import { useEffect, useMemo } from "react";
import { PACK_KINDS, roleOf, type FaceRole, type Faces, type PackKind } from "@/lib/faces";
import { plural } from "@/lib/format";

type Props = {
  files: File[];
  faces: Faces;
  editing: boolean;
  packKind: PackKind;
  onPackKind: (kind: PackKind) => void;
  onAdd: (files: File[]) => void;
  onSetRole: (i: number, role: FaceRole) => void;
  onRemove: (i: number) => void;
};

const ROLE_LABELS: [FaceRole, string][] = [
  ["front", "Front"],
  ["side", "Left end"],
  ["top", "Top"],
  ["pack", "Strip / bottle / tube"],
  ["none", "Other side"],
];

export function PhotosStep({ files, faces, editing, packKind, onPackKind, onAdd, onSetRole, onRemove }: Props) {
  const urls = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls]);

  function pick(list: FileList | null) {
    const images = [...(list ?? [])].filter((f) => f.type.startsWith("image/"));
    if (images.length) onAdd(images);
  }

  const count = files.length ? plural(files.length, "photo") : editing ? "Keeping the saved photo" : "No photos yet";
  const hasPack = faces.pack != null;

  return (
    <div className="card stack">
      <div>
        <h2>Photograph the box and its strip</h2>
        <p className="muted">
          One pack per photo, on a plain sheet, in daylight without flash. Stand back and zoom in so the edges look straight. All photos are read for details.
        </p>
        <p className="muted" style={{ marginTop: 6 }}>
          Mark the <b>Front</b>, the <b>Left end</b> (the narrow side with the brand name) and one <b>Strip / bottle / tube</b>. It&apos;s placed in front of
          the box, like your printed catalogue. Use a dark plain sheet (black chart paper) so white cartons and silver strips stand out; use white only for dark or amber bottles.
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
          {files.length > 0 && (hasPack ? " · box with its strip or bottle" : " · box only")}
        </span>
      </div>
      {hasPack && (
        <label className="field">
          <span>The Strip / bottle / tube photo shows a</span>
          <select value={packKind} onChange={(e) => onPackKind(e.target.value as PackKind)}>
            {PACK_KINDS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      )}
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
