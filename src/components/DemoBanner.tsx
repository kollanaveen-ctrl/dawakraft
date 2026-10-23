import { demoMode } from "@/lib/config";

const isLocal = process.env.NODE_ENV !== "production";

/** On your own computer only, until the Cloudflare database is switched on. The online demo shows no banner. */
export function DemoBanner() {
  if (!demoMode || !isLocal) return null;
  return (
    <div className="notice warn" role="note">
      <span className="dot warn" />
      <p>
        <b>Local preview.</b> Your products and photos are saved in this browser. They won&apos;t appear on another device.
      </p>
    </div>
  );
}
