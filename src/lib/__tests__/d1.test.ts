import { describe, expect, it, vi } from "vitest";
import { MAX_PARAMS, chunkRows, createD1, D1Error, placeholders } from "../cloudflare/d1";

const OPTS = { accountId: "acc123", databaseId: "db456", token: "test-token" };
const URL_EXPECTED = "https://api.cloudflare.com/client/v4/accounts/acc123/d1/database/db456/query";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const okBody = (results: unknown[], meta = {}) => ({ success: true, errors: [], messages: [], result: [{ results, meta, success: true }] });

describe("D1 client", () => {
  it("POSTs { sql, params } with the bearer token and returns the rows", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(200, okBody([{ id: "p1" }])));
    const db = createD1({ ...OPTS, fetch: fetchMock as unknown as typeof fetch });

    const rows = await db.query<{ id: string }>("SELECT id FROM products WHERE owner_id = ?", ["u1"]);

    expect(rows).toEqual([{ id: "p1" }]);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(URL_EXPECTED);
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer test-token");
    expect(JSON.parse(String(init.body))).toEqual({ sql: "SELECT id FROM products WHERE owner_id = ?", params: ["u1"] });
  });

  it("run() returns the statement's meta", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(200, okBody([], { changes: 2, last_row_id: 9 })));
    const db = createD1({ ...OPTS, fetch: fetchMock as unknown as typeof fetch });
    expect(await db.run("UPDATE x SET y = 1")).toEqual({ changes: 2, last_row_id: 9 });
  });

  it("batch() sends { batch: [...] } in one request and returns each statement's rows", async () => {
    const body = { success: true, errors: [], result: [{ results: [], success: true }, { results: [{ n: 3 }], success: true }] };
    const fetchMock = vi.fn(async () => jsonResponse(200, body));
    const db = createD1({ ...OPTS, fetch: fetchMock as unknown as typeof fetch });

    const out = await db.batch([{ sql: "INSERT INTO t VALUES (?)", params: [1] }, { sql: "SELECT COUNT(*) AS n FROM t" }]);

    expect(out).toEqual([[], [{ n: 3 }]]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const sent = JSON.parse(String((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body));
    expect(sent).toEqual({ batch: [{ sql: "INSERT INTO t VALUES (?)", params: [1] }, { sql: "SELECT COUNT(*) AS n FROM t", params: [] }] });
  });

  it("batch() of nothing makes no request", async () => {
    const fetchMock = vi.fn();
    const db = createD1({ ...OPTS, fetch: fetchMock as unknown as typeof fetch });
    expect(await db.batch([])).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("retries 429 and 5xx twice with backoff, then succeeds", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(429, { success: false, errors: [{ code: 10000, message: "rate limited" }] }))
      .mockResolvedValueOnce(jsonResponse(503, { success: false, errors: [] }))
      .mockResolvedValueOnce(jsonResponse(200, okBody([{ ok: 1 }])));
    const sleep = vi.fn(async () => undefined);
    const db = createD1({ ...OPTS, fetch: fetchMock as unknown as typeof fetch, sleep });

    expect(await db.query("SELECT 1 AS ok")).toEqual([{ ok: 1 }]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(sleep.mock.calls.map((c) => (c as unknown as [number])[0])).toEqual([300, 600]);
  });

  it("gives up after two retries with an 'unavailable' error", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(500, { success: false, errors: [{ code: 7500, message: "internal" }] }));
    const db = createD1({ ...OPTS, fetch: fetchMock as unknown as typeof fetch, sleep: async () => undefined });
    await expect(db.query("SELECT 1")).rejects.toMatchObject({ kind: "unavailable", status: 500 });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("retries network failures and timeouts", async () => {
    const fetchMock = vi.fn().mockRejectedValueOnce(new TypeError("fetch failed")).mockResolvedValueOnce(jsonResponse(200, okBody([])));
    const db = createD1({ ...OPTS, fetch: fetchMock as unknown as typeof fetch, sleep: async () => undefined });
    expect(await db.query("SELECT 1")).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry a constraint failure and labels it", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(400, { success: false, errors: [{ code: 7500, message: "CHECK constraint failed: length(name) BETWEEN 1 AND 200: SQLITE_CONSTRAINT" }] }),
    );
    const db = createD1({ ...OPTS, fetch: fetchMock as unknown as typeof fetch, sleep: async () => undefined });
    const err = await db.run("INSERT ...").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(D1Error);
    expect(err).toMatchObject({ kind: "constraint", status: 400 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("labels syntax errors as bad_query and auth failures as unauthorized", async () => {
    const syntax = createD1({ ...OPTS, fetch: (async () => jsonResponse(400, { success: false, errors: [{ code: 7500, message: "near \"x\": syntax error" }] })) as unknown as typeof fetch });
    await expect(syntax.query("SELEC x")).rejects.toMatchObject({ kind: "bad_query" });
    const auth = createD1({ ...OPTS, fetch: (async () => jsonResponse(403, { success: false, errors: [{ code: 10000, message: "Authentication error" }] })) as unknown as typeof fetch });
    await expect(auth.query("SELECT 1")).rejects.toMatchObject({ kind: "unauthorized" });
  });

  it("never puts the token in an error message", async () => {
    const db = createD1({ ...OPTS, fetch: (async () => jsonResponse(401, { success: false, errors: [] })) as unknown as typeof fetch });
    const err = (await db.query("SELECT 1").catch((e: unknown) => e)) as Error;
    expect(err.message).not.toContain("test-token");
  });

  it("treats a failed statement inside a successful response as an error", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(200, { success: true, errors: [], result: [{ results: [], success: false }] }));
    const db = createD1({ ...OPTS, fetch: fetchMock as unknown as typeof fetch });
    await expect(db.query("SELECT 1")).rejects.toMatchObject({ kind: "bad_query" });
  });
});

describe("parameter chunking", () => {
  it("keeps every chunk within 100 bound values", () => {
    const rows = Array.from({ length: 23 }, (_, i) => i);
    const chunks = chunkRows(rows, 22);
    expect(chunks.map((c) => c.length)).toEqual([4, 4, 4, 4, 4, 3]);
    expect(chunks.every((c) => c.length * 22 <= MAX_PARAMS)).toBe(true);
    expect(chunks.flat()).toEqual(rows);
  });

  it("splits single values into chunks of the given size", () => {
    expect(chunkRows([1, 2, 3, 4, 5], 1, 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunkRows([], 5)).toEqual([]);
  });

  it("refuses rows wider than the limit", () => {
    expect(() => chunkRows([1], 101)).toThrow();
    expect(() => chunkRows([1], 0)).toThrow();
  });

  it("builds multi-row placeholders", () => {
    expect(placeholders(2, 3)).toBe("(?, ?, ?), (?, ?, ?)");
  });
});
