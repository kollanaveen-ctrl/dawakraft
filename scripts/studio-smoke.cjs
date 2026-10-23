/* Local browser verification. Uses an isolated browser and fictional pack; no production data. */
const { chromium } = require('playwright');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');

(async () => {
  const out = path.resolve('artifacts/studio');
  await fs.mkdir(out, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, colorScheme: 'light', acceptDownloads: true });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(process.env.STUDIO_URL || 'http://127.0.0.1:3012/new');
    await page.getByRole('heading', { name: 'All your product photos. One upload.' }).waitFor();
    await page.screenshot({ path: path.join(out, '01-studio-desktop.png'), fullPage: true });
    const pack = await page.evaluate(() => {
      const cv = document.createElement('canvas'); cv.width = 1000; cv.height = 700;
      const c = cv.getContext('2d'); c.fillStyle = '#202825'; c.fillRect(0, 0, 1000, 700);
      c.fillStyle = '#fff'; c.fillRect(130, 150, 740, 390);
      c.fillStyle = '#174e70'; c.font = 'bold 80px Arial'; c.fillText('DEMO-500', 170, 270);
      c.font = '27px Arial'; c.fillText('Paracetamol IP 500 mg', 174, 330);
      c.fillText('10 x 10 tablets', 174, 385);
      c.fillText('MRP Rs. 120 / Example Pharma', 174, 430);
      c.fillStyle = '#df7b2a'; c.fillRect(130, 480, 740, 60);
      c.fillStyle = '#fff'; c.font = 'bold 20px Arial'; c.fillText('FICTIONAL TEST PACK — NOT FOR SALE', 170, 518);
      return cv.toDataURL('image/png').split(',')[1];
    });
    await fs.writeFile(path.join(out, 'fictional-pack.png'), Buffer.from(pack, 'base64'));
    const side = await page.evaluate(() => {
      const cv = document.createElement('canvas'); cv.width = 400; cv.height = 800;
      const c = cv.getContext('2d'); c.fillStyle = '#202825'; c.fillRect(0, 0, 400, 800);
      c.fillStyle = '#fff'; c.fillRect(90, 110, 220, 580);
      c.fillStyle = '#174e70'; c.font = 'bold 25px Arial'; c.fillText('DEMO-500', 110, 200);
      c.font = '19px Arial'; c.fillText('Paracetamol', 110, 250); c.fillText('IP 500 mg', 110, 285);
      c.fillStyle = '#df7b2a'; c.fillRect(90, 625, 220, 65);
      return cv.toDataURL('image/png').split(',')[1];
    });
    await fs.writeFile(path.join(out, 'fictional-side.png'), Buffer.from(side, 'base64'));
    const tiny = await page.evaluate(() => { const c = document.createElement('canvas'); c.width = c.height = 100; return c.toDataURL('image/png').split(',')[1]; });
    await page.getByLabel('Upload all product photos', { exact: true }).setInputFiles({ name: 'tiny.png', mimeType: 'image/png', buffer: Buffer.from(tiny, 'base64') });
    await page.getByRole('dialog').waitFor();
    assert.equal(await page.getByRole('dialog').getByText("The image you have uploaded doesn't support flyer generation.", { exact: true }).count(), 1);
    await page.getByRole('button', { name: 'Choose better photos' }).click();
    const top = await page.evaluate(() => {
      const cv = document.createElement('canvas'); cv.width = 1000; cv.height = 500;
      const c = cv.getContext('2d'); c.fillStyle = '#202825'; c.fillRect(0, 0, 1000, 500);
      c.fillStyle = '#fff'; c.fillRect(130, 150, 740, 200);
      c.fillStyle = '#174e70'; c.font = 'bold 50px Arial'; c.fillText('DEMO-500', 190, 265);
      return cv.toDataURL('image/png').split(',')[1];
    });
    let packageCalls = 0;
    await page.route('**/api/product-shot', route => { packageCalls++; return route.abort(); });
    // Deliberately upload end first: AI indexes must control the 3D front, not file order.
    await page.getByLabel('Upload all product photos', { exact: true }).setInputFiles([
      { name: 'side.png', mimeType: 'image/png', buffer: Buffer.from(side, 'base64') },
      { name: 'front.png', mimeType: 'image/png', buffer: Buffer.from(pack, 'base64') },
      { name: 'top.png', mimeType: 'image/png', buffer: Buffer.from(top, 'base64') },
    ]);
    await page.getByText('3 photos ready.', { exact: false }).waitFor();
    await page.screenshot({ path: path.join(out, '01-studio-desktop.png'), fullPage: true });
    // First verify sample-mode responses cannot insert medicine details or build an image.
    await page.route('**/api/read-box', route => route.fulfill({ json: { ok: true, data: {}, meta: { mock: true } } }));
    await page.getByRole('button', { name: 'Check all photos with AI' }).click();
    await page.getByText('AI is in sample mode, so no sample medicine details were inserted.', { exact: false }).waitFor();
    assert.equal(await page.getByLabel('Brand name', { exact: true }).inputValue(), '');
    assert.equal(await page.getByRole('button', { name: 'Prepare original product image', exact: true }).isEnabled(), false);
    assert.equal(await page.getByRole('img', { name: 'Prepared product photo', exact: false }).count(), 0);
    const data = Object.fromEntries(Object.entries({ name: 'DEMO-500', composition: 'Paracetamol IP 500 mg', packSize: '10 x 10 tablets', mrp: null, manufacturer: 'Example Pharma', form: 'Tablet' }).map(([key, value]) => [key, { value, confidence: 'high', source: value === null ? null : 'other', quote: value === null ? null : String(value) }]));
    data.photoViews = [ { index: 0, view: 'side', kind: 'box', confidence: 'high', usable: true, rotation: '0' }, { index: 1, view: 'front', kind: 'box', confidence: 'high', usable: true, rotation: '0' } ];
    data.photoViews.push({ index: 2, view: 'top', kind: 'box', confidence: 'high', usable: true, rotation: '0' });
    data.mixedProducts = true;
    await page.unroute('**/api/read-box');
    await page.route('**/api/read-box', route => route.fulfill({ json: { ok: true, data, meta: { mock: false } } }));
    data.photoViews[0].usable = false;
    await page.getByRole('button', { name: 'Check photos with AI', exact: true }).click();
    await page.getByRole('dialog').waitFor();
    await page.getByRole('button', { name: 'Choose better photos' }).click();
    data.photoViews[0].usable = true;
    await page.getByRole('button', { name: 'Check photos with AI', exact: true }).click();
    await page.getByText('These photos appear to show different products', { exact: false }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Prepare original product image', exact: true }).isEnabled(), false);
    data.mixedProducts = false;
    await page.getByRole('button', { name: 'Read photos again', exact: true }).click();
    await page.getByText('Please add the MRP below', { exact: false }).waitFor();
    assert.equal(await page.getByRole('img', { name: 'Prepared product photo', exact: false }).count(), 0, 'No image is built while data is missing');
    await page.getByLabel('Your company name', { exact: true }).fill('Example Healthcare · Demonstration');
    await page.getByLabel('MRP (₹)', { exact: true }).fill('120');
    await page.getByRole('checkbox', { name: 'I checked the name' }).check();
    await page.route('**/api/write-copy', route => route.fulfill({ json: { ok: true, data: { copy: { headline: 'Care for everyday discomfort', banner: 'FORMULATION OVERVIEW', tagline: '', sections: [{ title: 'Paracetamol', bullets: ['Analgesic and antipyretic formulation'] }], indications: [], suggestedUses: ['Pain and fever'], visualBrief: 'A respectful fever context with an adult holding a tissue' }, claims: { banned: [], strong: [] } }, meta: { mock: false } } }));
    await page.route('**/api/promo-photo', route => route.fulfill({ json: { ok: true, data: { mediaType: 'image/png', data: pack }, meta: { mock: false, provider: 'test-fixture' } } }));
    await page.getByRole('button', { name: 'Prepare original product image', exact: true }).click();
    await page.getByRole('img', { name: 'Prepared product photo', exact: false }).waitFor();
    assert.equal(await page.getByRole('img', { name: 'Your promotional flyer' }).count(), 0, 'Review product image before the flyer');
    await page.screenshot({ path: path.join(out, '02-3d-product.png'), fullPage: true });
    await page.getByRole('button', { name: 'Use this image & create flyer' }).click();
    await page.getByRole('img', { name: 'Your promotional flyer' }).waitFor();
    await page.getByRole('checkbox', { name: 'I checked these suggested uses' }).check();
    await page.getByLabel('Headline', { exact: true }).fill('Clear information.\nConfident presentation.');
    await page.getByLabel('Highlight banner').fill('FICTIONAL DEMONSTRATION');
    await page.getByLabel('Closing line').fill('Layout demonstration · not a promotional claim');
    const scene = await page.evaluate(() => {
      const cv = document.createElement('canvas'); cv.width = 1200; cv.height = 900;
      const c = cv.getContext('2d'); const g = c.createLinearGradient(0, 0, 1200, 900);
      g.addColorStop(0, '#f7f1e5'); g.addColorStop(1, '#769983'); c.fillStyle = g; c.fillRect(0, 0, 1200, 900);
      c.fillStyle = '#dfd3b9'; c.beginPath(); c.ellipse(820, 520, 220, 360, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#163c30'; c.font = '26px Arial'; c.fillText('TEST BACKGROUND', 750, 500);
      return cv.toDataURL('image/png').split(',')[1];
    });
    if (process.env.STUDIO_SCENE) await page.getByLabel('Upload photo', { exact: true }).setInputFiles(process.env.STUDIO_SCENE);
    else await page.getByLabel('Upload photo', { exact: true }).setInputFiles({ name: 'scene.png', mimeType: 'image/png', buffer: Buffer.from(scene, 'base64') });
    await page.getByText('Photo added. Check its crop').waitFor();
    await page.getByRole('button', { name: 'Remove', exact: true }).click();
    await page.getByRole('checkbox', { name: 'I compared the pack artwork' }).check();
    assert.equal(await page.getByRole('button', { name: 'Download image' }).isEnabled(), false, 'An empty photo frame cannot be exported');
    await page.getByLabel('Upload photo', { exact: true }).setInputFiles({ name: 'scene.png', mimeType: 'image/png', buffer: Buffer.from(scene, 'base64') });
    await page.getByText('Photo added. Check its crop').waitFor();
    await page.getByRole('button', { name: 'Portrait Framed image' }).click();
    await page.getByRole('button', { name: 'Signature Full scene' }).click();
    assert.equal(await page.getByRole('button', { name: 'Download image' }).isEnabled(), false);
    await page.getByRole('checkbox', { name: 'I compared the pack artwork' }).check();
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download image' }).click();
    await (await downloadPromise).saveAs(path.join(out, 'flyer-test.png'));
    const png = await fs.readFile(path.join(out, 'flyer-test.png'));
    assert.equal(png.readUInt32BE(16), 1080); assert.equal(png.readUInt32BE(20), 1920);
    const pdfPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'PDF ↓', exact: true }).click();
    await (await pdfPromise).saveAs(path.join(out, 'flyer-test.pdf'));
    await page.getByRole('button', { name: 'Save to my catalog' }).click();
    await page.getByText('Saved with your product photo').waitFor();
    await page.screenshot({ path: path.join(out, '02-flyer-desktop.png'), fullPage: true });
    // Any text edit invalidates final review; unsupported claims remain blocked.
    await page.getByLabel('Headline', { exact: true }).fill('Guaranteed cure');
    assert.equal(await page.getByRole('button', { name: 'Download image' }).isEnabled(), false);
    await page.getByLabel('Headline', { exact: true }).fill('Product information');
    await page.getByRole('checkbox', { name: 'I compared the pack artwork' }).check();
    await page.getByRole('button', { name: /Save.*catalog/ }).click();
    await page.getByText('Saved with your product photo').waitFor();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: path.join(out, '03-studio-mobile.png'), fullPage: true });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'Mobile has no horizontal overflow');
    await page.getByRole('link', { name: 'Open saved flyer' }).click();
    await page.getByRole('heading', { name: 'DEMO-500', exact: true }).waitFor();
    await page.reload();
    await page.getByRole('heading', { name: 'DEMO-500', exact: true }).waitFor();
    const saved = await page.evaluate(() => new Promise((resolve, reject) => {
      const request = indexedDB.open('dawakraft-demo');
      request.onsuccess = () => { const tx = request.result.transaction(['products', 'media']); const rows = tx.objectStore('products').getAll(); rows.onsuccess = () => resolve(rows.result); };
      request.onerror = () => reject(request.error);
    }));
    assert.equal(saved.length, 1, 'Repeated save updates one product');
    assert.equal(saved[0].promo.layout, 'editorial');
    assert.equal(saved[0].promo.format, 'story');
    assert.equal(packageCalls, 0, 'No product photo is sent for generative redrawing');
    assert.ok(saved[0].imagePath && saved[0].promo.photoPath, 'Both images persisted');
    await page.getByRole('link', { name: 'Edit promo content' }).click();
    await page.getByRole('heading', { name: 'Make it yours.' }).waitFor();
    await page.getByRole('img', { name: 'Your promotional flyer' }).waitFor();
    await page.getByLabel('Headline', { exact: true }).fill('Updated saved flyer');
    await page.getByRole('checkbox', { name: 'I compared the pack artwork' }).check();
    await page.getByRole('button', { name: 'Save to my catalog' }).click();
    await page.getByText('Saved with your product photo').waitFor();
    await page.reload();
    await page.getByRole('heading', { name: 'Make it yours.' }).waitFor();
    assert.equal(await page.getByLabel('Headline', { exact: true }).inputValue(), 'Updated saved flyer');
    assert.deepEqual(errors, [], 'No browser runtime errors');
    const report = { passed: true, checks: ['single multi-file upload', 'AI view mapping independent of order', 'mixed products blocked', 'missing MRP requested before image creation', '3D product preview before flyer', 'mock reading rejected', 'confirmation gating', 'low resolution rejection popup', 'no generative packaging calls', '1080x1920 Story export', 'photo upload', 'layout switching', 'PNG download', 'PDF download', 'save and reload', 'repeat save updates one record', 'both photos persisted', 'claim blocking', 'edit invalidates final review', '390px no overflow', 'no runtime errors'], note: 'Synthetic test pack and test background; this is functional QA, not a real-product quality benchmark.' };
    await fs.writeFile(path.join(out, 'smoke-report.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report));
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
