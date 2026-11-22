// VAULTBREAK tests — run with `node test.mjs`, exit 0 when everything passes.
// Pure Node: no DOM, no canvas, no network. The sim is driven headlessly.

import { strict as assert } from 'node:assert';
import { SETTINGS } from './game/src/config.js';
import { makeRng, hashSeed } from './game/src/random.js';
import { makeHeadlessInput } from './game/src/input.js';
import {
  LEVELS,
  buildLevel,
  tileAt,
  tileCenter,
  reachableTiles,
} from './game/src/world.js';
import { createSim, startRun, stepSim, thiefHidden } from './game/src/sim.js';
import { stageScene } from './game/src/shots.js';

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log('ok - ' + name);
}

function tileOf(level, px, py) {
  return { cx: Math.floor(px / SETTINGS.tile), cy: Math.floor(py / SETTINGS.tile) };
}

check('three levels parse and are rectangular with all required pieces', () => {
  assert.equal(LEVELS.length, 3);
  for (const def of LEVELS) {
    const level = buildLevel(def);
    assert.equal(level.rows, 15);
    assert.equal(level.cols, 24);
    assert.ok(level.thiefStart);
    assert.ok(level.van);
    assert.ok(level.vault);
    assert.ok(level.loot.length >= 3);
    assert.equal(level.guardSpawns.length, def.guardRoutes.length);
    assert.equal(level.cameraMounts.length, def.cameraSpecs.length);
  }
});

check('every loot, vault, van and guard waypoint is reachable from the thief start', () => {
  for (const def of LEVELS) {
    const level = buildLevel(def);
    const start = tileOf(level, level.thiefStart.x, level.thiefStart.y);
    const reached = reachableTiles(level, start.cx, start.cy);
    const key = (x, y) => Math.floor(x / SETTINGS.tile) + ',' + Math.floor(y / SETTINGS.tile);
    for (const item of level.loot) {
      assert.ok(reached.has(key(item.x, item.y)), def.name + ' loot unreachable at ' + item.x + ',' + item.y);
    }
    assert.ok(reached.has(key(level.van.x, level.van.y)), def.name + ' van unreachable');
    for (const route of def.guardRoutes) {
      for (const wp of route) {
        assert.ok(reached.has(wp.cx + ',' + wp.cy), def.name + ' waypoint unreachable at ' + wp.cx + ',' + wp.cy);
      }
    }
  }
});

check('guard waypoints sit on walkable floor', () => {
  for (const def of LEVELS) {
    const level = buildLevel(def);
    for (const route of def.guardRoutes) {
      for (const wp of route) {
        const ch = level.grid[wp.cy][wp.cx];
        assert.ok(ch !== '#' && ch !== 'D', def.name + ' waypoint on ' + ch);
      }
    }
  }
});

check('a guard spots the thief standing in its open cone', () => {
  const input = makeHeadlessInput();
  const sim = createSim(0, 1, input, null);
  startRun(sim);
  const guard = sim.guards[0];
  // Guard 0 spawns at tile (7,3); put the thief 80px east of it on open floor.
  sim.thief.x = guard.x + 80;
  sim.thief.y = guard.y;
  guard.dir = 0;
  guard.state = 'patrol';
  for (let i = 0; i < 60; i++) stepSim(sim, 1 / 60);
  assert.ok(guard.suspicion > 0.5, 'suspicion stayed ' + guard.suspicion);
});

check('a wall between guard and thief blocks the spot', () => {
  const input = makeHeadlessInput();
  const sim = createSim(0, 1, input, null);
  startRun(sim);
  const guard = sim.guards[0];
  // Thief west of the guard, behind the display case at tile (3,3).
  sim.thief.x = guard.x - 200;
  sim.thief.y = guard.y;
  guard.dir = Math.PI;
  guard.state = 'patrol';
  guard.suspicion = 0;
  for (let i = 0; i < 60; i++) stepSim(sim, 1 / 60);
  assert.equal(guard.suspicion, 0);
});

check('a thief in shadow is invisible to a cone beyond spotting range', () => {
  const input = makeHeadlessInput();
  const sim = createSim(0, 1, input, null);
  startRun(sim);
  const guard = sim.guards[0];
  // Shadow tile (9,2); guard 0 is at (300,140) facing it.
  const spot = tileCenter(9, 2);
  sim.thief.x = spot.x;
  sim.thief.y = spot.y;
  assert.ok(thiefHidden(sim));
  guard.dir = Math.atan2(spot.y - guard.y, spot.x - guard.x);
  guard.state = 'patrol';
  for (let i = 0; i < 60; i++) stepSim(sim, 1 / 60);
  assert.equal(guard.suspicion, 0);
});

check('a camera in whose cone the thief stands raises the alarm', () => {
  const input = makeHeadlessInput();
  const sim = createSim(0, 1, input, null);
  startRun(sim);
  const camera = sim.cameras[0];
  // Camera 0 sits at tile (22,2) facing west; put the thief 200px west on open floor.
  sim.thief.x = camera.x - 200;
  sim.thief.y = camera.y;
  assert.equal(tileAt(sim.level, sim.thief.x, sim.thief.y), '.');
  for (let i = 0; i < 60; i++) stepSim(sim, 1 / 60);
  assert.ok(sim.alarm > 0.3, 'alarm stayed ' + sim.alarm);
});

check('a full alarm trips lockdown and blocks the exit', () => {
  const input = makeHeadlessInput();
  const sim = createSim(0, 1, input, null);
  startRun(sim);
  const camera = sim.cameras[0];
  sim.thief.x = camera.x - 200;
  sim.thief.y = camera.y;
  sim.alarm = 0.99;
  stepSim(sim, 1 / 60);
  assert.ok(sim.lockdownT > 0, 'no lockdown at alarm ' + sim.alarm);
  stepSim(sim, 1 / 60);
  assert.equal(sim.guards[0].state, 'chase');
  sim.exitOpen = true;
  sim.thief.x = sim.level.van.x;
  sim.thief.y = sim.level.van.y;
  stepSim(sim, 1 / 60);
  assert.equal(sim.state, 'playing', 'escaped during lockdown');
});

check('a thrown coin pulls a nearby guard to investigate', () => {
  const input = makeHeadlessInput();
  const sim = createSim(0, 1, input, null);
  startRun(sim);
  const guard = sim.guards[0];
  input.clickAt(guard.x + 30, guard.y);
  for (let i = 0; i < 90; i++) stepSim(sim, 1 / 60);
  assert.equal(sim.coinCount, SETTINGS.coins.perLevel - 1);
  assert.ok(guard.state === 'investigate' || guard.state === 'search', 'guard state is ' + guard.state);
});

check('the van stays shut until the vault is cracked', () => {
  const input = makeHeadlessInput();
  const sim = createSim(0, 1, input, null);
  startRun(sim);
  sim.thief.x = sim.level.van.x;
  sim.thief.y = sim.level.van.y;
  stepSim(sim, 1 / 60);
  assert.equal(sim.state, 'playing');
  assert.equal(sim.exitOpen, false);
  sim.thief.x = sim.level.vault.x;
  sim.thief.y = sim.level.vault.y;
  stepSim(sim, 1 / 60);
  assert.equal(sim.vaultTaken, true);
  assert.equal(sim.exitOpen, true);
  sim.thief.x = sim.level.van.x;
  sim.thief.y = sim.level.van.y;
  stepSim(sim, 1 / 60);
  assert.equal(sim.state, 'clear');
});

check('getting caught costs a life and respawns the thief', () => {
  const input = makeHeadlessInput();
  const sim = createSim(0, 1, input, null);
  startRun(sim);
  const guard = sim.guards[0];
  sim.thief.x = guard.x + 10;
  sim.thief.y = guard.y;
  stepSim(sim, 1 / 60);
  assert.equal(sim.state, 'caught');
  assert.equal(sim.lives, SETTINGS.run.lives - 1);
  for (let i = 0; i < 120; i++) stepSim(sim, 1 / 60);
  assert.equal(sim.state, 'playing');
  assert.equal(sim.thief.x, sim.level.thiefStart.x);
});

check('shot scenes stage the expected states', () => {
  const start = stageScene('start', 1);
  assert.equal(start.state, 'title');
  const play = stageScene('play', 1);
  assert.equal(play.state, 'playing');
  assert.ok(thiefHidden(play), 'play shot thief is not hidden');
  const close = stageScene('close', 1);
  assert.equal(close.state, 'playing');
  assert.equal(close.alarm, 0.56);
  const end = stageScene('end', 1);
  assert.equal(end.state, 'clear');
  assert.ok(end.score > 1000, 'end score ' + end.score);
  assert.equal(end.everSeen, false);
});

check('the rng is deterministic for a fixed seed', () => {
  const a = makeRng(hashSeed('vaultbreak-test'));
  const b = makeRng(hashSeed('vaultbreak-test'));
  for (let i = 0; i < 50; i++) assert.equal(a.next(), b.next());
});

check('120 seconds of random chaos never crashes the sim', () => {
  const input = makeHeadlessInput();
  const sim = createSim(0, 7, input, null);
  startRun(sim);
  const rng = makeRng(99);
  const keys = ['KeyW', 'KeyA', 'KeyS', 'KeyD'];
  for (let i = 0; i < 120 * 60; i++) {
    if (i % 30 === 0) {
      for (const k of keys) input.release(k);
      input.press(keys[rng.int(keys.length)]);
      if (rng.chance(0.3)) input.press('ShiftLeft');
      else input.release('ShiftLeft');
      if (rng.chance(0.05)) input.clickAt(rng.range(0, 960), rng.range(0, 600));
    }
    stepSim(sim, 1 / 60);
    assert.ok(Number.isFinite(sim.thief.x) && Number.isFinite(sim.thief.y));
    assert.ok(sim.alarm >= 0 && sim.alarm <= 1);
    assert.ok(sim.lives >= 0 && sim.lives <= 3);
  }
  assert.ok(['playing', 'caught', 'clear', 'gameover', 'won'].includes(sim.state));
});

console.log('all ' + passed + ' tests passed');
