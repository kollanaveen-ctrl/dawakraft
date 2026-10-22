// /api/data/company — the signed-in user's company profile (name, contact, logo, brand colour).
//   GET  the profile, or empty fields before the first save
//   PUT  save it
import { fail, ok, parseBody, withUser } from "@/lib/api/respond";
import { d1 } from "@/lib/cloudflare/d1";
import { pathAllowed } from "@/lib/cloudflare/media-keys";
import { getCompanySql, upsertCompanySql } from "@/lib/db/company";
import { CompanyInputSchema } from "@/lib/db/schemas";
import { toCompany, type CompanyRow } from "@/lib/data/mappers";

const MAX_BODY_BYTES = 8 * 1024;

export const GET = withUser("data/company", async (_request, user) => {
  const { sql, params } = getCompanySql(user.userId);
  const [row] = await d1().query<CompanyRow>(sql, params);
  return ok(toCompany(row ?? null));
});

export const PUT = withUser("data/company", async (request, user) => {
  const body = await parseBody(request, CompanyInputSchema, MAX_BODY_BYTES);
  if (!body.ok) return body.response;
  if (!pathAllowed(user.userId, body.data.logoPath)) return fail("forbidden", 403);
  const { sql, params } = upsertCompanySql(user.userId, body.data, new Date().toISOString());
  const [row] = await d1().query<CompanyRow>(sql, params);
  return ok(toCompany(row ?? null));
});
