import { demoMode } from "@/lib/config";

const isLocal = process.env.NODE_ENV !== "production";

/** On your own computer only, until the Cloudflare database is switched on. The online demo shows no banner. */
export function DemoBanner() {
  if (!demoMode || !isLocal) return null;
  return (
    <div className="notice warn" role="note">
      <span className="dot warn" />
      <p>
        <b>Demo mode.</b> The Cloudflare database isn&apos;t switched on yet, so products are saved only in this browser and there is no sign-in.
        To go live, fill in the Cloudflare settings in <span className="mono" style={{ textTransform: "none" }}>app/.env.local</span> and restart
        (README, &ldquo;Turning on real accounts&rdquo;).
      </p>
    </div>
  );
}
