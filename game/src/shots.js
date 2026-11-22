// VAULTBREAK shot staging — deterministic scenes for the four screenshots.
// ?shot=start|play|close|end&seed=1 in the browser, and the Node tests, both use this.
// Nothing here touches the DOM: it only builds and poses a sim.

import { SETTINGS } from './config.js';
import { createSim, startRun, stepSim, thiefHidden } from './sim.js';
import { tileCenter, tileAt } from './world.js';

export const SCENES = ['start', 'play', 'close', 'end'];

function findTile(level, ch) {
  for (let y = 0; y < level.rows; y++) {
    for (let x = 0; x < level.cols; x++) {
      if (level.grid[y][x] === ch) return { cx: x, cy: y };
    }
  }
  return null;
}

function stageStart(seed) {
  const sim = createSim(0, seed);
  sim.state = 'playing';
  for (let i = 0; i < 90; i++) stepSim(sim, 1 / 60);
  sim.state = 'title';
  sim.stateT = 0;
  return sim;
}

function stagePlay(seed) {
  const sim = createSim(0, seed);
  startRun(sim);
  const shadow = findTile(sim.level, ',');
  const spot = tileCenter(shadow.cx, shadow.cy);
  sim.thief.x = spot.x;
  sim.thief.y = spot.y;
  sim.thief.dir = -Math.PI / 2;
  // One small loot already pocketed, so the frame reads as mid-heist.
  const first = sim.level.loot.find((item) => item.kind === 'small');
  if (first) {
    first.taken = true;
    sim.score += first.value;
  }
  // Pull the nearest guard into view, looking toward the thief without seeing them.
  let best = sim.guards[0];
  let bestD = Infinity;
  for (const guard of sim.guards) {
    const d = Math.hypot(guard.x - spot.x, guard.y - spot.y);
    if (d < bestD) {
      bestD = d;
      best = guard;
    }
  }
  best.dir = Math.atan2(spot.y - best.y, spot.x - best.x);
  best.suspicion = 0.3;
  sim.alarm = 0.22;
  for (let i = 0; i < 30; i++) stepSim(sim, 1 / 60);
  sim.alarm = 0.22;
  return sim;
}

function stageClose(seed) {
  const sim = createSim(0, seed);
  startRun(sim);
  const camera = sim.cameras[0];
  // Place the thief near the rim of the first camera's cone, on open floor.
  let tx = camera.x + Math.cos(camera.angle) * 185;
  let ty = camera.y + Math.sin(camera.angle) * 185;
  for (let i = 0; i < 24; i++) {
    const ch = tileAt(sim.level, tx, ty);
    if (ch !== '#' && ch !== 'D' && ch !== ',') break;
    tx -= Math.cos(camera.angle) * 8;
    ty -= Math.sin(camera.angle) * 8;
  }
  sim.thief.x = tx;
  sim.thief.y = ty;
  sim.thief.dir = Math.atan2(camera.y - ty, camera.x - tx);
  // A guard has half a clue: suspicious, staring at the thief.
  const guard = sim.guards[0];
  guard.state = 'suspicious';
  guard.stateT = 0.5;
  guard.suspicion = 0.62;
  guard.dir = Math.atan2(ty - guard.y, tx - guard.x);
  sim.alarm = 0.56;
  for (let i = 0; i < 12; i++) stepSim(sim, 1 / 60);
  sim.alarm = 0.56;
  return sim;
}

function stageEnd(seed) {
  const sim = createSim(0, seed);
  startRun(sim);
  for (const item of sim.level.loot) {
    if (!item.taken) {
      item.taken = true;
      sim.score += item.value;
    }
  }
  sim.vaultTaken = true;
  sim.exitOpen = true;
  sim.score += SETTINGS.run.clearBonusBase;
  sim.score += SETTINGS.run.ghostBonus;
  sim.everSeen = false;
  sim.state = 'clear';
  sim.stateT = 0.4;
  const van = sim.level.van;
  sim.thief.x = van.x - 46;
  sim.thief.y = van.y;
  sim.thief.dir = 0;
  return sim;
}

export function stageScene(scene, seed) {
  const s = seed || 1;
  if (scene === 'start') return stageStart(s);
  if (scene === 'play') return stagePlay(s);
  if (scene === 'close') return stageClose(s);
  if (scene === 'end') return stageEnd(s);
  throw new Error('unknown shot scene: ' + scene);
}

export function describeScene(scene) {
  if (scene === 'start') return 'title screen, guards mid-patrol';
  if (scene === 'play') return 'thief hidden in shadow, guard nearby';
  if (scene === 'close') return 'alarm at 0.56, guard suspicious';
  if (scene === 'end') return 'level clear with ghost bonus';
  return scene;
}
