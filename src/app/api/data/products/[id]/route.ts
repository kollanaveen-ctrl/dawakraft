// PATCH /api/data/products/:id { template }: switch a product's circular design.
import { fail, ok, parseBody, withUser } from "@/lib/api/respond";
import { d1 } from "@/lib/cloudflare/d1";
import { rowToProduct, updateTemplateSql } from "@/lib/db/products";
import { IdSchema, TemplatePatchSchema } from "@/lib/db/schemas";

const MAX_BODY_BYTES = 1_000;

export const PATCH = withUser<RouteContext<"/api/data/products/[id]">>("data/products/id", async (request, user, ctx) => {
  const id = IdSchema.safeParse((await ctx.params).id);
  if (!id.success) return fail("bad_request", 400);
  const body = await parseBody(request, TemplatePatchSchema, MAX_BODY_BYTES);
  if (!body.ok) return body.response;
  const { sql, params } = updateTemplateSql(user.userId, id.data, body.data.template, new Date().toISOString());
  const [row] = await d1().query<Record<string, unknown>>(sql, params);
  return row ? ok(rowToProduct(row)) : fail("not_found", 404);
});
