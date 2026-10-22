// POST /api/data/products/bulk { products }: insert many products (spreadsheet import) in one
// D1 request, split into statements of at most 100 bound values each.
import { fail, ok, parseBody, withUser } from "@/lib/api/respond";
import { d1 } from "@/lib/cloudflare/d1";
import { pathAllowed } from "@/lib/cloudflare/media-keys";
import { inputToProduct, insertProductsSql, rowToProduct } from "@/lib/db/products";
import { BulkProductsSchema } from "@/lib/db/schemas";

const MAX_BULK_BYTES = 2 * 1024 * 1024;

export const POST = withUser("data/products/bulk", async (request, user) => {
  const body = await parseBody(request, BulkProductsSchema, MAX_BULK_BYTES);
  if (!body.ok) return body.response;
  const list = body.data.products.map(inputToProduct);
  if (list.some((p) => !pathAllowed(user.userId, p.imagePath) || !pathAllowed(user.userId, p.promo.photoPath))) return fail("forbidden", 403);
  const rows = (await d1().batch<Record<string, unknown>>(insertProductsSql(user.userId, list))).flat();
  return ok(rows.map(rowToProduct));
});
