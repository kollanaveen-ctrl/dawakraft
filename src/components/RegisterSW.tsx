"use client";
import { useEffect } from "react";

/** Registers the service worker that lets phones install Dawakraft like an app. */
export function RegisterSW() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch((e) => {
      console.warn("Service worker registration failed", e);
    });
  }, []);
  return null;
}
