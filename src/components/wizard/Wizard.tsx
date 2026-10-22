"use client";
// The five-step "box to circular" flow: Photos → Clean up → Details → Check → Circular.
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { hasBlockingIssue, runChecks } from "@/lib/compliance";
import type { FieldKey, TemplateKey } from "@/lib/constants";
import { EMPTY_DRAFT, draftToFields, productToDraft } from "@/lib/data/mappers";
import * as repo from "@/lib/data/repo";
import {
  NO_FACES,
  NO_ROTATION,
  aiRoleOf,
  assignRole,
  removePhoto,
  type BoxFace,
  type FaceCanvases,
  type FaceRole,
  type FaceRotations,
  type Faces,
  type PackKind,
} from "@/lib/faces";
import { DEFAULT_TOLERANCE } from "@/lib/image/cutout";
import { loadImage, productImageBlob } from "@/lib/image/encode";
import { buildPackImage } from "@/lib/image/packshot";
import { highlightFor, highlightOnToggle, isNewLaunch, nextLaunchedAt } from "@/lib/segments";
import type { DraftFields, Product } from "@/lib/types";
import { primeMediaImage, useData, useMediaImage } from "../DataProvider";
import { useToast } from "../Toast";
import { CheckStep } from "./CheckStep";
import { CircularStep } from "./CircularStep";
import { CleanupStep } from "./CleanupStep";
import { DetailsStep } from "./DetailsStep";
import { PhotosStep } from "./PhotosStep";

const STEPS = ["Photos", "Clean up", "Details", "Check", "Circular"];
type Low = Partial<Record<FieldKey, true>>;

export function Wizard({ product }: { product: Product | null }) {
  const { company, userId, putProduct } = useData();
  const router = useRouter();
  const toast = useToast();
  const logo = useMediaImage(company.logoPath);
  const existingImage = useMediaImage(product?.imagePath);
  const editing = Boolean(product);

  // A new product gets its id when first saved (ids can't be made during the server pre-render).
  const idRef = useRef<string | null>(product?.id ?? null);
  const [step, setStep] = useState(editing ? 3 : 1);
  const [reached, setReached] = useState(editing ? 3 : 1);
  const [files, setFiles] = useState<File[]>([]);
  const [faces, setFaces] = useState<Faces>(NO_FACES);
  const [rots, setRots] = useState<FaceRotations>(NO_ROTATION);
  const [removeBg, setRemoveBg] = useState(true);
  const [threeD, setThreeD] = useState(true);
  const [tol, setTol] = useState(DEFAULT_TOLERANCE);
  const [cut, setCut] = useState<HTMLCanvasElement | null>(null);
  // Whether the pack is not a box at all, and what stands beside the box (strip, bottle or tube).
  // `cut` stays the final product picture.
  const [notABox, setNotABox] = useState(false);
  const [packKind, setPackKind] = useState<PackKind>("strip");
  const [cropped, setCropped] = useState(false);
  // Straightened faces, kept for sending the legible side panels (composition, strength) to the AI.
  const [faceCanvases, setFaceCanvases] = useState<FaceCanvases>({});
  // Straightened faces as files, so the AI reads flat, sharp panels instead of tilted photos.
  const [faceFiles, setFaceFiles] = useState<Partial<Record<BoxFace, File>>>({});
  const [strengthOnFront, setStrengthOnFront] = useState("");
  const [fields, setFields] = useState<DraftFields>(() => (product ? productToDraft(product) : EMPTY_DRAFT));
  const [isNew, setIsNew] = useState(() => (product ? isNewLaunch(product) : true));
  const [low, setLow] = useState<Low>({});
  const [confirmed, setConfirmed] = useState(false);
  const [template, setTemplate] = useState<TemplateKey>(product?.template ?? "catalog");
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState({ text: "", err: false });

  const frontFile = files[faces.front] ?? null;
  const sideFile = faces.side == null ? null : (files[faces.side] ?? null);
  const topFile = faces.top == null ? null : (files[faces.top] ?? null);
  const packFile = faces.pack == null ? null : (files[faces.pack] ?? null);

  const checks = useMemo(
    () => runChecks({ fields, confirmed, companyName: company.name, strengthOnFront }),
    [fields, confirmed, company.name, strengthOnFront],
  );

  useEffect(() => {
    let live = true;
    const entries = Object.entries(faceCanvases) as [BoxFace, HTMLCanvasElement][];
    Promise.all(
      entries.map(
        ([face, cv]) =>
          new Promise<[BoxFace, File] | null>((resolve) =>
            cv.toBlob((b) => resolve(b ? [face, new File([b], `${face}.jpg`, { type: "image/jpeg" })] : null), "image/jpeg", 0.9),
          ),
      ),
    ).then((pairs) => {
      if (live) setFaceFiles(Object.fromEntries(pairs.filter((p): p is [BoxFace, File] => p !== null)));
    });
    return () => {
      live = false;
    };
  }, [faceCanvases]);

  const aiPhotos = useMemo(
    () =>
      files.map((file, i) => {
        const role = aiRoleOf(faces, i);
        const straight = role !== "other" ? faceFiles[role] : undefined;
        return { file: straight ?? file, role };
      }),
    [files, faces, faceFiles],
  );
  const circularFields = useMemo(
    () => ({ ...draftToFields(fields), highlight: highlightFor(fields.highlight, isNew) }),
    [fields, isNew],
  );
  const tolChange = useCallback((t: number) => setTol(t), []);

  // If photos changed and step 2 was skipped, prepare the pack shot in the background.
  useEffect(() => {
    if (step < 3 || cut || !frontFile) return;
    let live = true;
    buildPackImage({ front: frontFile, side: sideFile, top: topFile, pack: packFile, packKind, rots, removeBg, tol, threeD, notABox, cropped })
      .then((res) => {
        if (!live) return;
        setCut(res.canvas);
        setFaceCanvases(res.faces ?? {});
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [step, cut, frontFile, sideFile, topFile, packFile, packKind, rots, removeBg, tol, threeD, notABox, cropped]);

  function go(n: number) {
    setStep(n);
    setReached((r) => Math.max(r, n));
    window.scrollTo(0, 0);
  }

  function changePhotos(next: File[], nextFaces: Faces) {
    setFiles(next);
    setFaces(nextFaces);
    setRots(NO_ROTATION);
    setFaceCanvases({});
    setCut(null);
  }

  function setRole(i: number, role: FaceRole) {
    changePhotos(files, assignRole(faces, i, role, files.length));
  }

  function rotate(face: keyof FaceRotations) {
    setRots((r) => ({ ...r, [face]: (r[face] + 90) % 360 }));
  }

  function changePackKind(kind: PackKind) {
    setPackKind(kind);
    setCut(null);
  }

  function changeCropped(on: boolean) {
    setCropped(on);
    setCut(null);
  }

  function changeNotABox(on: boolean) {
    setNotABox(on);
    setFaceCanvases({});
  }

  let canNext = true;
  let nextLabel = "Next";
  if (step === 1) {
    canNext = files.length > 0 || editing;
    nextLabel = canNext ? "Next" : "Add a photo first";
  } else if (step === 3) {
    canNext = confirmed && fields.name.trim().length > 0;
    nextLabel = canNext ? "Next" : "Confirm the details first";
  } else if (step === 4) {
    canNext = !hasBlockingIssue(checks);
    nextLabel = canNext ? "Next" : "Fix the red items";
  }

  function next() {
    if (step === 1 && !files.length && editing) return go(3);
    if (step < STEPS.length) go(step + 1);
  }

  async function save() {
    if (!userId) {
      setSaveStatus({ text: "Your sign-in expired. Reload the page and sign in again.", err: true });
      return;
    }
    // Re-check here: the step buttons let people jump back and change things after passing step 4.
    if (!confirmed || hasBlockingIssue(checks)) {
      setSaveStatus({ text: "Something changed since the check. Fix the red items first.", err: true });
      go(confirmed ? 4 : 3);
      return;
    }
    if (files.length && !cut) {
      setSaveStatus({ text: "The photos couldn't be prepared. Go back to Photos and remove them or choose others.", err: true });
      return;
    }
    setSaving(true);
    setSaveStatus({ text: "Saving…", err: false });
    idRef.current ??= crypto.randomUUID();
    const id = idRef.current;
    let uploaded: string | null = null;
    try {
      let imagePath = product?.imagePath ?? null;
      if (cut && (files.length || rots.front)) {
        const blob = await productImageBlob(cut);
        uploaded = await repo.uploadMedia(userId, `products/${id}`, blob);
        imagePath = uploaded;
        primeMediaImage(uploaded, await loadImage(URL.createObjectURL(blob)));
      }
      const now = new Date().toISOString();
      const saved = await repo.saveProduct({
        ...draftToFields(fields),
        id,
        template,
        imagePath,
        example: Boolean(product?.example && !uploaded),
        launchedAt: nextLaunchedAt(product?.launchedAt ?? null, isNew, now),
        createdAt: product?.createdAt ?? now,
        updatedAt: now,
      });
      if (uploaded && product?.imagePath) await repo.removeMedia([product.imagePath]);
      putProduct(saved);
      toast("Saved to catalog");
      router.push(`/product/${saved.id}`);
    } catch (e) {
      if (uploaded) await repo.removeMedia([uploaded]);
      setSaveStatus({ text: repo.friendlyError(e), err: true });
      setSaving(false);
    }
  }

  const detailsChanged = () => setReached((r) => Math.min(r, 3)); // changed details must pass the check again

  return (
    <section aria-labelledby="h-new">
      <p className="mono muted">{editing ? "Edit product" : "New product"}</p>
      <h1 id="h-new">{editing ? product?.name || "Edit product" : "From box to circular"}</h1>
      <ol className="steps">
        {STEPS.map((label, i) => {
          const n = i + 1;
          return (
            <li key={label}>
              <button type="button" aria-current={n === step ? "step" : undefined} disabled={n > reached} onClick={() => go(n)}>
                <span className="n">{n}</span>
                {label}
              </button>
            </li>
          );
        })}
      </ol>

      {step === 1 && (
        <PhotosStep
          files={files}
          faces={faces}
          editing={editing}
          packKind={packKind}
          onPackKind={changePackKind}
          onAdd={(more) => changePhotos([...files, ...more], faces)}
          onSetRole={setRole}
          onRemove={(i) => changePhotos(files.filter((_, k) => k !== i), removePhoto(faces, i, files.length))}
        />
      )}
      {step === 2 && (
        <CleanupStep
          front={frontFile ?? existingImage}
          side={sideFile}
          top={topFile}
          rots={rots}
          removeBg={removeBg}
          threeD={threeD}
          tol={tol}
          onRotate={rotate}
          onRemoveBg={setRemoveBg}
          onThreeD={setThreeD}
          onTol={tolChange}
          onCut={setCut}
          notABox={notABox}
          onNotABox={changeNotABox}
          pack={packFile}
          packKind={packKind}
          onPackKind={changePackKind}
          cropped={cropped}
          onCropped={changeCropped}
          onFaceCanvases={setFaceCanvases}
        />
      )}
      {step === 3 && (
        <DetailsStep
          fields={fields}
          low={low}
          photos={aiPhotos}
          strengthOnFront={strengthOnFront}
          onStrengthOnFront={(v) => {
            setStrengthOnFront(v);
            detailsChanged();
          }}
          confirmed={confirmed}
          isNew={isNew}
          onFields={(f, l) => {
            setFields(f);
            setLow(l);
            detailsChanged();
          }}
          onConfirmed={(v) => {
            setConfirmed(v);
            detailsChanged();
          }}
          onIsNew={(v) => {
            setIsNew(v);
            setFields({ ...fields, highlight: highlightOnToggle(fields.highlight, v) });
            detailsChanged();
          }}
        />
      )}
      {step === 4 && <CheckStep checks={checks} />}
      {step === 5 && (
        <CircularStep
          fields={circularFields}
          company={company}
          image={cut ?? existingImage}
          logo={logo}
          template={template}
          saving={saving}
          status={saveStatus}
          onTemplate={setTemplate}
          onSave={save}
        />
      )}

      <div className="wizard-nav">
        {step > 1 ? (
          <button className="btn" type="button" onClick={() => go(step - 1)}>
            Back
          </button>
        ) : (
          <span />
        )}
        {step < STEPS.length && (
          <button className="btn primary" type="button" onClick={next} disabled={!canNext}>
            {nextLabel}
          </button>
        )}
      </div>
    </section>
  );
}
