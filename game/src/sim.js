// VAULTBREAK sim — the whole heist as pure data + one step function.
// No DOM in here: the browser shell (main.js) and the tests both drive this file.
// State machine: title -> playing -> caught -> playing ... -> clear -> playing -> won,
// or playing -> gameover. Lockdown trips when the alarm meter fills.

import { SETTINGS } from './config.js';
import { makeRng, hashSeed } from './random.js';
import {
  LEVELS,
  buildLevel,
  tileAt,
  tileCenter,
  slideMove,
  inCone,
  angleDiff,
} from './world.js';

const T = SETTINGS.tile;

export function thiefHidden(sim) {
  return tileAt(sim.level, sim.thief.x, sim.thief.y) === ',';
}

function guardSeesThief(sim, guard) {
  const dx = sim.thief.x - guard.x;
  const dy = sim.thief.y - guard.y;
  const dist = Math.hypot(dx, dy);
  if (dist > SETTINGS.guard.viewDistance) return false;
  if (thiefHidden(sim) && dist > SETTINGS.guard.shadowSpotRadius) return false;
  return inCone(
    sim.level,
    guard.x,
    guard.y,
    guard.dir,
    SETTINGS.guard.halfAngle,
    SETTINGS.guard.viewDistance,
    sim.thief.x,
    sim.thief.y,
  );
}

function cameraSeesThief(sim, camera) {
  const dx = sim.thief.x - camera.x;
  const dy = sim.thief.y - camera.y;
  const dist = Math.hypot(dx, dy);
  if (dist > SETTINGS.camera.viewDistance) return false;
  if (thiefHidden(sim) && dist > SETTINGS.guard.shadowSpotRadius) return false;
  return inCone(
    sim.level,
    camera.x,
    camera.y,
    camera.angle,
    SETTINGS.camera.halfAngle,
    SETTINGS.camera.viewDistance,
    sim.thief.x,
    sim.thief.y,
  );
}

function moveToward(sim, body, tx, ty, speed, dt) {
  const dx = tx - body.x;
  const dy = ty - body.y;
  const d = Math.hypot(dx, dy);
  if (d < 1) return true;
  const step = Math.min(d, speed * dt);
  const nx = body.x + (dx / d) * step;
  const ny = body.y + (dy / d) * step;
  const moved = slideMove(sim.level, body.x, body.y, nx - body.x, ny - body.y, SETTINGS.guard.radius);
  body.dir = Math.atan2(ny - body.y, nx - body.x);
  body.x = moved.x;
  body.y = moved.y;
  return d <= 8;
}

export function makeGuard(spawn, route) {
  return {
    x: spawn.x,
    y: spawn.y,
    dir: 0,
    route: route.map((p) => tileCenter(p.cx, p.cy)),
    wp: 0,
    state: 'patrol',
    stateT: 0,
    suspicion: 0,
    lastSeen: { x: spawn.x, y: spawn.y },
    target: null,
    scanDir: 1,
  };
}

export function makeCamera(mount, spec) {
  return {
    x: mount.x,
    y: mount.y,
    base: spec.base,
    arc: spec.arc,
    speed: spec.speed,
    phase: spec.phase,
    angle: spec.base,
  };
}

export function createSim(levelIndex, seed, input, audio) {
  const def = LEVELS[levelIndex];
  const level = buildLevel(def);
  const sim = {
    seed,
    rng: makeRng(hashSeed('vaultbreak-' + levelIndex + '-' + seed)),
    levelIndex,
    level,
    def,
    thief: {
      x: level.thiefStart.x,
      y: level.thiefStart.y,
      dir: 0,
      moving: false,
      running: false,
    },
    guards: [],
    cameras: [],
    coins: [],
    coinCount: SETTINGS.coins.perLevel,
    alarm: 0,
    lockdownT: 0,
    score: 0,
    lives: SETTINGS.run.lives,
    vaultTaken: false,
    exitOpen: false,
    state: 'title',
    stateT: 0,
    detections: 0,
    everSeen: false,
    time: 0,
    input: input || null,
    audio: audio || null,
    banner: '',
    bannerT: 0,
  };
  sim.guards = level.guardSpawns.map((spawn, i) => makeGuard(spawn, def.guardRoutes[i]));
  sim.cameras = level.cameraMounts.map((mount, i) => makeCamera(mount, def.cameraSpecs[i]));
  return sim;
}

export function startRun(sim) {
  sim.state = 'playing';
  sim.stateT = 0;
  sim.banner = '';
}

function loadLevel(sim, levelIndex) {
  const def = LEVELS[levelIndex];
  sim.levelIndex = levelIndex;
  sim.def = def;
  sim.level = buildLevel(def);
  sim.thief.x = sim.level.thiefStart.x;
  sim.thief.y = sim.level.thiefStart.y;
  sim.thief.dir = 0;
  sim.guards = sim.level.guardSpawns.map((spawn, i) => makeGuard(spawn, def.guardRoutes[i]));
  sim.cameras = sim.level.cameraMounts.map((mount, i) => makeCamera(mount, def.cameraSpecs[i]));
  sim.coins = [];
  sim.coinCount = SETTINGS.coins.perLevel;
  sim.alarm = 0;
  sim.lockdownT = 0;
  sim.vaultTaken = false;
  sim.exitOpen = false;
  sim.everSeen = false;
  sim.state = 'playing';
  sim.stateT = 0;
  sim.banner = '';
}

function respawn(sim) {
  sim.thief.x = sim.level.thiefStart.x;
  sim.thief.y = sim.level.thiefStart.y;
  sim.thief.dir = 0;
  for (let i = 0; i < sim.guards.length; i++) {
    const spawn = sim.level.guardSpawns[i];
    const g = sim.guards[i];
    g.x = spawn.x;
    g.y = spawn.y;
    g.state = 'patrol';
    g.stateT = 0;
    g.suspicion = 0;
    g.wp = 0;
  }
  sim.coins = [];
  sim.alarm = 0.3;
  sim.lockdownT = 0;
  sim.state = 'playing';
  sim.stateT = 0;
  sim.banner = '';
}

function setBanner(sim, text, seconds) {
  sim.banner = text;
  sim.bannerT = seconds;
}

function updateThief(sim, dt) {
  const pad = sim.input;
  if (!pad) return;
  const axis = pad.axis();
  const running = pad.running();
  const speed = running ? SETTINGS.thief.runSpeed : SETTINGS.thief.walkSpeed;
  const dx = axis.x * speed * dt;
  const dy = axis.y * speed * dt;
  const moved = slideMove(sim.level, sim.thief.x, sim.thief.y, dx, dy, SETTINGS.thief.radius);
  sim.thief.moving = dx !== 0 || dy !== 0;
  sim.thief.running = running && sim.thief.moving;
  if (sim.thief.moving) sim.thief.dir = Math.atan2(dy, dx);
  sim.thief.x = moved.x;
  sim.thief.y = moved.y;

  const click = pad.takeClick();
  if (click && sim.coinCount > 0) {
    sim.coinCount -= 1;
    sim.coins.push({
      fromX: sim.thief.x,
      fromY: sim.thief.y,
      toX: Math.max(0, Math.min(SETTINGS.viewWidth, click.x)),
      toY: Math.max(0, Math.min(SETTINGS.viewHeight, click.y)),
      t: 0,
      landed: false,
      landT: 0,
      x: sim.thief.x,
      y: sim.thief.y,
    });
    if (sim.audio) sim.audio.coin();
  }
}

function updateCoins(sim, dt) {
  for (const coin of sim.coins) {
    if (!coin.landed) {
      coin.t += dt / SETTINGS.coins.throwSeconds;
      if (coin.t >= 1) {
        coin.t = 1;
        coin.landed = true;
        coin.landT = 0;
        if (sim.audio) sim.audio.coinLand();
        for (const guard of sim.guards) {
          const d = Math.hypot(guard.x - coin.x, guard.y - coin.y);
          if (d < SETTINGS.coins.hearRadius && guard.state !== 'chase') {
            guard.state = 'investigate';
            guard.stateT = 0;
            guard.target = { x: coin.x, y: coin.y };
          }
        }
      }
      coin.x = coin.fromX + (coin.toX - coin.fromX) * coin.t;
      coin.y = coin.fromY + (coin.toY - coin.fromY) * coin.t;
    } else {
      coin.landT += dt;
    }
  }
  sim.coins = sim.coins.filter((c) => !c.landed || c.landT < 1.2);
}

function updateGuards(sim, dt) {
  for (const guard of sim.guards) {
    guard.stateT += dt;
    const sees = guardSeesThief(sim, guard);
    if (sees) {
      guard.lastSeen = { x: sim.thief.x, y: sim.thief.y };
      sim.everSeen = true;
      if (guard.state !== 'chase') {
        guard.suspicion += SETTINGS.guard.suspicionRate * dt;
        if (guard.suspicion >= 1) {
          guard.state = 'chase';
          guard.stateT = 0;
          sim.detections += 1;
          setBanner(sim, 'SPOTTED!', 1.2);
        } else if (guard.suspicion > 0.4 && guard.state === 'patrol') {
          guard.state = 'suspicious';
          guard.stateT = 0;
        }
      }
    } else if (guard.state !== 'chase') {
      guard.suspicion = Math.max(0, guard.suspicion - SETTINGS.guard.suspicionDecay * dt);
      if (guard.state === 'suspicious' && guard.suspicion < 0.15) {
        guard.state = 'patrol';
        guard.stateT = 0;
      }
    }

    // Running nearby is loud: guards turn toward the noise.
    if (sim.thief.running && sim.thief.moving && guard.state === 'patrol') {
      const d = Math.hypot(guard.x - sim.thief.x, guard.y - sim.thief.y);
      if (d < SETTINGS.thief.runNoiseRadius) {
        guard.suspicion = Math.min(1, guard.suspicion + 0.5 * dt);
      }
    }

    if (sim.lockdownT > 0) {
      guard.lastSeen = { x: sim.thief.x, y: sim.thief.y };
      if (guard.state !== 'chase') {
        guard.state = 'chase';
        guard.stateT = 0;
      }
    }

    if (guard.state === 'patrol') {
      const wp = guard.route[guard.wp];
      if (moveToward(sim, guard, wp.x, wp.y, SETTINGS.guard.patrolSpeed, dt)) {
        guard.wp = (guard.wp + 1) % guard.route.length;
      }
    } else if (guard.state === 'suspicious') {
      guard.dir += angleDiff(Math.atan2(sim.thief.y - guard.y, sim.thief.x - guard.x), guard.dir) * Math.min(1, dt * 6);
    } else if (guard.state === 'investigate') {
      if (guard.target) {
        if (moveToward(sim, guard, guard.target.x, guard.target.y, SETTINGS.guard.investigateSpeed, dt)) {
          guard.state = 'search';
          guard.stateT = 0;
        }
      } else {
        guard.state = 'search';
        guard.stateT = 0;
      }
    } else if (guard.state === 'chase') {
      if (sees) guard.stateT = 0;
      moveToward(sim, guard, guard.lastSeen.x, guard.lastSeen.y, SETTINGS.guard.chaseSpeed, dt);
      if (!sees && guard.stateT > SETTINGS.guard.chaseMemory) {
        guard.state = 'search';
        guard.stateT = 0;
      }
    } else if (guard.state === 'search') {
      guard.dir += guard.scanDir * dt * 1.4;
      if (guard.stateT > SETTINGS.guard.searchTime) {
        guard.state = 'return';
        guard.stateT = 0;
        guard.scanDir *= -1;
      }
    } else if (guard.state === 'return') {
      let best = guard.route[0];
      let bestD = Infinity;
      for (const wp of guard.route) {
        const d = Math.hypot(wp.x - guard.x, wp.y - guard.y);
        if (d < bestD) {
          bestD = d;
          best = wp;
        }
      }
      if (moveToward(sim, guard, best.x, best.y, SETTINGS.guard.patrolSpeed, dt)) {
        guard.wp = guard.route.indexOf(best);
        guard.state = 'patrol';
        guard.stateT = 0;
      }
    }
  }
}

function updateCameras(sim, dt) {
  for (const camera of sim.cameras) {
    camera.angle = camera.base + Math.sin(sim.time * camera.speed + camera.phase) * camera.arc;
  }
}

function updateAlarm(sim, dt) {
  let anyGuard = false;
  let anyCamera = false;
  for (const guard of sim.guards) {
    if (guardSeesThief(sim, guard)) anyGuard = true;
  }
  for (const camera of sim.cameras) {
    if (cameraSeesThief(sim, camera)) anyCamera = true;
  }
  if (sim.lockdownT > 0) {
    sim.lockdownT -= dt;
    sim.alarm = 1;
    if (sim.lockdownT <= 0) {
      sim.alarm = SETTINGS.alarm.afterLockdown;
      setBanner(sim, 'Lockdown over — move!', 1.5);
    }
    return;
  }
  if (anyGuard || anyCamera) {
    const rate = Math.max(
      anyGuard ? SETTINGS.alarm.guardSeenRate : 0,
      anyCamera ? SETTINGS.camera.seenRate : 0,
    );
    sim.alarm = Math.min(1, sim.alarm + rate * dt);
    if (sim.audio) sim.audio.alarmTick(Date.now());
    if (sim.alarm >= 1) {
      sim.lockdownT = SETTINGS.alarm.lockdownSeconds;
      setBanner(sim, 'LOCKDOWN!', 2);
    }
  } else {
    sim.alarm = Math.max(0, sim.alarm - SETTINGS.alarm.decayRate * dt);
  }
}

function updateLoot(sim) {
  for (const item of sim.level.loot) {
    if (item.taken) continue;
    const d = Math.hypot(item.x - sim.thief.x, item.y - sim.thief.y);
    if (d < SETTINGS.run.pickupRadius) {
      item.taken = true;
      sim.score += item.value;
      if (item.kind === 'vault') {
        sim.vaultTaken = true;
        sim.exitOpen = true;
        setBanner(sim, 'VAULT CRACKED — get to the van!', 2);
        if (sim.audio) sim.audio.vault();
      } else if (sim.audio) {
        sim.audio.pickup();
      }
    }
  }
}

function checkVan(sim) {
  if (!sim.exitOpen || sim.lockdownT > 0) return;
  const d = Math.hypot(sim.level.van.x - sim.thief.x, sim.level.van.y - sim.thief.y);
  if (d < SETTINGS.run.vanRadius) {
    const bonus = SETTINGS.run.clearBonusBase + SETTINGS.run.clearBonusPerLevel * sim.levelIndex;
    sim.score += bonus;
    if (!sim.everSeen) {
      sim.score += SETTINGS.run.ghostBonus;
      setBanner(sim, 'LEVEL CLEAR — GHOST BONUS!', 2);
    } else {
      setBanner(sim, 'LEVEL CLEAR!', 2);
    }
    sim.state = 'clear';
    sim.stateT = 0;
    if (sim.audio) sim.audio.clear();
  }
}

function checkCaught(sim) {
  for (const guard of sim.guards) {
    const d = Math.hypot(guard.x - sim.thief.x, guard.y - sim.thief.y);
    if (d < SETTINGS.guard.catchRadius) {
      sim.lives -= 1;
      if (sim.audio) sim.audio.caught();
      if (sim.lives <= 0) {
        sim.state = 'gameover';
        sim.stateT = 0;
      } else {
        sim.state = 'caught';
        sim.stateT = 0;
        setBanner(sim, 'CAUGHT!', 1.4);
      }
      return;
    }
  }
}

export function stepSim(sim, dt) {
  sim.time += dt;
  sim.stateT += dt;
  if (sim.bannerT > 0) sim.bannerT -= dt;
  if (sim.bannerT <= 0) sim.banner = '';

  updateCameras(sim, dt);

  if (sim.state === 'title') return;
  if (sim.state === 'caught') {
    if (sim.stateT > 1.4) respawn(sim);
    return;
  }
  if (sim.state === 'clear') {
    if (sim.stateT > 1.8) {
      if (sim.levelIndex + 1 >= LEVELS.length) {
        sim.state = 'won';
        sim.stateT = 0;
      } else {
        loadLevel(sim, sim.levelIndex + 1);
      }
    }
    return;
  }
  if (sim.state === 'gameover' || sim.state === 'won') return;

  updateThief(sim, dt);
  updateCoins(sim, dt);
  updateGuards(sim, dt);
  updateAlarm(sim, dt);
  updateLoot(sim);
  checkVan(sim);
  checkCaught(sim);
}
