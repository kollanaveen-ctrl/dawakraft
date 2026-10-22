// Server-only: a tiny client for Cloudflare D1 over its REST API (the app is hosted on Vercel,
// so it can't use a Worker binding). One HTTP request per call; `batch` sends many statements
// in one request. The API allows 1200 requests per 5 minutes per token, so keep calls few.
// Request/response shape: developers.cloudflare.com/api/resources/d1/subresources/database/methods/query/
import { d1Settings } from "../config";

/** D1 binds at most 100 parameters per statement. */
export const MAX_PARAMS = 100;
const TIMEOUT_MS = 10_000;
const RETRIES = 2;
const BACKOFF_MS = 300;

export type D1Value = string | number | null;
export type Statement = { sql: string; params?: D1Value[] };
export type D1Meta = { changes?: number; last_row_id?: number; rows_read?: number; rows_written?: number; duration?: number };
type QueryResult = { results?: unknown[]; meta?: D1Meta; success?: boolean };
type ApiResponse = { success?: boolean; errors?: { code?: number; message?: string }[]; result?: QueryResult[] };

/** "constraint" = a CHECK/UNIQUE/foreign key failed (bad data); "unavailable" = network, timeout or Cloudflare error. */
export type D1ErrorKind = "constraint" | "bad_query" | "unauthorized" | "unavailable";

export class D1Error extends Error {
  constructor(public readonly kind: D1ErrorKind, message: string, public readonly status = 0) {
    super(message);
    this.name = "D1Error";
  }
}

export type D1Options = {
  accountId: string;
  databaseId: string;
  token: string;
  fetch?: typeof fetch;
  /** Waits between retries; replaced in tests. */
  sleep?: (ms: number) => Promise<void>;
};

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function classify(status: number, message: string): D1ErrorKind {
  if (status === 401 || status === 403) return "unauthorized";
  if (/constraint failed|SQLITE_CONSTRAINT/i.test(message)) return "constraint";
  if (status >= 400 && status < 500) return "bad_query";
  return "unavailable";
}

const retryable = (status: number) => status === 429 || status >= 500;

export type D1Client = {
  query<T>(sql: string, params?: D1Value[]): Promise<T[]>;
  run(sql: string, params?: D1Value[]): Promise<D1Meta>;
  batch<T>(statements: Statement[]): Promise<T[][]>;
};

export function createD1(opts: D1Options): D1Client {
  const doFetch = opts.fetch ?? fetch;
  const sleep = opts.sleep ?? defaultSleep;
  const url = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(opts.accountId)}/d1/database/${encodeURIComponent(opts.databaseId)}/query`;

  async function once(body: string): Promise<{ status: number; json: ApiResponse | null }> {
    const res = await doFetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${opts.token}`, "Content-Type": "application/json" },
      body,
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    const json = (await res.json().catch(() => null)) as ApiResponse | null;
    return { status: res.status, json };
  }

  async function send(payload: Statement | { batch: Statement[] }): Promise<QueryResult[]> {
    const body = JSON.stringify(payload);
    for (let attempt = 0; ; attempt++) {
      let status = 0;
      let json: ApiResponse | null = null;
      try {
        ({ status, json } = await once(body));
      } catch {
        // Network failure or timeout: retry like a 5xx.
        status = 0;
      }
      const okStatus = status >= 200 && status < 300;
      if (okStatus && json?.success && Array.isArray(json.result)) {
        const failed = json.result.find((r) => r.success === false);
        if (!failed) return json.result;
        throw new D1Error("bad_query", "D1 statement failed", status);
      }
      if ((status === 0 || retryable(status)) && attempt < RETRIES) {
        await sleep(BACKOFF_MS * 2 ** attempt);
        continue;
      }
      // Error messages are SQLite's own text (no secrets or parameter values), safe to keep for logs.
      const message = json?.errors?.map((e) => `[${e.code ?? "?"}] ${e.message ?? ""}`).join("; ") || `HTTP ${status || "network error"}`;
      throw new D1Error(status === 0 ? "unavailable" : classify(status, message), message, status);
    }
  }

  return {
    async query<T>(sql: string, params: D1Value[] = []) {
      const [first] = await send({ sql, params });
      return (first?.results ?? []) as T[];
    },
    async run(sql: string, params: D1Value[] = []) {
      const [first] = await send({ sql, params });
      return first?.meta ?? {};
    },
    async batch<T>(statements: Statement[]) {
      if (!statements.length) return [];
      const results = await send({ batch: statements.map((s) => ({ sql: s.sql, params: s.params ?? [] })) });
      return results.map((r) => (r.results ?? []) as T[]);
    },
  };
}

/** Split rows so each INSERT binds at most MAX_PARAMS values (columnsPerRow values per row). */
export function chunkRows<T>(rows: T[], columnsPerRow: number, maxParams = MAX_PARAMS): T[][] {
  if (columnsPerRow < 1 || columnsPerRow > maxParams) throw new Error(`A row of ${columnsPerRow} values can't fit in ${maxParams} parameters`);
  const size = Math.floor(maxParams / columnsPerRow);
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size));
  return out;
}

/** "(?, ?, ?), (?, ?, ?)" for a multi-row INSERT. */
export function placeholders(rowCount: number, columnsPerRow: number): string {
  const one = `(${Array(columnsPerRow).fill("?").join(", ")})`;
  return Array(rowCount).fill(one).join(", ");
}

let shared: D1Client | null = null;

/** The app's D1 client from the environment. Throws when the settings are missing (routes check first). */
export function d1(): D1Client {
  if (shared) return shared;
  const settings = d1Settings();
  if (!settings) throw new D1Error("unavailable", "D1 is not configured");
  shared = createD1(settings);
  return shared;
}
