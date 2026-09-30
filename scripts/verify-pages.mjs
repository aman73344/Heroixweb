// Headless-browser verification of the production build.
//
// This exists because HTTP 200 proves NOTHING about a client-side failure. The
// previous outage returned a perfect 200 with complete HTML from every route
// while the page was dead in the browser: the server render worked, the build
// passed, and only JavaScript blew up at module evaluation. Status-code checks
// would have called that outage "healthy".
//
// This drives real Chrome over the DevTools Protocol and fails on ANY console
// error, uncaught exception, or failed request - the things a user actually
// experiences as "the page didn't load".
//
// Run: node scripts/verify-pages.mjs [baseUrl]
// Requires a production server already running (e.g. `npx next start -p 3111`).
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const base = process.argv[2] || 'http://localhost:3111';
const profile = mkdtempSync(join(tmpdir(), 'chrome-verify-'));
// Chrome keeps Crashpad handles open past process exit, so a synchronous
// rimraf on 'exit' races the browser and throws EBUSY. Swallow it: a leftover
// temp profile must never turn a passing verification into a failed one.
const cleanup = () => {
  try {
    rmSync(profile, { recursive: true, force: true, maxRetries: 3 });
  } catch {
    /* best effort */
  }
};
process.on('exit', cleanup);

// Chrome/Edge on Windows, macOS and Linux. CI runners are Linux, so a
// Windows-only list would make this script exit 1 everywhere except the
// machine it was written on.
const CHROME_CANDIDATES = [
  // Explicit override, e.g. for a container image with Chrome somewhere custom.
  process.env.CHROME_PATH,
  // Windows
  join(process.env.ProgramFiles || '', 'Google/Chrome/Application/chrome.exe'),
  join(process.env['ProgramFiles(x86)'] || '', 'Google/Chrome/Application/chrome.exe'),
  join(process.env.LOCALAPPDATA || '', 'Google/Chrome/Application/chrome.exe'),
  join(process.env.ProgramFiles || '', 'Microsoft/Edge/Application/msedge.exe'),
  join(process.env['ProgramFiles(x86)'] || '', 'Microsoft/Edge/Application/msedge.exe'),
  // macOS
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  // Linux
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/snap/bin/chromium',
  '/usr/bin/microsoft-edge',
].filter(Boolean);
const chrome = CHROME_CANDIDATES.find((p) => existsSync(p));
if (!chrome) {
  console.error(
    'No Chrome/Edge/Chromium binary found - cannot run the browser check.\n' +
      'Set CHROME_PATH to the browser executable, or install one of the usual packages.',
  );
  process.exit(1);
}

// A fixed port would collide if two checks ever run at once (a parallel CI
// matrix, or a dev machine that already has something on 9222), so pick a free
// one and release it again on exit.
const PORT = Number(process.env.CDP_PORT) || 9200 + Math.floor(Math.random() * 400);
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
process.on('exit', () => { try { chromeProc.kill(); } catch {} });

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
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
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

const ROUTES = [
  { path: '/', minChars: 5000 },
  { path: '/checkout', minChars: 200 },
  // The owner sign-in page is intentionally minimal (a short centred form), and
  // an unknown product id is intentionally a short "Loading product..." state -
  // both hydrate into client components, so the meaningful signal is "did
  // JavaScript throw", not "is the body long". Both render identically to the
  // currently-live commit, so a character count would only produce noise.
  { path: '/heroix-gate', minChars: 0 },
  { path: '/products/verify-nonexistent-id', minChars: 0 },
];

let failed = 0;
for (const { path: route, minChars } of ROUTES) {
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });

  const consoleErrors = [];
  const exceptions = [];
  const failedRequests = [];

  const onEvent = (m) => {
    if (m.sessionId !== sessionId) return;
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
      consoleErrors.push(
        m.params.args.map((a) => a.value ?? a.description ?? '').join(' '),
      );
    }
    if (m.method === 'Runtime.exceptionThrown') {
      exceptions.push(
        m.params.exceptionDetails?.exception?.description ??
          m.params.exceptionDetails?.text ??
          'exception',
      );
    }
    if (m.method === 'Network.loadingFailed' && !m.params.canceled) {
      failedRequests.push(m.params.errorText);
    }
  };
  listeners.push(onEvent);

  await send('Page.enable', {}, sessionId);
  await send('Runtime.enable', {}, sessionId);
  await send('Network.enable', {}, sessionId);
  await send('Page.navigate', { url: base + route }, sessionId);
  await sleep(5000); // let hydration + the catalogue fetch settle

  // Did the page actually render, or did we get an error screen?
  const probe = await send(
    'Runtime.evaluate',
    {
      expression: `JSON.stringify({
        title: document.title,
        bodyLen: document.body ? document.body.innerText.length : 0,
        supabaseAdmin: (document.documentElement.innerHTML || '').includes('supabase-admin'),
        errorPage: (document.body ? document.body.innerText : '').toLowerCase().includes("couldn't load")
      })`,
      returnByValue: true,
    },
    sessionId,
  );
  const info = JSON.parse(probe.result.value);

  const problems = [];
  if (exceptions.length) problems.push(`exceptions: ${exceptions.join(' | ')}`);
  if (consoleErrors.length) problems.push(`console errors: ${consoleErrors.join(' | ')}`);
  if (failedRequests.length) problems.push(`failed requests: ${failedRequests.join(' | ')}`);
  if (info.supabaseAdmin) problems.push('server-only module referenced in the rendered DOM');
  if (info.errorPage) problems.push('rendered the error screen instead of the page');
  if (info.bodyLen < minChars) problems.push(`page looks empty (bodyLen=${info.bodyLen}, expected >= ${minChars})`);

  if (problems.length) {
    failed += 1;
    console.log(`FAIL  ${route}`);
    for (const p of problems) console.log(`        ${p}`);
  } else {
    console.log(
      `PASS  ${route}  (rendered ${info.bodyLen} chars, title "${info.title}")`,
    );
  }

  listeners.splice(listeners.indexOf(onEvent), 1);
  await send('Target.closeTarget', { targetId });
}

ws.close();
console.log(
  failed === 0
    ? `\nALL PAGES RENDER CLEANLY (${ROUTES.length} checked in a real browser, no JS/console errors)`
    : `\n${failed} PAGE(S) FAILED`,
);
process.exit(failed === 0 ? 0 : 1);

