# Dawakraft: original packaging, WhatsApp Story

Run `npm run studio` from the app folder, then open http://127.0.0.1:3012/new. Keep the terminal open and sign in with the existing passcode. This now uses Cloudflare D1 for products and R2 for photos, with the same account settings as the live app. R2 credentials and bucket CORS must be configured before photos can be saved. Existing browser-only drafts are not automatically migrated or deleted.

## Make a flyer

1. Upload up to four original photos together. One clear front photo is sufficient. Side, top, label and matching strip photos are optional. Use a plain contrasting surface, sharp focus, good lighting, and visible edges. A finished flyer screenshot is not a suitable source.
2. Check all photos with AI. The reader identifies the views and extracts printed facts. It requests a missing readable front and missing composition, strength, manufacturer, MRP, pack size or dosage form. Mixed products are blocked. Manual view corrections cannot override a failed quality check.
3. Confirm the printed details. Choose **Prepare original product image**. The app isolates the actual original photo locally and preserves the photographed shape. When suitable front, side and top views are all supplied, it can assemble those actual faces. It does not redraw, recolour, add text, invent side panels or generate missing artwork. Perspective resampling and an external ground shadow are used. Review the result against the carton.
4. For unsuitable images, the popup says exactly: **The image you have uploaded doesn't support flyer generation.** Replace the affected photo and check the batch again. Minimum resolution is one screening rule, not a guarantee of quality; AI readability and local edge/isolation checks also apply.
5. Choose **Use this image & create flyer**. AI writes combination-specific ingredient roles and drafts suggested uses separately from approved indications. Vague formulations must not be assigned disease uses. Check suggestions against the product leaflet before sharing. The AI also proposes a relevant supporting visual and sends the composition and visual concept to the image service. Packaging is never sent to the image-generation endpoint.
6. **WhatsApp Story · 9:16** is the default: PNG 1080 × 1920 and portrait PDF. Landscape remains an optional format. Generate another supporting image or upload your own; verify its crop. Edit wording and keep Story supporting copy below 600 characters for readability.
7. Review the artwork and wording, then download, share or save. Desktop browsers without file-sharing support download the PNG for manual attachment in WhatsApp. Saved studio designs reopen in the studio. Editing invalidates final review.

## AI connection

The app uses OpenRouter Chat Completions, restricted to Google endpoints. Defaults are `google/gemini-3.7-flash` for label reading and copywriting, and `google/gemini-3.1-flash-image` for supporting visuals. Keys remain server-side. No extra connector or design plugin is needed. `/api/product-shot` is retired and returns HTTP 410 without contacting an AI provider.

Earlier Sparkind AI packshot previews changed the packaging and must not be treated as faithful source artwork. They are historical review artifacts, not the new workflow. Use original full-resolution carton-face photographs to evaluate real-product fidelity.

## Verification and limits

Latest checks: 254 unit tests passed, TypeScript and lint passed, production build passed, and the browser flow passed. Live OpenRouter label reading, combination-copy suggestions/visual brief, and a vertical supporting image succeeded with the fictional test product.

Automated browser checks use a fictional pack: single batch upload, unordered view mapping, unsuitable-photo popup, mixed-product blocking, missing-MRP gating, original-face assembly, zero calls to package generation, Story PNG dimensions, PDF download, local save/reopen, approval gating and 390 px mobile overflow. These are functional checks, not proof that every phone photo will work.

Real OpenRouter checks use fictional product information only. AI-suggested uses require leaflet review; generated context images still need visual inspection. Physical phone WhatsApp sharing and real-product fidelity require testing with suitable original photos.

The public studio is deployed at https://dawakraft.vercel.app/new. Cloudflare mode is enabled locally too. Photo storage requires `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY`; keep these in the private environment settings, never in chat or Git. Functional QA that needs browser-only storage must explicitly set `STUDIO_DATA_BACKEND=demo` before running the local studio.
