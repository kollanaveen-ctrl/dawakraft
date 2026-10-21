"use client";
import { useEffect, useRef } from "react";
import type { TemplateKey } from "@/lib/constants";
import type { Drawable } from "@/lib/circular/draw";
import { fontsReady } from "@/lib/circular/draw";
import { CIRCULAR_H, CIRCULAR_W, renderCircular } from "@/lib/circular/render";
import type { Company, ProductFields } from "@/lib/types";

type Props = {
  product: ProductFields;
  company: Company;
  template: TemplateKey;
  image: Drawable | null;
  logo: Drawable | null;
  /** Canvas pixel width; the height keeps the 1080×1350 shape. */
  width?: number;
  label?: string;
  decorative?: boolean;
};

export function CircularCanvas({ product, company, template, image, logo, width = CIRCULAR_W, label, decorative }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let live = true;
    fontsReady().then(() => {
      if (live && ref.current) renderCircular(ref.current, { product, company, template, image, logo });
    });
    return () => {
      live = false;
    };
  }, [product, company, template, image, logo]);

  return (
    <canvas
      ref={ref}
      width={width}
      height={Math.round((width * CIRCULAR_H) / CIRCULAR_W)}
      aria-label={decorative ? undefined : label}
      aria-hidden={decorative || undefined}
      role={decorative ? undefined : "img"}
    />
  );
}
