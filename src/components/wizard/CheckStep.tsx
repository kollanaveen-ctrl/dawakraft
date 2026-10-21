"use client";
import type { Check } from "@/lib/types";

export function CheckStep({ checks }: { checks: Check[] }) {
  return (
    <div className="card stack">
      <div>
        <h2>Compliance check</h2>
        <p className="muted">Circulars stay factual and trade-only. Fix anything marked red before you continue.</p>
      </div>
      <ul className="checks">
        {checks.map((c) => (
          <li key={c.text} className={c.level}>
            <span className={`dot ${c.level}`} />
            <span>{c.text}</span>
          </li>
        ))}
      </ul>
      <p className="muted" style={{ fontSize: ".82rem" }}>
        This check covers common problems, not the full law. The licence holder stays responsible for the final content.
      </p>
    </div>
  );
}
