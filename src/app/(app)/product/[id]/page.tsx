"use client";
import { useParams } from "next/navigation";
import { ProductView } from "@/components/ProductView";

export default function ProductPage() {
  const { id } = useParams<{ id: string }>();
  return <ProductView id={id} />;
}
