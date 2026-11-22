// VAULTBREAK world — level maps, the parser, and the geometry the sim runs on.
//
// Map legend (one character per tile, 24 x 15):
//   # wall        . floor        , shadow (hides the thief)
//   D display case (blocks movement and sight, like a wall, but low)
//   L small loot  B big loot    V the vault (must be grabbed to open the exit)
//   E getaway van T thief start G guard spawn  C camera mount
//
// Guard patrol routes and camera sweep settings live in each level definition,
// as tile coordinates and angles — never in the map text.

import { SETTINGS } from './config.js';

const TILE = SETTINGS.tile;

export const LEVELS = [
  {
    name: 'The Gallery',
    sub: 'Lift the jade tiger, then slip out the side door.',
    map: [
      '########################',
      '#T....#......#....L....#',
      '#.....#..,,..#........C#',
      '#..D...G..D.......#....#',
      '#.....#......#....#....#',
      '#..,,.D..L...#....#....#',
      '#.....#......#....#....#',
      '###.####.##..#....#....#',
      '#........#.......D.....#',
      '#......#..G...#........#',
      '#....#...#.....D...L...#',
      '#....#...#........#....#',
      '#....D...#....,,...V#.E#',
      '#........#........#....#',
      '########################',
    ],
    guardRoutes: [
      [
        { cx: 7, cy: 3 },
        { cx: 13, cy: 3 },
        { cx: 14, cy: 7 },
        { cx: 8, cy: 7 },
      ],
      [
        { cx: 10, cy: 9 },
        { cx: 16, cy: 9 },
        { cx: 16, cy: 12 },
        { cx: 10, cy: 12 },
      ],
    ],
    cameraSpecs: [{ base: Math.PI, arc: 0.9, speed: 0.5, phase: 0 }],
  },
  {
    name: 'The Vault Floor',
    sub: 'Two cameras, three guards, one very heavy safe.',
    map: [
      '########################',
      '#..L...#....T....#....C#',
      '#......#.........#.....#',
      '#......#..,,.....D...G.#',
      '###.####.####.####.###.#',
      '#......D....#....#.....#',
      '#.G....#....#..L.#.....#',
      '#......#..,,#....#.....#',
      '#..,,..#....#....#.....#',
      '####.#.............#.#.#',
      '#....#.......#....#....#',
      '#.D..#..G....D....#....#',
      '#....#.......#..B.#....#',
      '#....#..C....#....#..VE#',
      '########################',
    ],
    guardRoutes: [
      [
        { cx: 2, cy: 6 },
        { cx: 6, cy: 6 },
        { cx: 6, cy: 8 },
        { cx: 2, cy: 8 },
      ],
      [
        { cx: 10, cy: 11 },
        { cx: 15, cy: 11 },
        { cx: 15, cy: 6 },
        { cx: 10, cy: 6 },
      ],
      [
        { cx: 20, cy: 3 },
        { cx: 21, cy: 3 },
        { cx: 21, cy: 12 },
        { cx: 20, cy: 12 },
      ],
    ],
    cameraSpecs: [
      { base: Math.PI, arc: 1.0, speed: 0.55, phase: 0 },
      { base: Math.PI / 2, arc: 0.8, speed: 0.7, phase: 1.4 },
    ],
  },
  {
    name: 'The Penthouse',
    sub: 'Four guards, three cameras, and the diamond vault.',
    map: [
      '########################',
      '#T....#.....L.....#..C.#',
      '#.....#.G.........#....#',
      '#.D..#..,,...D...#..G..#',
      '#....#............#....#',
      '##.####.#####.####.##.##',
      '#..,,......#......#..C.#',
      '#....D..G..#..L...#....#',
      '#.........#......D.....#',
      '#..C......#..,,........#',
      '###.#######.####.####..#',
      '#....#..........#...B..#',
      '#.G..#..D..#....#......#',
      '#....#....#...V.#....E.#',
      '########################',
    ],
    guardRoutes: [
      [
        { cx: 20, cy: 3 },
        { cx: 21, cy: 3 },
        { cx: 21, cy: 7 },
        { cx: 17, cy: 7 },
      ],
      [
        { cx: 8, cy: 7 },
        { cx: 12, cy: 7 },
        { cx: 12, cy: 11 },
        { cx: 8, cy: 11 },
      ],
      [
        { cx: 2, cy: 12 },
        { cx: 4, cy: 12 },
        { cx: 4, cy: 9 },
        { cx: 2, cy: 9 },
      ],
      [
        { cx: 8, cy: 2 },
        { cx: 12, cy: 2 },
        { cx: 12, cy: 4 },
        { cx: 8, cy: 4 },
      ],
    ],
    cameraSpecs: [
      { base: Math.PI, arc: 0.9, speed: 0.5, phase: 0 },
      { base: Math.PI / 2, arc: 1.1, speed: 0.62, phase: 2.1 },
      { base: -Math.PI / 2, arc: 0.8, speed: 0.45, phase: 0.7 },
    ],
  },
];

export function tileCenter(cx, cy) {
  return { x: cx * TILE + TILE / 2, y: cy * TILE + TILE / 2 };
}

export function buildLevel(def) {
  const rows = def.map;
  const height = rows.length;
  const width = rows[0].length;
  for (const row of rows) {
    if (row.length !== width) throw new Error('ragged level map in ' + def.name);
  }
  const grid = rows.map((row) => row.split(''));
  const level = {
    name: def.name,
    sub: def.sub,
    cols: width,
    rows: height,
    grid,
    loot: [],
    vault: null,
    van: null,
    thiefStart: null,
    guardSpawns: [],
    cameraMounts: [],
  };
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const ch = grid[y][x];
      const c = tileCenter(x, y);
      if (ch === 'L') level.loot.push({ x: c.x, y: c.y, value: SETTINGS.loot.small, kind: 'small', taken: false });
      if (ch === 'B') level.loot.push({ x: c.x, y: c.y, value: SETTINGS.loot.big, kind: 'big', taken: false });
      if (ch === 'V') {
        level.vault = { x: c.x, y: c.y, value: SETTINGS.loot.vault, kind: 'vault', taken: false };
        level.loot.push(level.vault);
      }
      if (ch === 'E') level.van = { x: c.x, y: c.y };
      if (ch === 'T') level.thiefStart = { x: c.x, y: c.y };
      if (ch === 'G') level.guardSpawns.push({ x: c.x, y: c.y });
      if (ch === 'C') level.cameraMounts.push({ x: c.x, y: c.y });
    }
  }
  if (!level.thiefStart) throw new Error('no thief start in ' + def.name);
  if (!level.van) throw new Error('no van in ' + def.name);
  if (!level.vault) throw new Error('no vault in ' + def.name);
  if (level.guardSpawns.length !== def.guardRoutes.length) {
    throw new Error('guard spawns do not match routes in ' + def.name);
  }
  if (level.cameraMounts.length !== def.cameraSpecs.length) {
    throw new Error('camera mounts do not match specs in ' + def.name);
  }
  return level;
}

export function tileAt(level, px, py) {
  const cx = Math.floor(px / TILE);
  const cy = Math.floor(py / TILE);
  if (cx < 0 || cy < 0 || cx >= level.cols || cy >= level.rows) return '#';
  return level.grid[cy][cx];
}

export function blocksMove(level, px, py) {
  const ch = tileAt(level, px, py);
  return ch === '#' || ch === 'D';
}

export function blocksSight(level, px, py) {
  const ch = tileAt(level, px, py);
  return ch === '#' || ch === 'D';
}

// Circle-versus-grid collision: true when any corner sample of the circle is inside a blocker.
export function hitsWall(level, x, y, radius) {
  const steps = [0, 1, 2, 3];
  for (const i of steps) {
    const a = (i / 4) * Math.PI * 2;
    if (blocksMove(level, x + Math.cos(a) * radius, y + Math.sin(a) * radius)) return true;
  }
  return blocksMove(level, x, y);
}

export function slideMove(level, x, y, dx, dy, radius) {
  let nx = x + dx;
  if (hitsWall(level, nx, y, radius)) nx = x;
  let ny = y + dy;
  if (hitsWall(level, x, ny, radius)) ny = y;
  if (hitsWall(level, nx, ny, radius)) return { x, y };
  return { x: nx, y: ny };
}

// True when a straight segment between two points crosses a sight blocker.
export function lineBlocked(level, x0, y0, x1, y1) {
  const dist = Math.hypot(x1 - x0, y1 - y0);
  const steps = Math.max(1, Math.ceil(dist / 6));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (blocksSight(level, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t)) return true;
  }
  return false;
}

export function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// Can a watcher at (x, y) facing `angle` see the point (tx, ty)?
export function inCone(level, x, y, angle, halfAngle, distance, tx, ty) {
  const dx = tx - x;
  const dy = ty - y;
  const d = Math.hypot(dx, dy);
  if (d > distance) return false;
  if (d < 1) return true;
  const want = Math.atan2(dy, dx);
  if (Math.abs(angleDiff(want, angle)) > halfAngle) return false;
  return !lineBlocked(level, x, y, tx, ty);
}

// Ray-fan for drawing a vision cone: one hit point per ray, wall-clipped.
export function coneFan(level, x, y, angle, halfAngle, distance, rayCount) {
  const points = [];
  const n = Math.max(2, rayCount);
  for (let i = 0; i <= n; i++) {
    const a = angle - halfAngle + (2 * halfAngle * i) / n;
    const step = 5;
    let hitX = x + Math.cos(a) * distance;
    let hitY = y + Math.sin(a) * distance;
    for (let d = step; d <= distance; d += step) {
      const px = x + Math.cos(a) * d;
      const py = y + Math.sin(a) * d;
      if (blocksSight(level, px, py)) {
        hitX = px;
        hitY = py;
        break;
      }
    }
    points.push({ x: hitX, y: hitY });
  }
  return points;
}

// Breadth-first walkable reachability on the tile grid (for tests and staging).
export function reachableTiles(level, startCx, startCy) {
  const seen = new Set();
  const key = (x, y) => x + ',' + y;
  const walkable = (x, y) => {
    if (x < 0 || y < 0 || x >= level.cols || y >= level.rows) return false;
    const ch = level.grid[y][x];
    return ch !== '#' && ch !== 'D';
  };
  if (!walkable(startCx, startCy)) return seen;
  const queue = [[startCx, startCy]];
  seen.add(key(startCx, startCy));
  while (queue.length > 0) {
    const [cx, cy] = queue.shift();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (walkable(nx, ny) && !seen.has(key(nx, ny))) {
        seen.add(key(nx, ny));
        queue.push([nx, ny]);
      }
    }
  }
  return seen;
}
