// Measures what a real browser actually downloads from Supabase Storage for a
// page, so the image-loading work can be judged on bytes rather than on
// intentions. Drives headless Chrome over the DevTools Protocol and reads the
// real `encodedDataLength` of every response.
//
// Run:  node scripts/measure-image-bandwidth.mjs [beforeUrl] [afterUrl]
//   e.g. node scripts/measure-image-bandwidth.mjs https://heroixweb.vercel.app http://localhost:3111
//
// Same tooling as verify-pages.mjs (same Chrome discovery, same CDP plumbing)
// because the point is to measure what a shopper's browser really downloads, not
// what the delivered HTML makes it look like.

import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const TARGETS = [
  { label: 'home', path: '/' },
  // A product with several pictures, and one with five designs each carrying
  // their own pictures, so the gallery, the design grid and the related-products
  // grid are all exercised.
  { label: 'product (multi-photo)', path: '/products/prod-1790525087504' },
  { label: 'product (5 designs)', path: '/products/prod-1790762430768' },
];

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  join(process.env.ProgramFiles || '', 'Google/Chrome/Application/chrome.exe'),
  join(process.env['ProgramFiles(x86)'] || '', 'Google/Chrome/Application/chrome.exe'),
  join(process.env.LOCALAPPDATA || '', 'Google/Chrome/Application/chrome.exe'),
  join(process.env.ProgramFiles || '', 'Microsoft/Edge/Application/msedge.exe'),
  join(process.env['ProgramFiles(x86)'] || '', 'Microsoft/Edge/Application/msedge.exe'),
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean);
const chrome = CHROME_CANDIDATES.find((p) => existsSync(p));
if (!chrome) {
  console.error('No Chrome/Edge found - set CHROME_PATH.');
  process.exit(1);
}

const profile = mkdtempSync(join(tmpdir(), 'chrome-bandwidth-'));
const cleanup = () => {
  try {
    rmSync(profile, { recursive: true, force: true, maxRetries: 3 });
  } catch {
    /* best effort */
  }
};
process.on('exit', cleanup);

const PORT = 9300 + Math.floor(Math.random() * 400);
const chromeProc = spawn(
  chrome,
  [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profile}`,
    'about:blank',
  ],
  { stdio: 'ignore' },
);
process.on('exit', () => {
  try {
    chromeProc.kill();
  } catch {
    /* best effort */
  }
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let wsUrl = null;
for (let i = 0; i < 60 && !wsUrl; i++) {
  await sleep(500);
  try {
    const res = await fetch(`http://127.0.0.1:${PORT}/json/version`);
    wsUrl = (await res.json()).webSocketDebuggerUrl;
  } catch {
    /* not up yet */
  }
}
if (!wsUrl) {
  console.error('Chrome DevTools endpoint never became available.');
  process.exit(1);
}

const ws = new WebSocket(wsUrl);
await new Promise((res, rej) => {
  ws.onopen = res;
  ws.onerror = () => rej(new Error('devtools socket failed'));
});

let nextId = 1;
const pending = new Map();
const listeners = [];
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
    return;
  }
  for (const fn of listeners) fn(msg);
};
const send = (method, params = {}, sessionId) =>
  new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params, sessionId }));
  });

const isStorage = (url) => url.includes('.supabase.co/storage/');
const isThumb = (url) => url.includes('/_thumbs/');
const human = (bytes) => `${(bytes / 1024).toFixed(0)} KB`;

async function measure(base, target) {
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });

  const finished = new Map(); // requestId -> bytes
  const urls = new Map(); // requestId -> url
  const onEvent = (m) => {
    if (m.sessionId !== sessionId) return;
    if (m.method === 'Network.responseReceived') {
      urls.set(m.params.requestId, m.params.response.url);
    }
    if (m.method === 'Network.loadingFinished') {
      finished.set(m.params.requestId, m.params.encodedDataLength || 0);
    }
  };
  listeners.push(onEvent);

  await send('Page.enable', {}, sessionId);
  await send('Network.enable', {}, sessionId);
  // A cold cache is the honest measurement: repeat viewings are the cache's job.
  await send('Network.setCacheDisabled', { cacheDisabled: true }, sessionId);
  await send('Page.navigate', { url: base + target.path }, sessionId);
  await sleep(9000); // hydration + the catalogue read + the picture traffic

  let originals = 0;
  let originalBytes = 0;
  let thumbs = 0;
  let thumbBytes = 0;
  const seen = new Set();

  for (const [requestId, bytes] of finished) {
    const url = urls.get(requestId) || '';
    if (!isStorage(url)) continue;
    if (isThumb(url)) {
      thumbs += 1;
      thumbBytes += bytes;
    } else {
      // The same file requested twice is a separate finding, so only the first
      // occurrence is counted here.
      const key = url.split('?')[0];
      if (seen.has(key)) continue;
      seen.add(key);
      originals += 1;
      originalBytes += bytes;
    }
  }

  const probe = await send(
    'Runtime.evaluate',
    {
      expression: `JSON.stringify({
        imgs: document.querySelectorAll('img').length,
        srcsets: document.querySelectorAll('img[srcset]').length,
        broken: [...document.querySelectorAll('img')].filter(function (i) {
          return i.complete && i.naturalWidth === 0;
        }).length
      })`,
      returnByValue: true,
    },
    sessionId,
  );
  const dom = JSON.parse(probe.result.value);

  listeners.splice(listeners.indexOf(onEvent), 1);
  await send('Target.closeTarget', { targetId });

  return { originals, originalBytes, thumbs, thumbBytes, dom };
}

const labels = ['BEFORE', 'AFTER'];
const bases = process.argv.slice(2, 4);
if (bases.length < 2) {
  console.error('Usage: node scripts/measure-image-bandwidth.mjs [beforeUrl] [afterUrl]');
  process.exit(1);
}

for (const target of TARGETS) {
  console.log(`\n=== ${target.path} ===`);
  for (let i = 0; i < 2; i++) {
    const result = await measure(bases[i], target);
    console.log(
      `${labels[i].padEnd(6)} ${bases[i].padEnd(34)} ` +
        `full-res ${String(result.originals).padStart(3)} files / ${human(result.originalBytes).padStart(9)}  |  ` +
        `thumbs ${String(result.thumbs).padStart(3)} files / ${human(result.thumbBytes).padStart(9)}  |  ` +
        `<img> ${result.dom.imgs}, srcset ${result.dom.srcsets}, broken ${result.dom.broken}`,
    );
  }
}

ws.close();
console.log('');
process.exit(0);
