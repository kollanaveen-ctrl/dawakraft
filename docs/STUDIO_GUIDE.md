# Dawakraft: original packaging, WhatsApp Story

Run `npm run studio` from the app folder, then open http://127.0.0.1:3012/new. Keep the terminal open. This local mode uses the existing server-side AI connection and stores editable products/photos in this browser. Download your flyers as backups; clearing browser data removes local saved work.

## Make a flyer

1. Upload up to four original photos together. For a 3D carton, include the front, narrow side and top, plus an optional label/strip photo. Use a plain contrasting surface, sharp focus, good lighting, and visible edges. A finished flyer screenshot is not a suitable source.
2. Check all photos with AI. The reader identifies the views and extracts printed facts. It requests missing views, composition, strength, manufacturer, MRP and pack size. Mixed products are blocked. Manual view corrections cannot override a failed quality check.
3. Confirm the printed details. Choose **Prepare original product image**. The app straightens and places the actual photographed faces locally. It does not redraw, recolour, add text, invent side panels or generate missing artwork. Perspective resampling and an external ground shadow are used. Review the result against the carton.
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

This mode has not deployed the public website. The local configuration includes D1 settings and an R2 bucket name but lacks R2 access/secret credentials. Cloud persistence and the deployed environment remain unverified. Never send keys in chat.
