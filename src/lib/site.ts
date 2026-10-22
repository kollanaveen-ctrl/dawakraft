// Public site details used for SEO (canonical URLs, sitemap, social cards).

export const SITE_NAME = "Dawakraft";

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://dawakraft.vercel.app").replace(/\/$/, "");

export const SITE_TITLE = "Dawakraft — The pharma catalogue studio";

export const SITE_DESCRIPTION =
  "Turn medicine-box photos into branded trade circulars and a searchable product catalogue. AI-assisted label reading, human review, and WhatsApp sharing for India's pharma trade.";

/** App screens are private tools: never indexed. */
export const PRIVATE_PATHS = ["/catalog", "/new", "/product", "/company", "/import", "/login", "/auth", "/api"];
