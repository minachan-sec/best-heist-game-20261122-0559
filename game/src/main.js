// VAULTBREAK entry point — browser shell around the pure sim.
// Owns the canvas, the frame loop, pause/mute/restart keys and the ?shot= scenes.
// Importing this file in Node does nothing: the boot only runs when `document` exists.

import { SETTINGS } from './config.js';
import { createSim, startRun, stepSim } from './sim.js';
import { drawScene } from './render.js';
import { stageScene } from './shots.js';
import { attachInput } from './input.js';
import { SoundBank } from './audio.js';

const W = SETTINGS.viewWidth;
const H = SETTINGS.viewHeight;

function fitCanvas(canvas) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
  canvas.style.width = window.innerWidth + 'px';
  canvas.style.height = window.innerHeight + 'px';
  return dpr;
}

function drawFrame(ctx, canvas, sim, dpr, paused) {
  const cw = canvas.width / dpr;
  const ch = canvas.height / dpr;
  const scale = Math.min(cw / W, ch / H);
  const ox = (cw - W * scale) / 2;
  const oy = (ch - H * scale) / 2;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#05070f';
  ctx.fillRect(0, 0, cw, ch);
  ctx.setTransform(scale, 0, 0, scale, ox, oy);
  drawScene(ctx, sim);
  if (paused) {
    ctx.fillStyle = 'rgba(5, 7, 15, 0.6)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#e8ecf7';
    ctx.font = 'bold 40px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PAUSED — press P to resume', W / 2, H / 2);
  }
}

export function bootGame(canvas, statusEl) {
  const ctx = canvas.getContext('2d');
  const params = new URLSearchParams(window.location.search);
  const seed = Number(params.get('seed') || 1);
  const shot = params.get('shot');
  const input = attachInput(canvas);
  const audio = new SoundBank();
  let dpr = fitCanvas(canvas);

  window.addEventListener('resize', () => {
    dpr = fitCanvas(canvas);
  });

  // Screenshot mode: stage one frozen scene and draw it, no loop.
  if (shot) {
    const sim = stageScene(shot, seed);
    drawFrame(ctx, canvas, sim, dpr, false);
    return { sim, mode: 'shot', scene: shot };
  }

  let sim = createSim(0, seed, input, audio);
  let paused = false;
  let last = performance.now();

  function setStatus(text) {
    if (statusEl) statusEl.textContent = text;
  }

  input.onKey = (code, down) => {
    if (!down) return;
    if (code === 'Enter') {
      if (sim.state === 'title') {
        audio.ensure();
        audio.click();
        startRun(sim);
      }
    }
    if (code === 'KeyR') {
      if (sim.state === 'gameover' || sim.state === 'won') {
        sim = createSim(0, seed, input, audio);
        startRun(sim);
      }
    }
    if (code === 'KeyP') paused = !paused;
    if (code === 'KeyM') audio.toggleMute();
  };

  // Clicking the title screen starts the run too.
  const startOnClick = () => {
    if (sim.state === 'title') {
      audio.ensure();
      audio.click();
      startRun(sim);
    }
  };
  canvas.addEventListener('mousedown', startOnClick);

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!paused) stepSim(sim, dt);
    drawFrame(ctx, canvas, sim, dpr, paused);
    setStatus(
      'VAULTBREAK level ' + (sim.levelIndex + 1) + ' of 3, score ' + sim.score +
        ', lives ' + sim.lives + ', alarm ' + Math.round(sim.alarm * 100) + ' percent, ' + sim.state,
    );
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  return { get sim() { return sim; }, mode: 'play' };
}

if (typeof document !== 'undefined') {
  const canvas = document.getElementById('game');
  const statusEl = document.getElementById('status');
  if (canvas) bootGame(canvas, statusEl);
}
