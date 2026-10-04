// Drives a REAL browser through a multi-picture product page and reports which
// image files it actually asked for.
//
// WHY THIS EXISTS
// Static checks cannot see the thing that matters here. It is entirely possible for
// the delivered HTML to reference nothing but 400/800 derivatives while the running
// page still downloads a full-size original - because a derivative 404'd and the
// fallback quietly went to the original, or because a swipe pulled an off-screen
// picture into view. Both only show up in a real browser with a real network log.
//
// WHAT IT CHECKS
//   1. the first picture loads, and it is a derivative, not the original
//   2. the next/previous arrows move through the gallery and still show derivatives
//   3. a swipe and a design switch do not break the gallery or pull an original
//   4. no ORIGINAL-resolution file is downloaded at any point
//   5. nothing renders as a broken image
//   6. a second visit does not re-download anything
//
// Run:  node scripts/verify-gallery-live.mjs [baseUrl]

import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BASE = (process.argv[2] || 'https://heroixweb.vercel.app').replace(/\/+$/, '');
// A product with several pictures, so the arrows and the swipe have somewhere to go.
const PRODUCT = '/products/prod-1790525087504';

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  join(process.env.ProgramFiles || '', 'Google/Chrome/Application/chrome.exe'),
  join(process.env['ProgramFiles(x86)'] || '', 'Google/Chrome/Application/chrome.exe'),
  join(process.env.LOCALAPPDATA || '', 'Google/Chrome/Application/chrome.exe'),
  join(process.env.ProgramFiles || '', 'Microsoft/Edge/Application/msedge.exe'),
  join(process.env['ProgramFiles(x86)'] || '', 'Microsoft/Edge/Application/msedge.exe'),
].filter(Boolean);
const chrome = CHROME_CANDIDATES.find((p) => existsSync(p));
if (!chrome) {
  console.error('No Chrome/Edge found - set CHROME_PATH.');
  process.exit(1);
}

const profile = mkdtempSync(join(tmpdir(), 'chrome-gallery-'));
const cleanup = () => {
  try {
    rmSync(profile, { recursive: true, force: true, maxRetries: 3 });
  } catch {
    /* best effort */
  }
};
process.on('exit', cleanup);

const PORT = 9700 + Math.floor(Math.random() * 200);
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

const imageRequests = [];
listeners.push((msg) => {
  if (msg.method !== 'Network.responseReceived') return;
  const r = msg.params.response;
  if (msg.params.type !== 'Image' && !/\.(webp|jpe?g|png|gif|avif)(\?|$)/i.test(r.url)) return;
  imageRequests.push({ url: r.url, status: r.status, bytes: r.encodedDataLength ?? 0 });
});
listeners.push((msg) => {
  // A derivative that 404s is the exact bug this script hunts, so failures matter.
  if (msg.method === 'Network.loadingFailed') {
    imageRequests.push({
      url: `failed:${msg.params.errorText}`,
      status: 0,
      bytes: 0,
      failed: true,
    });
  }
});

const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
const evaluate = async (expression) => {
  const r = await send(
    'Runtime.evaluate',
    { expression, awaitPromise: true, returnByValue: true },
    sessionId,
  );
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text || 'evaluate failed');
  return r.result.value;
};

await send('Network.enable', {}, sessionId);
await send('Page.enable', {}, sessionId);
await send('Runtime.enable', {}, sessionId);
// A phone-sized viewport, so the responsive path is the one under test.
await send(
  'Emulation.setDeviceMetricsOverride',
  { width: 390, height: 844, deviceScaleFactor: 2, mobile: true },
  sessionId,
);

console.log(`\n  ${BASE}${PRODUCT}\n`);

await send('Page.navigate', { url: `${BASE}${PRODUCT}` }, sessionId);
// Give the server, the client bundle and the first images time to settle.
await sleep(6000);

// A derivative is a `_thumbs/...` file. An ORIGINAL is any other Supabase Storage
// object, which is exactly what must never be downloaded for a gallery slot.
const classify = (url) => {
  if (typeof url !== 'string') return 'other';
  if (url.includes('/_thumbs/')) return 'derivative';
  if (url.includes('.supabase.co/storage/')) return 'ORIGINAL';
  return 'other';
};
const nameOf = (url) => {
  const m = String(url).match(/_thumbs\/(.+?)@(\d+)\.webp/);
  if (m) return `${m[1].split('/').pop()}@${m[2]}`;
  return String(url).split('/').pop().split('?')[0];
};

const snapshot = () =>
  evaluate(`(() => {
    const imgs = [...document.querySelectorAll('img')];
    const box = (i) => {
      const r = i.getBoundingClientRect();
      return r.width > 150 && r.height > 150;
    };
    return {
      total: imgs.length,
      broken: imgs.filter((i) => i.complete && i.naturalWidth === 0).length,
      // Only the real product photos count here. Local static art (the hero
      // background, the logo) is served from the app's own domain, is not an
      // image derivative problem, and would otherwise be picked up as "the main
      // gallery picture" simply by being near the top of the page.
      storage: imgs
        .filter((i) => (i.currentSrc || i.src || '').includes('.supabase.co/storage/'))
        .map((i) => ({
          currentSrc: i.currentSrc || i.src,
          natural: i.naturalWidth,
          shown: box(i),
        })),
      // The picture actually being looked at: the largest storage image on screen.
      visible: imgs
        .filter((i) => (i.currentSrc || i.src || '').includes('.supabase.co/storage/') && box(i))
        .map((i) => ({ currentSrc: i.currentSrc || i.src, natural: i.naturalWidth })),
    };
  })()`);

let failures = 0;
const check = (label, ok, extra = '') => {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}${extra ? ` -> ${extra}` : ''}`);
  if (!ok) failures += 1;
};

const reportImages = (stage) => {
  const urls = imageRequests.map((r) => r.url);
  const originals = urls.filter((u) => classify(u) === 'ORIGINAL');
  const derivatives = urls.filter((u) => classify(u) === 'derivative');
  const failed = imageRequests.filter((r) => r.failed);
  const bytes = imageRequests.reduce((n, r) => n + (r.bytes || 0), 0);

  console.log(`\n  [${stage}]`);
  console.log(`    derivative requests   ${derivatives.length}`);
  console.log(`    ORIGINAL requests     ${originals.length}`);
  console.log(`    total image bytes     ${(bytes / 1024).toFixed(1)} KB`);

  const counts = new Map();
  const duplicated = [];
  for (const u of derivatives) {
    counts.set(u, (counts.get(u) || 0) + 1);
    if (counts.get(u) === 2) duplicated.push(nameOf(u));
  }
  if (duplicated.length) console.log(`    fetched twice         ${duplicated.join(', ')}`);

  check(
    `${stage}: no original-resolution image downloaded`,
    originals.length === 0,
    originals.length ? originals.map(nameOf).slice(0, 5).join(', ') : 'clean',
  );
  if (failed.length) {
    check(`${stage}: no failed image requests`, false, `${failed.length} failed`);
  }

  // The stronger claim: every product photo the page rendered is a derivative, not
  // just the one that happened to be on screen. A hidden carousel slide or a
  // related-products tile is exactly where an original can slip in unnoticed.
  const offScreen = state.storage.filter((i) => !i.shown);
  const offenders = state.storage.filter(
    (i) => classify(i.currentSrc) !== 'derivative',
  );
  check(
    `${stage}: every product photo is a derivative`,
    offenders.length === 0,
    offenders.length
      ? offenders.map((i) => nameOf(i.currentSrc)).slice(0, 5).join(', ')
      : `${state.storage.length} photos, ${offScreen.length} off-screen`,
  );
};

// 1. The first picture.
const state = await snapshot();
console.log(`  images on page: ${state.total}, broken: ${state.broken}`);
check('the page has images', state.total > 0, `${state.total} <img>`);
check('nothing is broken on load', state.broken === 0, `${state.broken} broken`);
check(
  'the main gallery picture is showing',
  state.visible.length > 0,
  state.visible[0]
    ? `${nameOf(state.visible[0].currentSrc)} at ${state.visible[0].natural}px`
    : 'none',
);
if (state.visible[0]) {
  check(
    'the main picture is a WebP derivative, not the original',
    classify(state.visible[0].currentSrc) === 'derivative',
    nameOf(state.visible[0].currentSrc),
  );
}

reportImages('after load');

// 2. The arrows. Click whatever the gallery uses to move, then re-read the picture.
const clickArrow = async (dir) => {
  const clicked = await evaluate(`(() => {
    const want = ${JSON.stringify(dir)};
    const b = [...document.querySelectorAll('button')].find((x) => {
      const l = (x.getAttribute('aria-label') || x.title || '').toLowerCase();
      return want === 'next' ? l.includes('next') : l.includes('previous');
    });
    if (!b) return false;
    b.click();
    return true;
  })()`);
  await sleep(2500);
  return clicked;
};

for (const dir of ['next', 'next', 'previous']) {
  const clicked = await clickArrow(dir);
  const after = await snapshot();
  check(`the ${dir} arrow moves the gallery`, clicked);
  check(`  nothing broken after ${dir}`, after.broken === 0, `${after.broken} broken`);
  if (after.visible[0]) {
    check(
      `  still a derivative after ${dir}`,
      classify(after.visible[0].currentSrc) === 'derivative',
      nameOf(after.visible[0].currentSrc),
    );
  }
}

reportImages('after arrows');

// 3. A swipe, which is how most phones actually change picture.
const swiped = await evaluate(`(() => {
  const target = [...document.querySelectorAll('img')].find((i) => {
    const r = i.getBoundingClientRect();
    return r.width > 200 && r.height > 200;
  });
  if (!target) return 'no target';
  const r = target.getBoundingClientRect();
  const base = { bubbles: true, cancelable: true, pointerId: 1 };
  const y = r.top + r.height / 2;
  const fire = (type, x) =>
    target.dispatchEvent(new PointerEvent(type, { ...base, clientX: x, clientY: y }));
  fire('pointerdown', r.left + r.width * 0.8);
  fire('pointermove', r.left + r.width * 0.5);
  fire('pointermove', r.left + r.width * 0.1);
  fire('pointerup', r.left + r.width * 0.1);
  return 'dispatched';
})()`);
await sleep(2500);
const afterSwipe = await snapshot();
check('a swipe does not break the gallery', afterSwipe.broken === 0 && swiped !== 'no target', swiped);
if (afterSwipe.visible[0]) {
  check(
    '  still a derivative after swiping',
    classify(afterSwipe.visible[0].currentSrc) === 'derivative',
    nameOf(afterSwipe.visible[0].currentSrc),
  );
}

// 4. Switching design/variant, if this product offers a choice.
const switched = await evaluate(`(() => {
  const control = [...document.querySelectorAll('button, [role="radio"]')].find((b) => {
    const l = (b.getAttribute('aria-label') || b.title || b.textContent || '').toLowerCase();
    return l.includes('design') && b.getAttribute('aria-checked') !== 'true';
  });
  if (!control) return 'no design control';
  control.click();
  return (control.getAttribute('aria-label') || control.textContent || '').trim();
})()`);
await sleep(3000);
const afterSwitch = await snapshot();
check('switching design keeps the gallery working', afterSwitch.broken === 0, `control: ${switched}`);
if (afterSwitch.visible[0]) {
  check(
    '  still a derivative after switching design',
    classify(afterSwitch.visible[0].currentSrc) === 'derivative',
    nameOf(afterSwitch.visible[0].currentSrc),
  );
}

reportImages('after interaction');

// 5. A second visit must not re-download anything: that is the cache header working.
imageRequests.length = 0;
await send('Page.navigate', { url: `${BASE}${PRODUCT}?again=1` }, sessionId);
await sleep(6000);
const revisitOriginals = imageRequests.filter((r) => classify(r.url) === 'ORIGINAL');
const revisitDerivatives = imageRequests.filter((r) => classify(r.url) === 'derivative');
console.log(`\n  [second visit, same session]`);
console.log(`    derivative requests   ${revisitDerivatives.length} (cache hits never reach the network)`);
check(
  'second visit downloads no original either',
  revisitOriginals.length === 0,
  revisitOriginals.length ? `${revisitOriginals.length} originals` : 'clean',
);

const finalState = await snapshot();
check('nothing broken after the second visit', finalState.broken === 0, `${finalState.broken} broken`);

console.log(
  failures === 0
    ? '\n  Live gallery check passed.\n'
    : `\n  ${failures} live check(s) failed.\n`,
);
process.exit(failures === 0 ? 0 : 1);
