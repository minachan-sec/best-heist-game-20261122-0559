// VAULTBREAK renderer — draws the whole heist on a 2D canvas in logical 960x600 space.
// The caller sets the transform (scale + centering); everything here works in game pixels.

import { SETTINGS, PALETTE } from './config.js';
import { coneFan, tileCenter } from './world.js';

const W = SETTINGS.viewWidth;
const H = SETTINGS.viewHeight;
const T = SETTINGS.tile;

function drawFloor(ctx, sim) {
  const level = sim.level;
  for (let y = 0; y < level.rows; y++) {
    for (let x = 0; x < level.cols; x++) {
      const px = x * T;
      const py = y * T;
      const ch = level.grid[y][x];
      if (ch === '#') continue;
      ctx.fillStyle = (x + y) % 2 === 0 ? PALETTE.floorA : PALETTE.floorB;
      ctx.fillRect(px, py, T, T);
      ctx.strokeStyle = PALETTE.floorLine;
      ctx.lineWidth = 1;
      ctx.strokeRect(px + 0.5, py + 0.5, T - 1, T - 1);
      if (ch === ',') {
        ctx.fillStyle = PALETTE.shadow;
        ctx.globalAlpha = 0.72;
        ctx.fillRect(px + 2, py + 2, T - 4, T - 4);
        ctx.globalAlpha = 1;
      }
    }
  }
}

function drawWallsAndCases(ctx, sim) {
  const level = sim.level;
  for (let y = 0; y < level.rows; y++) {
    for (let x = 0; x < level.cols; x++) {
      const ch = level.grid[y][x];
      const px = x * T;
      const py = y * T;
      if (ch === '#') {
        ctx.fillStyle = PALETTE.wall;
        ctx.fillRect(px, py, T, T);
        ctx.fillStyle = PALETTE.wallTop;
        ctx.fillRect(px, py, T, 4);
      } else if (ch === 'D') {
        ctx.fillStyle = PALETTE.caseFrame;
        ctx.fillRect(px + 4, py + 4, T - 8, T - 8);
        ctx.fillStyle = PALETTE.caseGlass;
        ctx.globalAlpha = 0.55;
        ctx.fillRect(px + 8, py + 8, T - 16, T - 16);
        ctx.globalAlpha = 1;
        ctx.fillStyle = PALETTE.lootSmall;
        ctx.beginPath();
        ctx.arc(px + T / 2, py + T / 2, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

function drawLoot(ctx, sim) {
  for (const item of sim.level.loot) {
    if (item.taken) continue;
    const pulse = 1 + Math.sin(sim.time * 3 + item.x) * 0.12;
    ctx.save();
    ctx.translate(item.x, item.y);
    ctx.rotate(Math.PI / 4);
    const size = (item.kind === 'vault' ? 15 : item.kind === 'big' ? 11 : 8) * pulse;
    ctx.fillStyle = item.kind === 'vault' ? PALETTE.vault : item.kind === 'big' ? PALETTE.lootBig : PALETTE.lootSmall;
    ctx.fillRect(-size / 2, -size / 2, size, size);
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-size / 2, -size / 2, size, size);
    ctx.restore();
    if (item.kind === 'vault') {
      ctx.fillStyle = PALETTE.hudText;
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('VAULT', item.x, item.y - 22);
    }
  }
}

function drawVan(ctx, sim) {
  const van = sim.level.van;
  const glow = sim.exitOpen ? 0.5 + Math.sin(sim.time * 5) * 0.3 : 0.12;
  ctx.save();
  ctx.translate(van.x, van.y);
  ctx.globalAlpha = glow;
  ctx.fillStyle = PALETTE.van;
  ctx.beginPath();
  ctx.arc(0, 0, 30, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = sim.exitOpen ? PALETTE.van : PALETTE.vanDark;
  ctx.beginPath();
  ctx.roundRect(-20, -13, 40, 26, 6);
  ctx.fill();
  ctx.fillStyle = '#0d1120';
  ctx.fillRect(8, -9, 9, 18);
  ctx.fillStyle = PALETTE.hudText;
  ctx.font = 'bold 10px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(sim.exitOpen ? 'GO!' : 'VAN', 0, 26);
  ctx.restore();
}

function drawCoins(ctx, sim) {
  for (const coin of sim.coins) {
    ctx.fillStyle = PALETTE.lootSmall;
    ctx.beginPath();
    ctx.arc(coin.x, coin.y, coin.landed ? 4 : 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.stroke();
    if (!coin.landed) {
      ctx.strokeStyle = 'rgba(255,211,77,0.5)';
      ctx.beginPath();
      ctx.moveTo(coin.fromX, coin.fromY);
      ctx.lineTo(coin.x, coin.y);
      ctx.stroke();
    }
  }
}

function drawCone(ctx, sim, x, y, angle, halfAngle, distance, fill, edge) {
  const pts = coneFan(sim.level, x, y, angle, halfAngle, distance, 22);
  ctx.beginPath();
  ctx.moveTo(x, y);
  for (const p of pts) ctx.lineTo(p.x, p.y);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = edge;
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawGuards(ctx, sim) {
  for (const guard of sim.guards) {
    drawCone(
      ctx,
      sim,
      guard.x,
      guard.y,
      guard.dir,
      SETTINGS.guard.halfAngle,
      SETTINGS.guard.viewDistance,
      PALETTE.coneGuard,
      PALETTE.coneGuardEdge,
    );
  }
  for (const guard of sim.guards) {
    ctx.fillStyle = guard.state === 'chase' ? '#ff2e4d' : PALETTE.guard;
    ctx.beginPath();
    ctx.arc(guard.x, guard.y, SETTINGS.guard.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = PALETTE.guardDark;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(guard.x, guard.y);
    ctx.lineTo(guard.x + Math.cos(guard.dir) * 18, guard.y + Math.sin(guard.dir) * 18);
    ctx.stroke();
    if (guard.state === 'chase') {
      ctx.fillStyle = '#ff2e4d';
      ctx.font = 'bold 20px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('!', guard.x, guard.y - 20);
    } else if (guard.suspicion > 0.35) {
      ctx.fillStyle = PALETTE.lootSmall;
      ctx.font = 'bold 18px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('?', guard.x, guard.y - 20);
      ctx.fillStyle = 'rgba(255,211,77,0.8)';
      ctx.fillRect(guard.x - 14, guard.y - 30, 28 * Math.min(1, guard.suspicion), 3);
    }
  }
}

function drawCameras(ctx, sim) {
  for (const camera of sim.cameras) {
    drawCone(
      ctx,
      sim,
      camera.x,
      camera.y,
      camera.angle,
      SETTINGS.camera.halfAngle,
      SETTINGS.camera.viewDistance,
      PALETTE.coneCamera,
      PALETTE.coneCameraEdge,
    );
  }
  for (const camera of sim.cameras) {
    ctx.save();
    ctx.translate(camera.x, camera.y);
    ctx.rotate(camera.angle);
    ctx.fillStyle = PALETTE.cameraBody;
    ctx.beginPath();
    ctx.roundRect(-6, -6, 16, 12, 3);
    ctx.fill();
    ctx.fillStyle = '#0d1120';
    ctx.beginPath();
    ctx.arc(10, 0, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawThief(ctx, sim) {
  const t = sim.thief;
  const bob = t.moving ? Math.sin(sim.time * 12) * 1.5 : 0;
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(t.x, t.y + 12, 12, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = PALETTE.thief;
  ctx.beginPath();
  ctx.arc(t.x, t.y + bob, SETTINGS.thief.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = PALETTE.thiefDark;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(t.x, t.y + bob);
  ctx.lineTo(t.x + Math.cos(t.dir) * 17, t.y + bob + Math.sin(t.dir) * 17);
  ctx.stroke();
  ctx.fillStyle = '#0d1120';
  ctx.beginPath();
  ctx.arc(t.x - 4, t.y + bob - 3, 2, 0, Math.PI * 2);
  ctx.arc(t.x + 4, t.y + bob - 3, 2, 0, Math.PI * 2);
  ctx.fill();
}

function drawHud(ctx, sim) {
  ctx.fillStyle = 'rgba(5, 7, 15, 0.82)';
  ctx.fillRect(0, 0, W, 34);
  ctx.fillStyle = PALETTE.hudText;
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('SCORE ' + sim.score, 12, 22);
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.hudDim;
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillText(sim.level.name.toUpperCase() + '  ·  LEVEL ' + (sim.levelIndex + 1) + '/3', W / 2, 21);
  ctx.textAlign = 'right';
  ctx.fillText('♥'.repeat(Math.max(0, sim.lives)) + '  COINS ' + sim.coinCount, W - 12, 22);

  const bw = 260;
  const bx = W / 2 - bw / 2;
  const by = 40;
  ctx.fillStyle = PALETTE.alarmBack;
  ctx.beginPath();
  ctx.roundRect(bx, by, bw, 12, 6);
  ctx.fill();
  const alarm = sim.alarm;
  const flashing = alarm > 0.75 && Math.sin(sim.time * 10) > 0;
  ctx.fillStyle = flashing ? '#ff8fa3' : PALETTE.alarmFill;
  if (alarm > 0.01) {
    ctx.beginPath();
    ctx.roundRect(bx, by, Math.max(12, bw * alarm), 12, 6);
    ctx.fill();
  }
  ctx.fillStyle = PALETTE.hudText;
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(sim.lockdownT > 0 ? 'LOCKDOWN' : 'ALARM', W / 2, by + 26);

  if (!sim.everSeen && sim.state === 'playing') {
    ctx.fillStyle = PALETTE.ok;
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('GHOST', 12, 58);
  }
  if (sim.banner) {
    ctx.fillStyle = sim.banner.includes('LOCKDOWN') || sim.banner.includes('CAUGHT') ? PALETTE.banner : PALETTE.title;
    ctx.font = 'bold 26px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(sim.banner, W / 2, 110);
  }
}

function centerBox(ctx, title, lines, accent) {
  ctx.fillStyle = 'rgba(5, 7, 15, 0.78)';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = accent || PALETTE.title;
  ctx.font = 'bold 52px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(title, W / 2, H / 2 - 60);
  ctx.fillStyle = PALETTE.hudText;
  ctx.font = '17px system-ui, sans-serif';
  lines.forEach((line, i) => {
    ctx.fillText(line, W / 2, H / 2 - 16 + i * 26);
  });
}

export function drawScene(ctx, sim) {
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#05070f';
  ctx.fillRect(0, 0, W, H);
  drawFloor(ctx, sim);
  drawLoot(ctx, sim);
  drawVan(ctx, sim);
  drawCameras(ctx, sim);
  drawGuards(ctx, sim);
  drawCoins(ctx, sim);
  drawThief(ctx, sim);
  drawWallsAndCases(ctx, sim);
  drawHud(ctx, sim);

  if (sim.state === 'title') {
    centerBox(
      ctx,
      'VAULTBREAK',
      [
        sim.level.name + ' — ' + sim.level.sub,
        'WASD / arrows to move · Shift to run · click to throw a coin',
        'Grab the vault, reach the green van. Stay out of the cones.',
        'Press ENTER or click to start the heist',
      ],
      PALETTE.title,
    );
  } else if (sim.state === 'caught') {
    centerBox(ctx, 'CAUGHT!', ['A guard grabbed you. ' + sim.lives + ' lives left.', ''], PALETTE.banner);
  } else if (sim.state === 'clear') {
    centerBox(
      ctx,
      'LEVEL CLEAR',
      [
        'Score: ' + sim.score,
        sim.everSeen ? 'Spotted — no ghost bonus this time.' : 'GHOST — never seen. +500 bonus banked.',
        'Next floor loading…',
      ],
      PALETTE.ok,
    );
  } else if (sim.state === 'gameover') {
    centerBox(
      ctx,
      'GAME OVER',
      ['The crew got pinched. Final score: ' + sim.score, 'Press R to run it back.'],
      PALETTE.banner,
    );
  } else if (sim.state === 'won') {
    centerBox(
      ctx,
      'THE PERFECT HEIST',
      [
        'All three vaults cracked. Final score: ' + sim.score,
        sim.everSeen ? 'A clean getaway, mostly.' : 'GHOST RUN — never seen once. Legendary.',
        'Press R to play again.',
      ],
      PALETTE.ok,
    );
  }
}
