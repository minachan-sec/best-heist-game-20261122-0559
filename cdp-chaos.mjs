// 120s browser chaos run: open the game, start it, hammer random keys and clicks
// for 120 real seconds, collect every page error/exception, report the end state.
// Usage: POL_SHA=<sha> node cdp-chaos.mjs
import { spawn } from 'node:child_process';

const SHA = process.env.POL_SHA;
const URL = 'file:///home/hatch/workspace/makefun/best-heist-game-20261122-0559-bot/game/index.html?seed=42';
const chrome = spawn('/opt/meta-chromium/chrome', [
  '--headless=new', '--disable-gpu', '--no-sandbox',
  '--window-size=1280,720',
  '--allow-file-access-from-files',
  '--user-data-dir=/tmp/vb-chrome-chaos',
  '--remote-debugging-port=9226', '--remote-debugging-address=127.0.0.1',
  '--hatch-webgl-allowed-domains-file=/tmp/pol.txt',
  `--hatch-webgl-allowed-domains-sha256=${SHA}`,
  'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function getJson(path, opts) {
  for (let i = 0; i < 30; i += 1) {
    try {
      const res = await fetch(`http://127.0.0.1:9226${path}`, opts);
      if (res.ok) return await res.json();
    } catch { /* not up yet */ }
    await sleep(500);
  }
  throw new Error(`devtools ${path} never came up`);
}

let ws;
try {
  await getJson('/json/version');
  const created = await getJson(`/json/new?${encodeURIComponent(URL)}`, { method: 'PUT' });
  let wsUrl = created.webSocketDebuggerUrl;
  for (let i = 0; i < 20 && !wsUrl; i += 1) {
    await sleep(500);
    const targets = await getJson('/json/list');
    const t = targets.find((x) => x.url === URL);
    if (t) wsUrl = t.webSocketDebuggerUrl;
  }
  if (!wsUrl) throw new Error('tab websocket never appeared');
  ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0;
  const pending = new Map();
  const errors = [];
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
    else if (msg.method === 'Runtime.exceptionThrown') errors.push(msg.params.exceptionDetails?.text + ' ' + (msg.params.exceptionDetails?.exception?.description ?? ''));
    else if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') errors.push(msg.params.args.map((a) => a.value ?? a.description).join(' '));
  };
  const send = (method, params = {}) => new Promise((resolve) => {
    const mid = ++id;
    pending.set(mid, resolve);
    ws.send(JSON.stringify({ id: mid, method, params }));
  });
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Input.dispatchKeyEvent', { type: 'keyDown', code: 'Space', key: ' ' });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', code: 'Space', key: ' ' });
  await sleep(500);
  const keys = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
  const t0 = Date.now();
  let presses = 0;
  let held = null;
  while (Date.now() - t0 < 120000) {
    // Hold a random direction key for a bit, sometimes with Shift, sometimes click.
    if (held) {
      await send('Input.dispatchKeyEvent', { type: 'keyUp', code: held, key: held.replace('Key', '').toLowerCase() });
      held = null;
    }
    const k = keys[Math.floor(Math.random() * keys.length)];
    await send('Input.dispatchKeyEvent', { type: 'keyDown', code: k, key: k.replace('Key', '').toLowerCase() });
    held = k;
    presses += 1;
    if (Math.random() < 0.3) await send('Input.dispatchKeyEvent', { type: 'keyDown', code: 'ShiftLeft', key: 'Shift' });
    if (Math.random() < 0.15) {
      await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 200 + Math.random() * 800, y: 150 + Math.random() * 400, button: 'left', clickCount: 1 });
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 200, y: 150, button: 'left', clickCount: 1 });
    }
    if (Math.random() < 0.3) {
      await send('Input.dispatchKeyEvent', { type: 'keyUp', code: 'ShiftLeft', key: 'Shift' });
    }
    if (Math.random() < 0.05) {
      await send('Input.dispatchKeyEvent', { type: 'keyDown', code: 'KeyP', key: 'p' });
      await send('Input.dispatchKeyEvent', { type: 'keyUp', code: 'KeyP', key: 'p' });
      await sleep(200);
      await send('Input.dispatchKeyEvent', { type: 'keyDown', code: 'KeyP', key: 'p' });
      await send('Input.dispatchKeyEvent', { type: 'keyUp', code: 'KeyP', key: 'p' });
    }
    await sleep(150 + Math.random() * 350);
  }
  if (held) await send('Input.dispatchKeyEvent', { type: 'keyUp', code: held, key: held.replace('Key', '').toLowerCase() });
  const evalRes = await send('Runtime.evaluate', { expression: `JSON.stringify({status: document.getElementById('status').textContent, title: document.title})`, returnByValue: true });
  console.log('chaos done. key presses:', presses);
  console.log('final state:', evalRes.result?.result?.value);
  console.log('page errors:', errors.length, JSON.stringify(errors.slice(0, 5)));
  console.log(errors.length === 0 ? 'CHAOS PASS: no page errors in 120s' : 'CHAOS FAIL');
} finally {
  if (ws) ws.close();
  chrome.kill('SIGKILL');
  process.exit(0);
}
