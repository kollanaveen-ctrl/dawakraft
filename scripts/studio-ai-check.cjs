// Explicit opt-in live integration check; uses the fictional smoke-test pack, never customer data.
const fs = require('node:fs/promises');
const path = require('node:path');
const base = process.env.STUDIO_URL || 'http://127.0.0.1:3012';
async function post(route, body) {
  const response = await fetch(base + route, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(150000) });
  return { status: response.status, body: await response.json() };
}
(async () => {
  const out = path.resolve('artifacts/studio');
  const pack = await fs.readFile(path.join(out, 'fictional-pack.png'));
  const side = await fs.readFile(path.join(out, 'fictional-side.png'));
  const reading = await post('/api/read-box', { images: [side, pack].map(buffer => ({ mediaType: 'image/png', data: buffer.toString('base64'), role: 'other' })) });
  const report = { reading: { status: reading.status, ok: reading.body.ok, error: reading.body.error, mock: reading.body.meta?.mock, name: reading.body.data?.name?.value, composition: reading.body.data?.composition?.value, photoViews: reading.body.data?.photoViews, mixedProducts: reading.body.data?.mixedProducts } };
  console.log(JSON.stringify(report));
  const copy = await post('/api/write-copy', { name: 'DEMO-500', composition: 'Paracetamol IP 500 mg', uses: '', category: 'Pain / Fever', form: 'Tablet', schedule: '', inferUses: true });
  report.copy = { status: copy.status, ok: copy.body.ok, error: copy.body.error, mock: copy.body.meta?.mock, model: copy.body.meta?.model, copy: copy.body.data?.copy };
  console.log(JSON.stringify(report.copy));
  if (process.env.STUDIO_CHECK_PHOTO === '1' && copy.body.ok && !copy.body.meta?.mock) {
    const draft = copy.body.data.copy;
    const photo = await post('/api/promo-photo', { name: 'DEMO-500', composition: 'Paracetamol IP 500 mg', uses: (draft.suggestedUses || []).join('; ').slice(0, 200), visualBrief: draft.visualBrief, category: 'Pain / Fever', form: 'Tablet', format: 'story', variant: 1 });
    report.photo = { status: photo.status, ok: photo.body.ok, error: photo.body.error, mock: photo.body.meta?.mock, model: photo.body.meta?.model };
    if (photo.body.ok) {
      const ext = photo.body.data.mediaType === 'image/jpeg' ? 'jpg' : photo.body.data.mediaType === 'image/webp' ? 'webp' : 'png';
      report.photo.file = path.join(out, `live-story-scene.${ext}`);
      await fs.writeFile(report.photo.file, Buffer.from(photo.body.data.data, 'base64'));
    }
    console.log(JSON.stringify(report.photo));
  }
  await fs.writeFile(path.join(out, 'live-ai-report.json'), JSON.stringify(report, null, 2));
  if (!report.reading.ok || !report.copy.ok || (process.env.STUDIO_CHECK_PHOTO === '1' && !report.photo?.ok)) throw new Error('Live integration check failed; see report');
})().catch(e => { console.error(e.message); process.exitCode = 1; });
