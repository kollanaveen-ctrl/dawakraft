# Architecture decision records

Short notes on the decisions that shape Dawakraft: what we chose, what else we considered, and what it costs us. Add a new numbered file when a decision changes; mark the old one "Superseded by ..." rather than deleting it.

| # | Decision | Status |
|---|---|---|
| [0001](0001-nextjs-supabase.md) | Next.js App Router + Supabase | Accepted; Supabase part superseded by 0007 |
| [0002](0002-demo-mode-browser-storage.md) | Demo mode in browser storage when Supabase isn't configured | Accepted (the switch is now `NEXT_PUBLIC_DATA_BACKEND`, see 0007) |
| [0003](0003-provider-independent-ai.md) | Provider-independent AI layer with a labelled mock | Accepted |
| [0004](0004-on-device-pack-shots.md) | On-device 3D pack shots from user-placed corners, never AI-generated images | Accepted, partly superseded by 0006 |
| [0005](0005-public-landing-and-catalog-route.md) | Public landing page at `/`, the app at `/catalog` | Accepted |
| [0006](0006-automatic-straightening-and-catalogue-product-picture.md) | Automatic straightening with a size check, the left end as in the catalogue, the real strip/bottle/tube photo composited in front | Accepted |
| [0007](0007-cloudflare-d1-r2-on-vercel.md) | Cloudflare D1 + R2 over their APIs and email-code sign-in, Vercel stays the host | Accepted |
