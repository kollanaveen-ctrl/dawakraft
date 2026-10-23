// Use the configured Cloudflare account. Browser-only storage is an explicit QA opt-in.
const { spawn } = require('node:child_process');
const path = require('node:path');
const port = process.env.PORT || '3012';
const backend = process.env.STUDIO_DATA_BACKEND === 'demo' ? 'demo' : 'cloudflare';
console.log(`Dawakraft studio: http://127.0.0.1:${port}/new\nStorage: ${backend === 'cloudflare' ? 'Cloudflare D1 + R2 (sign in with your existing passcode)' : 'browser only (explicit test mode)'}. Keep this window open while using the studio.`);
const child = spawn(process.execPath, [require.resolve('next/dist/bin/next'), 'dev', '--hostname', '127.0.0.1', '--port', port], {
  cwd: path.resolve(__dirname, '..'), stdio: 'inherit',
  env: { ...process.env, NEXT_PUBLIC_DATA_BACKEND: backend, DAWAKRAFT_BUILD_DIR: backend === 'cloudflare' ? '.next-cloudflare' : '.next-studio', AI_PROVIDER: process.env.AI_PROVIDER || 'gemini' },
});
child.on('error', error => { console.error(error.message); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 0; });
