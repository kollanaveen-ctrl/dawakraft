# Landing showcase provenance

The landing preview uses the unretouched 1080 × 1920 PNG downloaded from the actual Dawakraft studio, not an HTML illustration or an image of a hypothetical interface.

## Source

`public/showcase/citriva-source.png` is an AI-generated fictional demonstration product, clearly labelled FICTIONAL DEMO PRODUCT. It is not a customer package or evidence of faithful reconstruction of a real medicine carton. Built-in image generation was used only to create this new demonstration input. Customer packaging must continue to use the uploaded source pixels.

Source prompt: Photorealistic single upright white pharmaceutical vitamin bottle on solid dark charcoal, complete visible edges and readable navy/orange label: CITRIVA C, Vitamin C 500 mg, 60 TABLETS, MRP ₹180, Manufactured by DEMO LABS, FICTIONAL DEMO PRODUCT. No surrounding flyer text or people.

## Actual run

1. Opened the isolated studio at localhost:3013/new and uploaded the source through the file chooser.
2. Real /api/read-box extracted CITRIVA C, Vitamin C 500 mg, 60 TABLETS, ₹180, DEMO LABS, Tablet and a usable bottle front. No API mocks were used.
3. Confirmed the visibly matching facts. The app removed the background locally and preserved the source bottle artwork.
4. Real /api/write-copy and /api/promo-photo generated draft wording and an outdoor running photograph for the vitamin context.
5. Removed unverified suggested indications. Retained the neutral ingredient-role bullet after checking NIH ODS vitamin C information (https://ods.od.nih.gov/factsheets/VitaminC-HealthProfessional/). Added Fictional demonstration · Not for sale. This is not approved medicine advertising or a dose recommendation.
6. The first actual export exposed a small product and oversized empty text panel. Fixed the Story renderer itself, keeping source imagery unfiltered, enlarging the product, grouping price and pack size, and tightening the supporting-copy area.
7. Downloaded the revised image using the studio's Download image button. Copied that exact PNG to `public/showcase/citriva-story.png` without editing its pixels. The original source is also linked visibly on the landing page.

This demonstration used browser-only isolated QA storage and did not insert demonstration products into the customer's Cloudflare catalog. The real app remains configured for Cloudflare D1/R2.
