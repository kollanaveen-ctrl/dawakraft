import { describe, expect, it } from "vitest";
import { MAX_PARAMS } from "../cloudflare/d1";
import { MAX_UPLOAD_BYTES, mediaKey, ownsKey, pathAllowed, safeName } from "../cloudflare/media-keys";
import { objectUrl, presignGet, presignPut } from "../cloudflare/r2";
import { authSecret, cloudflareReady, d1Settings, r2Settings } from "../config";
import { getCompanySql, upsertCompanySql } from "../db/company";
import {
  PRODUCT_COLUMNS,
  deleteProductsSql,
  inputToProduct,
  insertProductsSql,
  listProductsSql,
  productValues,
  rowToProduct,
  updateTemplateSql,
  upsertProductSql,
} from "../db/products";
import { BulkProductsSchema, CompanyInputSchema, DeleteProductsSchema, ProductInputSchema, UploadUrlSchema } from "../db/schemas";
import { EMPTY_COMPANY } from "../data/mappers";
import { EMPTY_PROMO } from "../promo";
import type { Product } from "../types";

const OWNER = "11111111-1111-4111-8111-111111111111";

const product = (over: Partial<Product> = {}): Product => ({
  id: "p-1",
  name: "Amlodipine 5",
  composition: "Amlodipine 5 mg",
  uses: "Hypertension",
  form: "Tablet",
  packSize: "10 x 10",
  mrp: 45.5,
  schedule: "H",
  manufacturer: "Acme",
  marketedBy: "",
  storage: "",
  category: "Cardiac",
  scheme: "",
  highlight: "New launch",
  template: "clean",
  promo: { ...EMPTY_PROMO, headline: "Hi", photoPath: `${OWNER}/promo/p-1-ab.webp` },
  imagePath: `${OWNER}/products/p-1-cd.webp`,
  example: false,
  launchedAt: null,
  createdAt: "2026-10-22T10:00:00.000Z",
  updatedAt: "2026-10-22T10:00:00.000Z",
  ...over,
});

describe("owner scoping", () => {
  it("binds the session owner in every products statement", () => {
    expect(listProductsSql(OWNER)).toMatchObject({ params: [OWNER] });
    expect(listProductsSql(OWNER).sql).toMatch(/WHERE owner_id = \?/);
    expect(upsertProductSql(OWNER, product()).params?.[0]).toBe(OWNER);
    expect(upsertProductSql(OWNER, product()).sql).toContain("WHERE products.owner_id = excluded.owner_id");
    const patch = updateTemplateSql(OWNER, "p-1", "band", "2026-10-22T10:00:00.000Z");
    expect(patch.sql).toContain("owner_id = ? AND id = ?");
    expect(patch.params).toEqual(["band", "2026-10-22T10:00:00.000Z", OWNER, "p-1"]);
    for (const s of deleteProductsSql(OWNER, ["a", "b"])) {
      expect(s.sql).toMatch(/WHERE owner_id = \? AND id IN/);
      expect(s.params?.[0]).toBe(OWNER);
    }
    for (const s of insertProductsSql(OWNER, [product(), product({ id: "p-2" })])) {
      const params = s.params ?? [];
      for (let i = 0; i < params.length; i += PRODUCT_COLUMNS.length) expect(params[i]).toBe(OWNER);
    }
    expect(getCompanySql(OWNER)).toEqual({ sql: "SELECT * FROM companies WHERE owner_id = ?", params: [OWNER] });
    expect(upsertCompanySql(OWNER, EMPTY_COMPANY, "t").params?.[0]).toBe(OWNER);
  });

  it("an upsert never changes owner_id, id or created_at", () => {
    const set = upsertProductSql(OWNER, product()).sql.split("DO UPDATE SET")[1].split(" WHERE ")[0];
    expect(set).toContain("name = excluded.name");
    expect(set).not.toMatch(/owner_id =|\bid =|created_at =/);
  });

  it("ignores an owner id forged into the request body", () => {
    const parsed = ProductInputSchema.parse({ ...product(), owner_id: "attacker", ownerId: "attacker" });
    expect(parsed).not.toHaveProperty("owner_id");
    expect(parsed).not.toHaveProperty("ownerId");
    expect(productValues(OWNER, inputToProduct(parsed))[0]).toBe(OWNER);
    const company = CompanyInputSchema.parse({ ...EMPTY_COMPANY, owner_id: "attacker" });
    expect(company).not.toHaveProperty("owner_id");
  });

  it("keeps every statement within D1's 100 bound values", () => {
    const many = Array.from({ length: 37 }, (_, i) => product({ id: `p-${i}` }));
    const statements = insertProductsSql(OWNER, many);
    expect(statements.length).toBe(10);
    expect(statements.every((s) => (s.params?.length ?? 0) <= MAX_PARAMS)).toBe(true);
    expect(statements.reduce((n, s) => n + (s.params?.length ?? 0), 0)).toBe(37 * PRODUCT_COLUMNS.length);
    const ids = Array.from({ length: 250 }, (_, i) => `id-${i}`);
    const deletes = deleteProductsSql(OWNER, ids);
    expect(deletes.map((s) => s.params?.length)).toEqual([100, 100, 53]);
  });
});

describe("row mapping", () => {
  it("round-trips a product through D1 values (promo as JSON text, example as 0/1)", () => {
    const p = product();
    const values = productValues(OWNER, p);
    const raw = Object.fromEntries(PRODUCT_COLUMNS.map((c, i) => [c, values[i]]));
    expect(typeof raw.promo).toBe("string");
    expect(raw.example).toBe(0);
    expect(rowToProduct(raw)).toEqual(p);
  });

  it("survives broken promo JSON", () => {
    const values = productValues(OWNER, product());
    const raw = { ...Object.fromEntries(PRODUCT_COLUMNS.map((c, i) => [c, values[i]])), promo: "{not json" };
    expect(rowToProduct(raw).promo).toEqual(EMPTY_PROMO);
  });
});

describe("schemas", () => {
  it("accept a valid product and apply the database limits", () => {
    expect(ProductInputSchema.safeParse(product()).success).toBe(true);
    expect(ProductInputSchema.safeParse(product({ name: "" })).success).toBe(false);
    expect(ProductInputSchema.safeParse(product({ name: "x".repeat(201) })).success).toBe(false);
    expect(ProductInputSchema.safeParse(product({ uses: "x".repeat(141) })).success).toBe(false);
    expect(ProductInputSchema.safeParse(product({ mrp: -1 })).success).toBe(false);
    expect(ProductInputSchema.safeParse({ ...product(), template: "fancy" }).success).toBe(false);
    expect(ProductInputSchema.safeParse({ ...product(), schedule: "Q" }).success).toBe(false);
    expect(ProductInputSchema.safeParse({ ...product(), id: "../etc" }).success).toBe(false);
    expect(ProductInputSchema.safeParse({ ...product(), createdAt: "yesterday" }).success).toBe(false);
  });

  it("clean the promo with parsePromo", () => {
    const parsed = ProductInputSchema.parse({ ...product(), promo: { headline: "  Hello  ", junk: 1 } });
    expect(parsed.promo).toEqual({ ...EMPTY_PROMO, headline: "Hello" });
  });

  it("limit bulk, delete and upload requests", () => {
    expect(BulkProductsSchema.safeParse({ products: [] }).success).toBe(false);
    expect(DeleteProductsSchema.safeParse({ ids: [] }).success).toBe(false);
    expect(UploadUrlSchema.safeParse({ name: "logo", contentType: "image/gif", size: 10 }).success).toBe(false);
    expect(UploadUrlSchema.safeParse({ name: "logo", contentType: "image/webp", size: 10 }).success).toBe(true);
    expect(CompanyInputSchema.safeParse({ ...EMPTY_COMPANY, brandColor: "red" }).success).toBe(false);
  });
});

describe("media keys", () => {
  it("live under the user's folder with a safe name", () => {
    expect(mediaKey(OWNER, "products/p-1", "image/webp", "abc123")).toBe(`${OWNER}/products/p-1-abc123.webp`);
    expect(mediaKey(OWNER, "../../etc/passwd", "image/jpeg", "r")).toBe(`${OWNER}/etc/passwd-r.jpg`);
    expect(safeName("  ")).toBe("photo");
    expect(MAX_UPLOAD_BYTES).toBe(5 * 1024 * 1024);
  });

  it("are only reachable by their owner", () => {
    expect(ownsKey(OWNER, `${OWNER}/logo-1.png`)).toBe(true);
    expect(ownsKey(OWNER, `22222222-2222-4222-8222-222222222222/logo-1.png`)).toBe(false);
    expect(ownsKey(OWNER, `${OWNER}/../other/logo.png`)).toBe(false);
    expect(ownsKey(OWNER, `${OWNER}x/logo.png`)).toBe(false);
    expect(ownsKey(OWNER, `${OWNER}/`)).toBe(false);
    expect(ownsKey(OWNER, null)).toBe(false);
    expect(ownsKey("", "/logo.png")).toBe(false);
    expect(pathAllowed(OWNER, null)).toBe(true);
    expect(pathAllowed(OWNER, "other/logo.png")).toBe(false);
  });
});

describe("R2 presigned links", () => {
  const cfg = { accountId: "acc123", bucket: "dawakraft-media", accessKeyId: "AKIDTEST", secretAccessKey: "secret-test" };
  const datetime = "20261022T100000Z";

  it("PUT links target the bucket, expire in 5 minutes and sign the content type", async () => {
    const url = new URL(await presignPut(cfg, `${OWNER}/logo-1.png`, "image/png", { datetime }));
    expect(url.origin).toBe("https://acc123.r2.cloudflarestorage.com");
    expect(url.pathname).toBe(`/dawakraft-media/${OWNER}/logo-1.png`);
    expect(url.searchParams.get("X-Amz-Expires")).toBe("300");
    expect(url.searchParams.get("X-Amz-Algorithm")).toBe("AWS4-HMAC-SHA256");
    expect(url.searchParams.get("X-Amz-Credential")).toBe("AKIDTEST/20261022/auto/s3/aws4_request");
    expect(url.searchParams.get("X-Amz-Date")).toBe(datetime);
    expect(url.searchParams.get("X-Amz-SignedHeaders")).toBe("content-type;host");
    expect(url.searchParams.get("X-Amz-Signature")).toMatch(/^[0-9a-f]{64}$/);
    expect(url.toString()).not.toContain("secret-test");
  });

  it("GET links expire in 10 minutes and are deterministic for a fixed time", async () => {
    const a = await presignGet(cfg, `${OWNER}/logo-1.png`, { datetime });
    const b = await presignGet(cfg, `${OWNER}/logo-1.png`, { datetime });
    expect(a).toBe(b);
    expect(new URL(a).searchParams.get("X-Amz-Expires")).toBe("600");
    expect(new URL(a).searchParams.get("X-Amz-SignedHeaders")).toBe("host");
  });

  it("encode each key segment", () => {
    expect(objectUrl(cfg, "u/a b.png").pathname).toBe("/dawakraft-media/u/a%20b.png");
  });
});

describe("configuration", () => {
  const full = {
    NEXT_PUBLIC_DATA_BACKEND: "cloudflare",
    CLOUDFLARE_ACCOUNT_ID: "acc",
    CLOUDFLARE_D1_DATABASE_ID: "db",
    CLOUDFLARE_D1_API_TOKEN: "tok",
    AUTH_SECRET: "k".repeat(32),
  };

  it("is ready only with the switch on and real values", () => {
    expect(cloudflareReady(full)).toBe(true);
    expect(cloudflareReady({ ...full, NEXT_PUBLIC_DATA_BACKEND: "" })).toBe(false);
    expect(cloudflareReady({ ...full, CLOUDFLARE_D1_API_TOKEN: "your-token" })).toBe(false);
    expect(cloudflareReady({ ...full, AUTH_SECRET: "short" })).toBe(false);
    expect(d1Settings({ ...full, CLOUDFLARE_ACCOUNT_ID: "" })).toBeNull();
    expect(authSecret({ AUTH_SECRET: " " + "k".repeat(32) + " " })).toBe("k".repeat(32));
  });

  it("treats R2 as optional", () => {
    expect(r2Settings(full)).toBeNull();
    expect(r2Settings({ ...full, R2_BUCKET: "b", R2_ACCESS_KEY_ID: "id", R2_SECRET_ACCESS_KEY: "sk" })).toMatchObject({ bucket: "b" });
  });
});
