// Minimal CDP driver v2: open a fresh tab via /json/new (no about:blank initiator,
// so Chrome's Local Network Access check does not block localhost), then
// screenshot it. Usage: node cdp-shot2.mjs <url> <out.png> [waitMs]
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const [url, out, waitMs = '6000'] = process.argv.slice(2);
const SHA = process.env.POL_SHA;
const chrome = spawn('/opt/meta-chromium/chrome', [
  '--headless=new', '--disable-gpu', '--no-sandbox',
  '--window-size=1280,720',
  '--allow-file-access-from-files',
  '--user-data-dir=/tmp/vb-chrome-cdp3',
  '--remote-debugging-port=9225', '--remote-debugging-address=127.0.0.1',
  '--hatch-webgl-allowed-domains-file=/tmp/pol.txt',
  `--hatch-webgl-allowed-domains-sha256=${SHA}`,
  'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function getJson(path, opts) {
  for (let i = 0; i < 30; i += 1) {
    try {
      const res = await fetch(`http://127.0.0.1:9225${path}`, opts);
      if (res.ok) return await res.json();
    } catch { /* not up yet */ }
    await sleep(500);
  }
  throw new Error(`devtools ${path} never came up`);
}

let ws;
try {
  const version = await getJson('/json/version');
  console.log('browser:', version.Browser);
  const created = await getJson(`/json/new?${encodeURIComponent(url)}`, { method: 'PUT' });
  console.log('tab url:', created.url);
  let wsUrl = created.webSocketDebuggerUrl;
  for (let i = 0; i < 20 && !wsUrl; i += 1) {
    await sleep(500);
    const targets = await getJson('/json/list');
    const t = targets.find((x) => x.url === url);
    if (t) wsUrl = t.webSocketDebuggerUrl;
  }
  if (!wsUrl) throw new Error('tab websocket never appeared');
  ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0;
  const pending = new Map();
  const events = [];
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
    else if (msg.method) events.push(msg);
  };
  const send = (method, params = {}) => new Promise((resolve) => {
    const mid = ++id;
    pending.set(mid, resolve);
    ws.send(JSON.stringify({ id: mid, method, params }));
  });
  await send('Runtime.enable');
  await send('Page.enable');
  await sleep(Number(waitMs));
  const evalRes = await send('Runtime.evaluate', { expression: `JSON.stringify({ready: !!window.__shotReady, title: document.title, hasCanvas: !!document.getElementById('game')})`, returnByValue: true });
  console.log('eval:', evalRes.result?.result?.value);
  const errs = events.filter((e) => e.method === 'Runtime.exceptionThrown' || (e.method === 'Runtime.consoleAPICalled' && e.params.type === 'error'));
  console.log('page errors:', JSON.stringify(errs.map((e) => e.params?.exceptionDetails?.text || e.params?.args?.map((a) => a.value ?? a.description).join(' '))));
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  if (shot.result?.data) {
    writeFileSync(out, Buffer.from(shot.result.data, 'base64'));
    console.log('saved', out);
  } else {
    console.log('screenshot failed:', JSON.stringify(shot).slice(0, 500));
  }
} finally {
  if (ws) ws.close();
  chrome.kill('SIGKILL');
  process.exit(0);
}
