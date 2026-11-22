// VAULTBREAK headless checks (node test.mjs). No browser needed: the world
// simulation is pure JS, so Node can drive it straight.
//   1. syntax: every game module parses (node --check does this separately)
//   2. chaos: 120s of random steering + running + coin throws, no crash, no NaN
//   3. autopilot: BFS drive through level 1 loot -> van clears the level
//   4. lockdown: park the thief in a camera cone until the meter trips
//   5. coin: a thrown coin lands, makes noise, spends one coin
//   6. caught: a guard placed on the thief catches them, lives drop, retry works
import { createRandom } from './game/src/random.js';
import {
  createWorld, findPath, EVENT_CAUGHT, EVENT_CLEAR, EVENT_COIN, EVENT_LOCKDOWN,
  EVENT_LOOT, EVENT_OVER, G_ALERT,
} from './game/src/world.js';
import { STEP, TILE, LEVELS } from './game/src/config.js';

let failures = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures += 1;
}
function saneNumber(n) { return typeof n === 'number' && Number.isFinite(n); }
function worldSane(w) {
  const s = w.state;
  return saneNumber(s.player.x) && saneNumber(s.player.y)
    && s.guards.every((g) => saneNumber(g.x) && saneNumber(g.y) && saneNumber(g.suspicion))
    && s.cameras.every((c) => saneNumber(c.angle) && saneNumber(c.seeing))
    && saneNumber(s.alarm) && saneNumber(s.camAlarm) && saneNumber(s.score);
}

// 2. Chaos: 120 seconds of random input.
{
  const w = createWorld(createRandom(7));
  const rng = createRandom(99);
  let events = 0;
  let steps = 0;
  for (let t = 0; t < 120; t += STEP) {
    const ang = rng() * Math.PI * 2;
    const move = rng() < 0.7 ? { x: Math.cos(ang), y: Math.sin(ang) } : { x: 0, y: 0 };
    const run = rng() < 0.3;
    const throwAt = rng() < 0.02 ? { x: rng() * 1280, y: rng() * 720 } : null;
    events |= w.step(STEP, move, run, throwAt);
    steps += 1;
    if (w.state.cleared || w.state.lives <= 0) { w.reset(); }
  }
  check('chaos 120s: no crash, world stays sane', worldSane(w), `${steps} steps, events=${events}`);
}

// 3. Autopilot clears level 1: loot then van.
{
  const w = createWorld(createRandom(1));
  const s = w.state;
  const driveTo = (tx, ty, maxSeconds) => {
    let path = [];
    for (let t = 0; t < maxSeconds / STEP; t += 1) {
      if (s.cleared || s.caught) return;
      if (path.length === 0) {
        path = findPath(s.level, s.player.x, s.player.y, tx * TILE + 20, ty * TILE + 20);
        if (path.length === 0) return;
      }
      const next = path[0];
      const dx = next.x - s.player.x;
      const dy = next.y - s.player.y;
      const d = Math.hypot(dx, dy);
      if (d < 6) { path.shift(); continue; }
      // Wait out a suspicious guard instead of walking into its cone.
      const hot = s.guards.some((g) => g.suspicion > 0.12 || Math.hypot(g.x - s.player.x, g.y - s.player.y) < 110);
      if (hot) { w.step(STEP, { x: 0, y: 0 }, false, null); continue; }
      w.step(STEP, { x: dx / d, y: dy / d }, false, null);
    }
  };
  driveTo(25, 1, 60);
  const lootTaken = s.loot.filter((i) => i.taken).length;
  driveTo(27, 16, 90);
  check('autopilot level 1: loot taken then exit reached', s.cleared && lootTaken === s.loot.length,
    `cleared=${s.cleared} loot=${lootTaken}/${s.loot.length} score=${s.score} lives=${s.lives}`);
}

// 4. Lockdown: stand in a camera cone until the meter trips.
{
  const w = createWorld(createRandom(1));
  const s = w.state;
  const cam = s.cameras[0];
  // Stand 120px down-cone from the camera origin, in the open.
  s.player.x = cam.ox;
  s.player.y = cam.oy + 120;
  let locked = false;
  for (let t = 0; t < 30; t += STEP) {
    const ev = w.step(STEP, { x: 0, y: 0 }, false, null);
    if (ev & EVENT_LOCKDOWN) { locked = true; break; }
  }
  const allAlert = s.guards.every((g) => g.state === G_ALERT);
  check('lockdown: full camera meter trips lockdown, all guards alert', locked && allAlert,
    `locked=${locked} allAlert=${allAlert} camAlarm=${s.camAlarm.toFixed(2)}`);
}

// 5. Coin throw.
{
  const w = createWorld(createRandom(1));
  const s = w.state;
  const before = s.coins;
  let coinEvent = false;
  let noiseSeen = false;
  const ev0 = w.step(STEP, { x: 0, y: 0 }, false, { x: s.player.x + 200, y: s.player.y });
  if (ev0 & EVENT_COIN) coinEvent = true;
  for (let t = 0; t < 2; t += STEP) {
    const ev = w.step(STEP, { x: 0, y: 0 }, false, null);
    if (ev & EVENT_COIN) coinEvent = true;
    if (s.noises.length > 0) noiseSeen = true;
  }
  check('coin: thrown, lands with noise, spends one coin',
    coinEvent && noiseSeen && s.coins === before - 1 && !s.coinFlight,
    `coins ${before}->${s.coins}`);
}

// 6. Caught + retry.
{
  const w = createWorld(createRandom(1));
  const s = w.state;
  const g = s.guards[0];
  g.state = G_ALERT;
  g.suspicion = 1;
  g.target = { x: s.player.x, y: s.player.y };
  g.path = [{ x: s.player.x, y: s.player.y }];
  let caughtEvent = false;
  for (let t = 0; t < 5; t += STEP) {
    const ev = w.step(STEP, { x: 0, y: 0 }, false, null);
    if (ev & EVENT_CAUGHT) { caughtEvent = true; break; }
  }
  const livesAfter = s.lives;
  w.retryLevel();
  check('caught: guard catches thief, life lost, retry reloads level',
    caughtEvent && livesAfter === 2 && !w.state.caught && w.state.levelIndex === 0,
    `caught=${caughtEvent} lives=${livesAfter} afterRetryCaught=${w.state.caught}`);
}

// 7. Every level parses and has the pieces it needs.
{
  let ok = true;
  let detail = '';
  for (let i = 0; i < LEVELS.length; i += 1) {
    const w = createWorld(createRandom(1));
    w.loadLevel(i);
    const s = w.state;
    const hasStart = s.player.x > 0 && s.player.y > 0;
    const hasLoot = s.loot.length > 0;
    const hasExit = s.exit.x > 0 && s.exit.y > 0;
    const hasGuards = s.guards.length > 0;
    const hasCams = s.cameras.length > 0;
    if (!hasStart || !hasLoot || !hasExit || !hasGuards || !hasCams) {
      ok = false;
      detail += ` L${i + 1}: start=${hasStart} loot=${hasLoot} exit=${hasExit} guards=${hasGuards} cams=${hasCams}`;
    }
  }
  check('levels: all 3 load with start, loot, exit, guards, cameras', ok, detail || '3/3 complete');
}

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
