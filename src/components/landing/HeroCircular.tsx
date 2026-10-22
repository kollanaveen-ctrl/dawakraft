"use client";
// The landing page hero: a real circular drawn by the app's own renderer, with a 3D pack shot
// built from sample carton faces, cycling through the layouts.
import { useEffect, useState } from "react";
import { CircularCanvas } from "@/components/CircularCanvas";
import { SAMPLE, TEMPLATES, type TemplateKey } from "@/lib/constants";
import { EMPTY_COMPANY } from "@/lib/data/mappers";
import { composePackShot } from "@/lib/image/packshot";

const CYCLE_MS = 3800;
// The Promo circular is landscape and needs its own content, so the portrait hero skips it.
const HERO_TEMPLATES = TEMPLATES.filter(([k]) => k !== "promo");
const COMPANY = {
  ...EMPTY_COMPANY,
  name: "Sri Balaji Pharma",
  tagline: "Pharmaceutical distributor, Hyderabad",
  phone: "+91 98480 00000",
  email: "orders@sribalaji.example",
  address: "Koti, Hyderabad",
  licence: "TS/HYD/20B-0000",
};

function face(w: number, h: number, label: string, sub: string): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const x = c.getContext("2d");
  if (!x) return c;
  x.fillStyle = "#FFFFFF";
  x.fillRect(0, 0, w, h);
  x.fillStyle = "#0E5E4E";
  x.fillRect(0, 0, w, h * 0.42);
  x.fillStyle = "#E9A23B";
  x.fillRect(0, h * 0.42, w, h * 0.04);
  x.fillStyle = "#FFFFFF";
  x.font = `800 ${Math.round(Math.min(h * 0.11, w * 0.15))}px sans-serif`;
  x.fillText(label, w * 0.08, h * 0.27);
  x.fillStyle = "#24302C";
  x.font = `500 ${Math.round(Math.min(h * 0.05, w * 0.075))}px sans-serif`;
  x.fillText(sub, w * 0.08, h * 0.62);
  return c;
}

export function HeroCircular() {
  const [image, setImage] = useState<HTMLCanvasElement | null>(null);
  const [i, setI] = useState(0);

  useEffect(() => {
    const shot = composePackShot(
      face(420, 600, "Exampol 650", "Paracetamol IP 650 mg"),
      face(150, 600, "650", "10 × 15 tablets"),
      face(420, 150, "EXAMPOL", ""),
    );
    Promise.resolve().then(() => setImage(shot));
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setI((n) => (n + 1) % HERO_TEMPLATES.length), CYCLE_MS);
    return () => clearInterval(t);
  }, []);

  const template: TemplateKey = HERO_TEMPLATES[i][0];
  return (
    <figure className="hero-art">
      <CircularCanvas product={SAMPLE} company={COMPANY} template={template} image={image} logo={null} width={720} label="Example product circular made by Dawakraft" />
      <figcaption>
        <span className="mono">{HERO_TEMPLATES[i][1]} layout</span> · drawn by the app from sample photos
      </figcaption>
    </figure>
  );
}
