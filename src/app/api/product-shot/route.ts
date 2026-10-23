import { NextResponse } from "next/server";
import { UNSUPPORTED_PHOTO_MESSAGE } from "@/lib/image/photo-policy";
/** Retired: generated packaging changes real artwork. */
export async function POST() {
  return NextResponse.json({ ok: false, error: "image_rejected", message: UNSUPPORTED_PHOTO_MESSAGE }, { status: 410 });
}
