// /api/data/products — the signed-in user's catalog.
//   GET     list, newest first
//   POST    save one product (insert or update)
//   DELETE  { ids } remove products and their photos
// The owner always comes from the session; an owner id in the body is ignored.
import { fail, ok, parseBody, withUser } from "@/lib/api/respond";
import { removeOwnedMedia } from "@/lib/api/media-cleanup";
import { d1 } from "@/lib/cloudflare/d1";
import { pathAllowed } from "@/lib/cloudflare/media-keys";
import { deleteProductsSql, inputToProduct, listProductsSql, rowToProduct, upsertProductSql } from "@/lib/db/products";
import { DeleteProductsSchema, ProductInputSchema } from "@/lib/db/schemas";

const MAX_PRODUCT_BYTES = 64 * 1024;
const MAX_DELETE_BYTES = 64 * 1024;

export const GET = withUser("data/products", async (_request, user) => {
  const { sql, params } = listProductsSql(user.userId);
  const rows = await d1().query<Record<string, unknown>>(sql, params);
  return ok(rows.map(rowToProduct));
});

export const POST = withUser("data/products", async (request, user) => {
  const body = await parseBody(request, ProductInputSchema, MAX_PRODUCT_BYTES);
  if (!body.ok) return body.response;
  const product = { ...inputToProduct(body.data), updatedAt: new Date().toISOString() };
  if (!pathAllowed(user.userId, product.imagePath) || !pathAllowed(user.userId, product.promo.photoPath)) return fail("forbidden", 403);
  const { sql, params } = upsertProductSql(user.userId, product);
  const [row] = await d1().query<Record<string, unknown>>(sql, params);
  // No row back means the id belongs to someone else's product.
  return row ? ok(rowToProduct(row)) : fail("not_found", 404);
});

export const DELETE = withUser("data/products", async (request, user) => {
  const body = await parseBody(request, DeleteProductsSchema, MAX_DELETE_BYTES);
  if (!body.ok) return body.response;
  const removed = (await d1().batch<{ image_path: string | null; photo_path: string | null }>(deleteProductsSql(user.userId, body.data.ids))).flat();
  await removeOwnedMedia(user.userId, removed.flatMap((r) => [r.image_path, r.photo_path]), "data/products");
  return ok({ deleted: removed.length });
});
