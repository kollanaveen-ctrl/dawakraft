// Server-only: short-lived signed links to the private R2 photo bucket, over R2's S3 API.
// The browser uploads and downloads directly with these links, so photos never pass
// through Vercel. Objects are never public; each link works for a few minutes only.
import { AwsClient } from "aws4fetch";
import { r2Settings } from "../config";
import type { UploadType } from "./media-keys";

export const PUT_TTL_SECONDS = 5 * 60;
export const GET_TTL_SECONDS = 10 * 60;

export type R2Config = { accountId: string; bucket: string; accessKeyId: string; secretAccessKey: string };
type SignOptions = { datetime?: string; fetch?: typeof fetch };

function client(cfg: R2Config): AwsClient {
  return new AwsClient({ accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey, service: "s3", region: "auto" });
}

/** https://<account>.r2.cloudflarestorage.com/<bucket>/<key>, each key segment encoded. */
export function objectUrl(cfg: R2Config, key: string): URL {
  const path = key.split("/").map(encodeURIComponent).join("/");
  return new URL(`https://${cfg.accountId}.r2.cloudflarestorage.com/${encodeURIComponent(cfg.bucket)}/${path}`);
}

async function presign(cfg: R2Config, key: string, method: "GET" | "PUT", ttl: number, headers: Record<string, string>, opts: SignOptions) {
  const url = objectUrl(cfg, key);
  url.searchParams.set("X-Amz-Expires", String(ttl));
  const signed = await client(cfg).sign(url.toString(), {
    method,
    headers,
    // Sign the listed headers too (content-type), so the upload must use the type we checked.
    aws: { signQuery: true, allHeaders: true, ...(opts.datetime ? { datetime: opts.datetime } : {}) },
  });
  return signed.url;
}

/** A PUT link for one upload; the browser must send exactly this Content-Type. */
export function presignPut(cfg: R2Config, key: string, contentType: UploadType, opts: SignOptions = {}): Promise<string> {
  return presign(cfg, key, "PUT", PUT_TTL_SECONDS, { "content-type": contentType }, opts);
}

export function presignGet(cfg: R2Config, key: string, opts: SignOptions = {}): Promise<string> {
  return presign(cfg, key, "GET", GET_TTL_SECONDS, {}, opts);
}

/** Delete objects one by one (a handful at a time); missing objects count as deleted. Returns how many failed. */
export async function deleteObjects(cfg: R2Config, keys: string[], opts: SignOptions = {}): Promise<number> {
  const aws = client(cfg);
  const doFetch = opts.fetch ?? fetch;
  const results = await Promise.all(
    keys.map(async (key) => {
      try {
        const signed = await aws.sign(objectUrl(cfg, key).toString(), { method: "DELETE" });
        const res = await doFetch(signed, { signal: AbortSignal.timeout(10_000) });
        return res.ok || res.status === 404;
      } catch {
        return false;
      }
    }),
  );
  return results.filter((ok) => !ok).length;
}

/** R2 settings from the environment, or null while R2 isn't set up. */
export function r2(): R2Config | null {
  return r2Settings();
}
