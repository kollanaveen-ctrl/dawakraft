// Is the app connected to its real backend (Cloudflare D1 + R2), or running as a demo?
// Without NEXT_PUBLIC_DATA_BACKEND=cloudflare the app runs in demo mode: everything is saved in this browser only.

/** True when a setting holds a real value, not empty and not a "your-…" placeholder. */
export function isRealValue(v: string | undefined): v is string {
  if (!v) return false;
  const s = v.trim();
  return s.length > 0 && !/your-|your_|example|placeholder|xxxx/i.test(s);
}

// NEXT_PUBLIC_ values are copied into the browser code at build time, so this works on both sides.
// It is a plain switch, not a secret: the keys themselves stay on the server.
export const dataBackend = (process.env.NEXT_PUBLIC_DATA_BACKEND ?? "").trim().toLowerCase();

export const realMode = dataBackend === "cloudflare";
export const demoMode = !realMode;

type Env = Record<string, string | undefined>;

/** Server only: the D1 database settings, or null when any is missing. */
export function d1Settings(env: Env = process.env): { accountId: string; databaseId: string; token: string } | null {
  const { CLOUDFLARE_ACCOUNT_ID: accountId, CLOUDFLARE_D1_DATABASE_ID: databaseId, CLOUDFLARE_D1_API_TOKEN: token } = env;
  if (!isRealValue(accountId) || !isRealValue(databaseId) || !isRealValue(token)) return null;
  return { accountId: accountId.trim(), databaseId: databaseId.trim(), token: token.trim() };
}

/** Server only: the secret for sign-in codes, or null. Never log it. */
export function authSecret(env: Env = process.env): string | null {
  const s = env.AUTH_SECRET;
  return isRealValue(s) && s.trim().length >= 32 ? s.trim() : null;
}

/** Server only: real mode is switched on AND the database and sign-in secrets are filled in. */
export function cloudflareReady(env: Env = process.env): boolean {
  return (env.NEXT_PUBLIC_DATA_BACKEND ?? "").trim().toLowerCase() === "cloudflare" && Boolean(d1Settings(env)) && Boolean(authSecret(env));
}

/** Server only: the R2 photo storage settings, or null (R2 is optional until it is enabled on the account). */
export function r2Settings(env: Env = process.env): { accountId: string; bucket: string; accessKeyId: string; secretAccessKey: string } | null {
  const { CLOUDFLARE_ACCOUNT_ID: accountId, R2_BUCKET: bucket, R2_ACCESS_KEY_ID: accessKeyId, R2_SECRET_ACCESS_KEY: secretAccessKey } = env;
  if (!isRealValue(accountId) || !isRealValue(bucket) || !isRealValue(accessKeyId) || !isRealValue(secretAccessKey)) return null;
  return { accountId: accountId.trim(), bucket: bucket.trim(), accessKeyId: accessKeyId.trim(), secretAccessKey: secretAccessKey.trim() };
}

/** Server only: is the Claude key filled in? */
export function claudeConfigured(): boolean {
  return isRealValue(process.env.ANTHROPIC_API_KEY);
}

/** In demo mode there is no sign-in, so AI is only allowed on your own computer, never on a public site. */
export function demoAiAllowed(): boolean {
  return demoMode && process.env.NODE_ENV !== "production";
}
