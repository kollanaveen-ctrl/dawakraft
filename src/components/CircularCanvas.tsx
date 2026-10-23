"use client";
import { useEffect, useRef } from "react";
import type { TemplateKey } from "@/lib/constants";
import type { Drawable } from "@/lib/circular/draw";
import { fontsReady } from "@/lib/circular/draw";
import { CIRCULAR_W, circularSize, renderCircular } from "@/lib/circular/render";
import type { Promo } from "@/lib/promo";
import type { Company, ProductFields } from "@/lib/types";

type Props = {
  product: ProductFields;
  company: Company;
  template: TemplateKey;
  image: Drawable | null;
  logo: Drawable | null;
  /** Promo circular only. */
  promo?: Promo;
  photo?: Drawable | null;
  /** Canvas pixel width; the height keeps the layout's shape. */
  width?: number;
  label?: string;
  decorative?: boolean;
};

export function CircularCanvas({ product, company, template, image, logo, promo, photo, width = CIRCULAR_W, label, decorative }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let live = true;
    fontsReady().then(() => {
      if (live && ref.current) renderCircular(ref.current, { product, company, template, image, logo, promo, photo });
    });
    return () => {
      live = false;
    };
  }, [product, company, template, image, logo, promo, photo, width]);
  const size = circularSize(template, promo);

  return (
    <canvas
      ref={ref}
      width={width}
      height={Math.round((width * size.height) / size.width)}
      aria-label={decorative ? undefined : label}
      aria-hidden={decorative || undefined}
      role={decorative ? undefined : "img"}
    />
  );
}
