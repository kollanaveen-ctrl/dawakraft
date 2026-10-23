"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useData } from "@/components/DataProvider";
import { Wizard } from "@/components/wizard/Wizard";
import { FlyerStudio } from "@/components/FlyerStudio";

export default function EditProductPage() {
  const { id } = useParams<{ id: string }>();
  const { loaded, products } = useData();
  const product = products.find((p) => p.id === id);

  if (!loaded) return <p className="muted">Loading…</p>;
  if (!product) {
    return (
      <div className="empty">
        <h2>Product not found</h2>
        <Link className="btn" href="/catalog">
          Back to catalog
        </Link>
      </div>
    );
  }
  return product.promo.layout ? <FlyerStudio key={product.id} product={product} /> : <Wizard key={product.id} product={product} />;
}
