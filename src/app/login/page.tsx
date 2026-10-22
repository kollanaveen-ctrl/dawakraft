"use client";
// Sign in with an emailed 6-digit code: step 1 asks for the email, step 2 for the code.
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Brand } from "@/components/AppBar";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESEND_AFTER_S = 60;

const START_ERRORS: Record<string, string> = {
  rate_limited: "Too many codes asked for. Wait 10 minutes, then try again.",
  bad_request: "Enter a valid email address.",
  not_configured: "Sign-in isn't switched on yet. Ask whoever set up Dawakraft to finish the setup.",
};
const VERIFY_ERRORS: Record<string, string> = {
  invalid_code: "That code didn't work. Check it, or send a new one. Codes last 10 minutes.",
  bad_request: "Type the 6 digits from the email.",
  rate_limited: "Too many tries. Wait a few minutes, then send a new code.",
  not_configured: START_ERRORS.not_configured,
};
const PASSCODE_ERRORS: Record<string, string> = {
  invalid_code: "That passcode isn't right.",
  bad_request: "Enter the passcode.",
  rate_limited: "Too many tries. Wait 10 minutes, then try again.",
  not_configured: START_ERRORS.not_configured,
};
const NETWORK_ERROR = "Couldn't reach Dawakraft. Check your connection and try again.";

/** POST JSON to an auth route; returns the error code, or null when it worked. */
async function post(path: string, body: unknown): Promise<string | null> {
  try {
    const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
    return res.ok && json?.ok ? null : (json?.error ?? "network");
  } catch {
    return "network";
  }
}

function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(0);
  const [status, setStatus] = useState("");
  const [isError, setIsError] = useState(false);
  const [useEmail, setUseEmail] = useState(false);
  const [passcode, setPasscode] = useState("");

  // Count down to "Send a new code".
  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  function show(text: string, err = false) {
    setStatus(text);
    setIsError(err);
  }

  async function submitPasscode(e: FormEvent) {
    e.preventDefault();
    if (!passcode.trim()) return show(PASSCODE_ERRORS.bad_request, true);
    setBusy(true);
    const error = await post("/api/auth/passcode", { passcode: passcode.trim() });
    setBusy(false);
    if (error) return show(error === "network" ? NETWORK_ERROR : (PASSCODE_ERRORS[error] ?? "Couldn't sign in. Try again."), true);
    router.replace("/catalog");
    router.refresh();
  }

  async function sendCode(e?: FormEvent) {
    e?.preventDefault();
    const clean = email.trim().toLowerCase();
    if (!EMAIL_RE.test(clean)) return show("Enter a valid email address.", true);
    setBusy(true);
    const error = await post("/api/auth/start", { email: clean });
    setBusy(false);
    if (error) return show(START_ERRORS[error] ?? "Couldn't send the email. Wait a minute and try again.", true);
    setSent(true);
    setCode("");
    setWait(RESEND_AFTER_S);
    show(`We sent a 6-digit code to ${clean}. It works for 10 minutes. Check spam if you don't see it.`);
  }

  async function verify(e: FormEvent) {
    e.preventDefault();
    const digits = code.replace(/\D/g, "");
    if (digits.length !== 6) return show("Type the 6 digits from the email.", true);
    setBusy(true);
    const error = await post("/api/auth/verify", { email: email.trim().toLowerCase(), code: digits });
    setBusy(false);
    if (error) return show(error === "network" ? NETWORK_ERROR : (VERIFY_ERRORS[error] ?? "Couldn't sign in. Try again."), true);
    router.replace("/catalog");
    router.refresh();
  }

  return (
    <div className="card stack" style={{ maxWidth: 440, margin: "40px auto 0" }}>
      <div>
        <p className="mono muted">Sign in</p>
        <h1>Your product catalog</h1>
      </div>
      {!useEmail ? (
        <form className="stack" onSubmit={submitPasscode}>
          <label className="field" htmlFor="passcode">
            Passcode
            <input
              id="passcode"
              type="password"
              autoComplete="off"
              maxLength={100}
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              autoFocus
              required
            />
          </label>
          <button className="btn primary" disabled={busy}>
            {busy ? "Checking…" : "Enter"}
          </button>
          <button type="button" className="btn ghost" onClick={() => { setUseEmail(true); show(""); }}>
            Use an email code instead
          </button>
        </form>
      ) : !sent ? (
        <form className="stack" onSubmit={sendCode}>
          <label className="field" htmlFor="email">
            Email
            <input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <button className="btn primary" disabled={busy}>
            {busy ? "Sending…" : "Email me a code"}
          </button>
        </form>
      ) : (
        <form className="stack" onSubmit={verify}>
          <label className="field" htmlFor="code">
            Code from the email
            <input
              id="code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={7}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoFocus
            />
          </label>
          <div className="row">
            <button className="btn primary" disabled={busy}>
              {busy ? "Checking…" : "Sign in"}
            </button>
            <button type="button" className="btn ghost" disabled={busy || wait > 0} onClick={() => void sendCode()}>
              {wait > 0 ? `Send a new code in ${wait}s` : "Send a new code"}
            </button>
          </div>
          <button type="button" className="btn ghost" onClick={() => { setSent(false); setCode(""); setWait(0); show(""); }}>
            Use another email
          </button>
        </form>
      )}
      <p className={`status${isError ? " err" : ""}`} aria-live="polite">{status}</p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <>
      <header className="bar">
        <div className="wrap">
          <Brand />
        </div>
      </header>
      <main className="wrap">
        <LoginForm />
      </main>
    </>
  );
}
