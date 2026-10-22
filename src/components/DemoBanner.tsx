import { aiProvider } from "@/lib/ai";
import { demoMode } from "@/lib/config";

const isLocal = process.env.NODE_ENV !== "production";

/** What "Read box with AI" does on the online demo, given the configured provider. */
function onlineAiNote(): string {
  const choice = aiProvider();
  if (!choice.ok) return "AI reading is off here, so type the details from the carton.";
  if (choice.provider.paid) {
    return "“Read box with AI” reads your photos with real AI once you enter the demo passcode; without it, type the details from the carton.";
  }
  return "“Read box with AI” fills in clearly labelled sample values here, not a real reading of your photos.";
}

/** Shown on every screen until real Supabase keys are added. */
export function DemoBanner() {
  if (!demoMode) return null;
  return (
    <div className="notice warn" role="note">
      <span className="dot warn" />
      {isLocal ? (
        <p>
          <b>Demo mode.</b> Supabase isn&apos;t connected yet, so products are saved only in this browser and there is no sign-in. To go live,
          put your real Supabase keys in <span className="mono" style={{ textTransform: "none" }}>app/.env.local</span> and restart (README, steps 1–4).
        </p>
      ) : (
        <p>
          <b>Demo.</b> Try everything freely: your products and company details are saved only in this browser, on this device. {onlineAiNote()}
        </p>
      )}
    </div>
  );
}
