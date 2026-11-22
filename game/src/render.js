// The renderer: a top-down night heist on one canvas. The playfield is a fixed
// 1280x720 logical area scaled to the window; guards get vision cones clipped by
// walls (a fan of rays, each marched until it hits something), cameras sweep cyan
// cones across the floor, and the HUD shows the loot, the alarm meter and the level.

import { CAMERA, COLS, FIELD, FONT, GUARD, PALETTE, ROWS, TILE } from './config.js';
import { G_ALERT } from './world.js';

export const SCREEN_TITLE = 0;
export const SCREEN_PLAY = 1;
export const SCREEN_PAUSED = 2;
export const SCREEN_CAUGHT = 3;
export const SCREEN_CLEAR = 4;
export const SCREEN_OVER = 5;
export const SCREEN_WIN = 6;

const CONE_RAYS = 26;

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let scale = 1;
  let offsetX = 0;
  let offsetY = 0;

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    scale = Math.min(w / FIELD.width, h / FIELD.height) * dpr;
    offsetX = (w * dpr - FIELD.width * scale) / 2;
    offsetY = (h * dpr - FIELD.height * scale) / 2;
  }
  resize();
  window.addEventListener('resize', resize);

  /** Convert a client (mouse) point to field coordinates. */
  function toField(clientX, clientY) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) * dpr - offsetX) / scale,
      y: ((clientY - rect.top) * dpr - offsetY) / scale,
    };
  }

  function tileIs(level, tx, ty, chars) {
    if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return false;
    return chars.includes(level.map[ty][tx]);
  }

  /** A vision cone as a polygon: rays fanned across the field of view, each stopped by a wall. */
  function conePolygon(level, x, y, angle, viewAngle, viewRange) {
    const points = [];
    for (let i = 0; i <= CONE_RAYS; i += 1) {
      const a = angle - viewAngle / 2 + (viewAngle * i) / CONE_RAYS;
      let r = viewRange;
      for (let d = 12; d <= viewRange; d += 8) {
        const px = x + Math.cos(a) * d;
        const py = y + Math.sin(a) * d;
        if (tileIs(level, Math.floor(px / TILE), Math.floor(py / TILE), '#C')) {
          r = d;
          break;
        }
      }
      points.push({ x: x + Math.cos(a) * r, y: y + Math.sin(a) * r });
    }
    return points;
  }

  function drawLevel(state) {
    const level = state.level;
    for (let y = 0; y < ROWS; y += 1) {
      for (let x = 0; x < COLS; x += 1) {
        const c = level.map[y][x];
        const px = x * TILE;
        const py = y * TILE;
        ctx.fillStyle = (x + y) % 2 === 0 ? PALETTE.floorA : PALETTE.floorB;
        ctx.fillRect(px, py, TILE, TILE);
        if (c === '#') {
          ctx.fillStyle = PALETTE.wall;
          ctx.fillRect(px + 1, py + 1, TILE - 2, TILE - 2);
          ctx.fillStyle = PALETTE.wallTop;
          ctx.fillRect(px + 1, py + 1, TILE - 2, 7);
          ctx.fillStyle = PALETTE.wallEdge;
          ctx.fillRect(px + 1, py + TILE - 4, TILE - 2, 3);
        } else if (c === 'C') {
          ctx.fillStyle = PALETTE.crate;
          ctx.fillRect(px + 5, py + 5, TILE - 10, TILE - 10);
          ctx.fillStyle = PALETTE.crateTop;
          ctx.fillRect(px + 5, py + 5, TILE - 10, 6);
          ctx.strokeStyle = 'rgba(0,0,0,0.35)';
          ctx.strokeRect(px + 5.5, py + 5.5, TILE - 11, TILE - 11);
        } else if (c === 'S') {
          ctx.fillStyle = PALETTE.shadow;
          ctx.fillRect(px, py, TILE, TILE);
          ctx.fillStyle = PALETTE.shadowLeaf;
          ctx.beginPath();
          ctx.arc(px + 12, py + 14, 9, 0, Math.PI * 2);
          ctx.arc(px + 27, py + 11, 8, 0, Math.PI * 2);
          ctx.arc(px + 20, py + 27, 9, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = PALETTE.shadowLeaf2;
          ctx.beginPath();
          ctx.arc(px + 12, py + 12, 4, 0, Math.PI * 2);
          ctx.arc(px + 27, py + 9, 3.5, 0, Math.PI * 2);
          ctx.arc(px + 20, py + 25, 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    // The getaway van: red and barred while the loot is not all taken, green once open.
    const e = state.exit;
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.fillStyle = state.exitOpen ? PALETTE.exitOpen : PALETTE.exitLocked;
    ctx.globalAlpha = 0.25 + 0.12 * Math.sin(state.time * 3);
    ctx.beginPath();
    ctx.arc(0, 0, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    // Van body with a cab, two wheels and a door line.
    ctx.fillStyle = state.exitOpen ? '#0d3a2c' : '#3a1210';
    ctx.fillRect(-17, -13, 34, 26);
    ctx.fillStyle = state.exitOpen ? PALETTE.exitOpen : PALETTE.exitLocked;
    ctx.fillRect(-17, -13, 34, 5);
    ctx.fillStyle = '#101418';
    ctx.beginPath();
    ctx.arc(-9, 14, 5, 0, Math.PI * 2);
    ctx.arc(9, 14, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.text;
    ctx.font = `700 10px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(state.exitOpen ? 'VAN' : 'LOCK', 0, 1);
    ctx.restore();
    // Loot glows gold until taken: a stack of bars.
    for (const item of state.loot) {
      if (item.taken) continue;
      ctx.save();
      ctx.translate(item.x, item.y + Math.sin(state.time * 2.4 + item.x) * 2);
      ctx.fillStyle = PALETTE.loot;
      ctx.globalAlpha = 0.25;
      ctx.beginPath();
      ctx.arc(0, 0, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#fff3c4';
      ctx.fillRect(-11, -4, 22, 8);
      ctx.fillStyle = PALETTE.loot;
      ctx.fillRect(-11, -4, 22, 3);
      ctx.fillStyle = '#8a7a2a';
      ctx.fillRect(-8, 0, 16, 2);
      ctx.fillStyle = '#fff3c4';
      ctx.fillRect(-8, -9, 16, 5);
      ctx.fillStyle = PALETTE.loot;
      ctx.fillRect(-8, -9, 16, 2);
      ctx.restore();
    }
  }

  function drawCones(state) {
    // Guard cones: amber while calm, red while alert.
    for (const g of state.guards) {
      const alert = g.state === G_ALERT || g.suspicion > 0.6;
      const poly = conePolygon(state.level, g.x, g.y, g.angle, GUARD.viewAngle, GUARD.viewRange);
      const grad = ctx.createRadialGradient(g.x, g.y, 10, g.x, g.y, GUARD.viewRange);
      grad.addColorStop(0, alert ? 'rgba(229, 83, 75, 0.42)' : 'rgba(242, 201, 76, 0.30)');
      grad.addColorStop(1, alert ? 'rgba(229, 83, 75, 0.06)' : 'rgba(242, 201, 76, 0.05)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(g.x, g.y);
      for (const pt of poly) ctx.lineTo(pt.x, pt.y);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = alert ? PALETTE.coneAlertEdge : PALETTE.coneCalmEdge;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    // Camera cones: cyan, sweeping back and forth, cast from the wall's room-side edge.
    for (const cam of state.cameras) {
      const hot = cam.seeing > 0;
      const poly = conePolygon(state.level, cam.ox, cam.oy, cam.angle, CAMERA.viewAngle, CAMERA.viewRange);
      const grad = ctx.createRadialGradient(cam.ox, cam.oy, 8, cam.ox, cam.oy, CAMERA.viewRange);
      grad.addColorStop(0, hot ? 'rgba(95, 212, 230, 0.45)' : 'rgba(95, 212, 230, 0.26)');
      grad.addColorStop(1, 'rgba(95, 212, 230, 0.05)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(cam.ox, cam.oy);
      for (const pt of poly) ctx.lineTo(pt.x, pt.y);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = PALETTE.cameraConeEdge;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  function drawCameras(state) {
    for (const cam of state.cameras) {
      ctx.save();
      ctx.translate(cam.x, cam.y);
      ctx.fillStyle = '#0e2230';
      ctx.beginPath();
      ctx.arc(0, 0, CAMERA.radius + 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = cam.seeing > 0 ? '#ff5a52' : PALETTE.camera;
      ctx.beginPath();
      ctx.arc(0, 0, CAMERA.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.rotate(cam.angle);
      ctx.fillStyle = '#06222b';
      ctx.beginPath();
      ctx.moveTo(CAMERA.radius + 4, 0);
      ctx.lineTo(2, -5);
      ctx.lineTo(2, 5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      // A blinking red dot while the camera has the player in frame.
      if (cam.seeing > 0) {
        ctx.save();
        ctx.translate(cam.ox, cam.oy - 20);
        ctx.fillStyle = Math.sin(state.time * 10) > 0 ? PALETTE.danger : PALETTE.text;
        ctx.font = `700 15px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('!', 0, 0);
        ctx.restore();
      }
    }
  }

  function drawGuards(state) {
    for (const g of state.guards) {
      ctx.save();
      ctx.translate(g.x, g.y);
      ctx.fillStyle = g.state === G_ALERT ? PALETTE.guard : PALETTE.guardCalm;
      ctx.beginPath();
      ctx.arc(0, 0, GUARD.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1a1210';
      ctx.beginPath();
      ctx.arc(0, 0, GUARD.radius - 4, 0, Math.PI * 2);
      ctx.fill();
      // Facing wedge.
      ctx.rotate(g.angle);
      ctx.fillStyle = g.state === G_ALERT ? '#ff8a84' : '#ffe1a1';
      ctx.beginPath();
      ctx.moveTo(GUARD.radius - 2, 0);
      ctx.lineTo(2, -6);
      ctx.lineTo(2, 6);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      // '?' while suspicious, '!' while alert; a suspicion arc fills overhead.
      if (g.suspicion > 0.05) {
        ctx.save();
        ctx.translate(g.x, g.y - 24);
        ctx.fillStyle = g.state === G_ALERT ? PALETTE.danger : PALETTE.loot;
        ctx.font = `700 16px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(g.state === G_ALERT ? '!' : '?', 0, 0);
        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, 12, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = g.state === G_ALERT ? PALETTE.danger : PALETTE.loot;
        ctx.beginPath();
        ctx.arc(0, 0, 12, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * g.suspicion);
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  function drawPlayer(state) {
    const p = state.player;
    ctx.save();
    ctx.translate(p.x, p.y);
    if (p.hidden) {
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = PALETTE.shadowLeaf2;
      ctx.beginPath();
      ctx.arc(0, 0, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = PALETTE.playerDark;
    ctx.beginPath();
    ctx.arc(0, 0, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.player;
    ctx.beginPath();
    ctx.arc(0, 0, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.rotate(p.face);
    ctx.fillStyle = '#3a2a05';
    ctx.beginPath();
    ctx.moveTo(11, 0);
    ctx.lineTo(1, -5);
    ctx.lineTo(1, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    // Noise rings from running feet and landing coins.
    for (const n of state.noises) {
      ctx.strokeStyle = `rgba(255, 220, 120, ${0.5 * n.life})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (state.coinFlight) {
      const c = state.coinFlight;
      ctx.fillStyle = PALETTE.loot;
      ctx.beginPath();
      ctx.arc(c.x, c.y - Math.sin(c.t * Math.PI) * 14, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function panel(x, y, w, h) {
    ctx.fillStyle = 'rgba(10, 14, 24, 0.82)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(120, 140, 180, 0.35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  }

  function drawHud(state, best) {
    const taken = state.loot.filter((i) => i.taken).length;
    ctx.fillStyle = 'rgba(8, 11, 20, 0.78)';
    ctx.fillRect(0, 0, FIELD.width, 44);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `700 16px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(state.level.name, 14, 23);
    ctx.font = `400 14px ${FONT}`;
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText(state.level.brief, 14, 41);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.text;
    ctx.font = `700 15px ${FONT}`;
    ctx.fillText(`LOOT ${taken}/${state.loot.length}`, FIELD.width / 2 - 130, 23);
    ctx.fillText(`COINS ${state.coins}`, FIELD.width / 2 - 30, 23);
    ctx.fillText(`SCORE ${state.score}`, FIELD.width / 2 + 70, 23);
    ctx.fillText(`BEST ${Math.max(best, state.score)}`, FIELD.width / 2 + 175, 23);
    // Lives as hearts.
    ctx.textAlign = 'right';
    ctx.fillStyle = PALETTE.danger;
    ctx.font = `700 17px ${FONT}`;
    ctx.fillText('♥'.repeat(state.lives) + '♡'.repeat(Math.max(0, 3 - state.lives)), FIELD.width - 14, 23);
    // The alarm meter: a labelled bar that fills as guards grow suspicious or a
    // camera holds the player in frame. Full means lockdown — every guard hunts.
    const bx = FIELD.width - 210;
    const by = 58;
    ctx.textAlign = 'left';
    ctx.font = `700 13px ${FONT}`;
    ctx.fillStyle = state.alarm > 0.6 ? PALETTE.danger : state.alarm > 0.25 ? PALETTE.loot : PALETTE.muted;
    ctx.fillText('ALARM', bx, by + 8);
    ctx.fillStyle = 'rgba(8, 11, 20, 0.78)';
    ctx.fillRect(bx + 58, by, 140, 16);
    ctx.strokeStyle = state.alarm > 0.6 ? PALETTE.danger : 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(bx + 58.5, by + 0.5, 139, 15);
    if (state.alarm > 0.02) {
      ctx.fillStyle = state.alarm > 0.6 ? PALETTE.danger : state.alarm > 0.25 ? PALETTE.loot : PALETTE.camera;
      ctx.fillRect(bx + 60, by + 2, 136 * Math.min(1, state.alarm), 12);
    }
    // Objective line under the bar.
    ctx.textAlign = 'left';
    ctx.font = `400 14px ${FONT}`;
    ctx.fillStyle = state.exitOpen ? PALETTE.exitOpen : PALETTE.muted;
    const objective = state.exitOpen
      ? 'Van is waiting — get out unseen.'
      : taken < state.loot.length
        ? `Grab the loot (${taken}/${state.loot.length}), then reach the van.`
        : 'Reach the van.';
    ctx.fillText(objective, 14, 62);
    if (state.player.hidden) {
      ctx.fillStyle = PALETTE.player;
      ctx.font = `700 14px ${FONT}`;
      ctx.fillText('HIDDEN in the shadows', 14, 84);
    }
    ctx.textAlign = 'right';
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `400 13px ${FONT}`;
    const mins = Math.floor(state.levelTime / 60);
    const secs = Math.floor(state.levelTime % 60);
    ctx.fillText(`${mins}:${String(secs).padStart(2, '0')}`, FIELD.width - 14, 84);
    ctx.fillText('WASD move · Shift run · Click: throw coin · P pause · M mute', FIELD.width - 14, FIELD.height - 12);
  }

  function drawTitle(state, best) {
    panel(FIELD.width / 2 - 330, 150, 660, 330);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.player;
    ctx.font = `800 64px ${FONT}`;
    ctx.fillText('VAULTBREAK', FIELD.width / 2, 230);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `400 20px ${FONT}`;
    ctx.fillText('A midnight bank heist in three levels', FIELD.width / 2, 268);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `400 16px ${FONT}`;
    ctx.fillText('Slip past the guards and the cameras. Grab the loot. Reach the van.', FIELD.width / 2, 300);
    ctx.fillText('Shadows hide you. Display cases block their sight. Coins buy you room.', FIELD.width / 2, 326);
    ctx.fillText('Cameras fill the alarm meter — a full meter means lockdown.', FIELD.width / 2, 352);
    ctx.fillStyle = PALETTE.loot;
    ctx.font = `700 19px ${FONT}`;
    ctx.fillText('Press SPACE or click to start', FIELD.width / 2, 402);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `400 14px ${FONT}`;
    ctx.fillText(`Best score: ${best}    ·    WASD / arrows to move · Shift to run · Click to throw a coin`, FIELD.width / 2, 440);
  }

  function drawCenter(title, lines, accent) {
    panel(FIELD.width / 2 - 300, 220, 600, 240);
    ctx.textAlign = 'center';
    ctx.fillStyle = accent;
    ctx.font = `800 40px ${FONT}`;
    ctx.fillText(title, FIELD.width / 2, 278);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `400 18px ${FONT}`;
    lines.forEach((line, i) => ctx.fillText(line, FIELD.width / 2, 318 + i * 28));
  }

  function draw(state, screen, best) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = PALETTE.backdrop;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY);
    if (state.shake > 0) {
      const s = state.shake * 22;
      ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
    }
    drawLevel(state);
    drawCones(state);
    drawGuards(state);
    drawPlayer(state);
    if (screen === SCREEN_TITLE) {
      drawHud(state, best);
      drawTitle(state, best);
    } else if (screen === SCREEN_PLAY) {
      drawHud(state, best);
    } else if (screen === SCREEN_PAUSED) {
      drawHud(state, best);
      drawCenter('PAUSED', ['Press P or click to keep sneaking.'], PALETTE.text);
    } else if (screen === SCREEN_CAUGHT) {
      drawHud(state, best);
      drawCenter('CAUGHT!', state.lives > 0
        ? [`A guard got you. ${state.lives} ${state.lives === 1 ? 'life' : 'lives'} left.`, 'Press SPACE to try the level again.']
        : ['No lives left.', 'Press SPACE to try again.'], PALETTE.danger);
    } else if (screen === SCREEN_CLEAR) {
      drawHud(state, best);
      drawCenter('LEVEL CLEAR', [
        `Score ${state.score} · ${state.ghost ? 'GHOST — never spotted (+500).' : 'Spotted, but you made it out.'}`,
        state.levelIndex + 1 < 3 ? 'Press SPACE for the next level.' : 'Press SPACE to finish.',
      ], PALETTE.exitOpen);
    } else if (screen === SCREEN_OVER) {
      drawHud(state, best);
      drawCenter('GAME OVER', [`Score ${state.score}. Best ${Math.max(best, state.score)}.`, 'Press SPACE to start over.'], PALETTE.danger);
    } else if (screen === SCREEN_WIN) {
      drawHud(state, best);
      drawCenter('ALL CLEAR — GHOST', [
        `You stole every haul and vanished. Final score ${state.score}.`,
        'Press SPACE to run it again.',
      ], PALETTE.player);
    }
    // Camera mounts sit on the top/bottom wall rows, under the HUD bar: paint them
    // last so they stay visible.
    drawCameras(state);
  }

  return { draw, toField };
}
