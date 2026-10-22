"use client";
// The online demo passcode form, shown when the AI says "not signed in" in demo mode.
// A correct passcode sets a 12-hour cookie (server side), then the parent retries the AI call once.
import { useId, useState, type FormEvent } from "react";
import "@/styles/ai.css";

type Props = { onUnlocked: () => void };

type State = { phase: "idle" | "busy" | "unlocked" | "off"; text: string; err: boolean };

const MESSAGES: Record<string, string> = {
  wrong_passcode: "That passcode isn't right.",
  rate_limited: "Too many tries. Wait 10 minutes.",
  bad_request: "Enter the demo passcode.",
};
const FALLBACK = "Couldn't check the passcode. Try again.";
export const UNLOCKED_MESSAGE = "Unlocked for 12 hours on this device.";

async function postPasscode(passcode: string): Promise<{ ok: boolean; error: string }> {
  const res = await fetch("/api/demo-unlock", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ passcode }),
  });
  const body = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
  return { ok: res.ok && body?.ok === true, error: body?.error ?? "" };
}

export function DemoUnlock({ onUnlocked }: Props) {
  const id = useId();
  const [passcode, setPasscode] = useState("");
  const [state, setState] = useState<State>({ phase: "idle", text: "", err: false });

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!passcode.trim()) return setState({ phase: "idle", text: MESSAGES.bad_request, err: true });
    setState({ phase: "busy", text: "Checking…", err: false });
    try {
      const { ok, error } = await postPasscode(passcode);
      if (ok) {
        setPasscode("");
        setState({ phase: "unlocked", text: UNLOCKED_MESSAGE, err: false });
        onUnlocked();
        return;
      }
      // Not set up on the server: hide the form and leave the original message as it is.
      if (error === "not_configured") return setState({ phase: "off", text: "", err: false });
      setState({ phase: "idle", text: MESSAGES[error] ?? FALLBACK, err: true });
    } catch {
      setState({ phase: "idle", text: FALLBACK, err: true });
    }
  }

  if (state.phase === "off") return null;
  const showForm = state.phase !== "unlocked";

  return (
    <div className="demo-unlock">
      {showForm && (
        <form className="demo-unlock-form" onSubmit={submit}>
          <label className="demo-unlock-label" htmlFor={id}>
            Demo passcode
          </label>
          <div className="demo-unlock-row">
            <input
              id={id}
              type="password"
              autoComplete="off"
              maxLength={100}
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              disabled={state.phase === "busy"}
            />
            <button className="btn primary" type="submit" disabled={state.phase === "busy"}>
              Unlock AI
            </button>
          </div>
        </form>
      )}
      <p className={`status${state.err ? " err" : ""}`} aria-live="polite">
        {state.text}
      </p>
    </div>
  );
}
