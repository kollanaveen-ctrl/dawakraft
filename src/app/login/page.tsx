"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { Brand } from "@/components/AppBar";
import { supabaseBrowser } from "@/lib/supabase/client";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(
    params.get("error") === "link" ? "That link has expired or was opened in another browser. Type the code from the email instead, or send a new one." : "",
  );
  const [isError, setIsError] = useState(params.get("error") === "link");

  function show(text: string, err = false) {
    setStatus(text);
    setIsError(err);
  }

  async function sendLink(e: FormEvent) {
    e.preventDefault();
    const clean = email.trim().toLowerCase();
    if (!EMAIL_RE.test(clean)) return show("Enter a valid email address.", true);
    setBusy(true);
    const { error } = await supabaseBrowser().auth.signInWithOtp({
      email: clean,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setBusy(false);
    if (error) return show("Couldn't send the email. Wait a minute and try again.", true);
    setSent(true);
    show(`We sent a sign-in email to ${clean}. Tap the link in it, or type the code here.`);
  }

  async function verify(e: FormEvent) {
    e.preventDefault();
    const token = code.replace(/\D/g, "");
    if (token.length < 6) return show("Type the code from the email.", true);
    setBusy(true);
    const { error } = await supabaseBrowser().auth.verifyOtp({ email: email.trim().toLowerCase(), token, type: "email" });
    setBusy(false);
    if (error) return show("That code didn't work. Check it, or send a new email.", true);
    router.replace("/");
    router.refresh();
  }

  return (
    <div className="card stack" style={{ maxWidth: 440, margin: "40px auto 0" }}>
      <div>
        <p className="mono muted">Sign in</p>
        <h1>Your product catalog</h1>
        <p className="muted" style={{ marginTop: 6 }}>
          Use your work email. No password: we email you a sign-in link and code.
        </p>
      </div>
      {!sent ? (
        <form className="stack" onSubmit={sendLink}>
          <label className="field" htmlFor="email">
            Email
            <input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <button className="btn primary" disabled={busy}>
            {busy ? "Sending…" : "Email me a sign-in link"}
          </button>
        </form>
      ) : (
        <form className="stack" onSubmit={verify}>
          <label className="field" htmlFor="code">
            Code from the email
            <input id="code" type="text" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} />
          </label>
          <div className="row">
            <button className="btn primary" disabled={busy}>
              {busy ? "Checking…" : "Sign in"}
            </button>
            <button type="button" className="btn ghost" onClick={() => { setSent(false); setCode(""); show(""); }}>
              Use another email
            </button>
          </div>
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
        <Suspense>
          <LoginForm />
        </Suspense>
      </main>
    </>
  );
}
