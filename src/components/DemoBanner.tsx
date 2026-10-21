import { demoMode } from "@/lib/config";

/** Shown on every screen until real Supabase keys are added to .env.local. */
export function DemoBanner() {
  if (!demoMode) return null;
  return (
    <div className="notice warn" role="note">
      <span className="dot warn" />
      <p>
        <b>Demo mode.</b> Supabase isn&apos;t connected yet, so products are saved only in this browser and there is no sign-in. To go live,
        put your real Supabase keys in <span className="mono" style={{ textTransform: "none" }}>app/.env.local</span> and restart (README, steps 1–4).
      </p>
    </div>
  );
}
