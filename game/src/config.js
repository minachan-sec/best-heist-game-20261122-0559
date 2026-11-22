// VAULTBREAK tuning, palette and levels. Everything the game balances on lives
// here so a single file answers "how fast", "how far can they see" and "what does
// the room look like".
//
// The room is a fixed 1280x720 logical field (32 by 18 tiles of 40px). The renderer
// scales that field to the window, so no rule below cares about screen size.
// You are the thief: slip past patrolling guards and sweeping wall cameras, hide
// in shadows, duck behind display cases, grab every haul and reach the getaway
// van before the alarm meter fills and locks the building down.

export const FIELD = { width: 1280, height: 720 };
export const TILE = 40;
export const COLS = 32;
export const ROWS = 18;

// One fixed simulation step per second: 60 ticks a second, whatever the display does.
export const STEP = 1 / 60;

export const PLAYER = {
  radius: 13,
  sneakSpeed: 168,
  runSpeed: 305,
  // Running is loud: any guard this close hears the footsteps and comes to look.
  noiseRadius: 175,
  // Seconds between one running footstep noise pulse and the next.
  noiseInterval: 0.45,
};

export const GUARD = {
  radius: 13,
  // How far a guard can see, in pixels.
  viewRange: 245,
  // Vision cone width in radians (about 78 degrees).
  viewAngle: 1.36,
  patrolSpeed: 72,
  chaseSpeed: 205,
  investigateSpeed: 130,
  // Seconds a guard waits at a waypoint before walking on.
  pauseAtWaypoint: 1.1,
  // Suspicion gained per second while the thief is dead-centre and point blank.
  detectRate: 1.5,
  // Suspicion lost per second while the thief is out of sight.
  forgetRate: 0.55,
  // Hidden in a shadow, the thief is invisible unless a guard gets this close.
  shadowSpotRange: 46,
  // Seconds a guard searches the last known position before giving up.
  searchTime: 4,
  // Seconds a guard stares at a noise point before going back on patrol.
  inspectTime: 2.2,
};

export const CAMERA = {
  radius: 10,
  // How far a camera can see, in pixels.
  viewRange: 230,
  // Camera cone width in radians (about 54 degrees).
  viewAngle: 0.95,
  // Alarm gained per second while the thief is dead-centre and point blank.
  detectRate: 1.15,
  // Alarm drained per second while no camera sees the thief.
  forgetRate: 0.12,
  // Hidden in a shadow, the thief is invisible unless a camera gets this close.
  shadowSpotRange: 40,
};

export const COIN = {
  // Coins per level. Click to throw one at a point; guards go and look at it.
  perLevel: 3,
  throwRange: 340,
  flightTime: 0.35,
  noiseRadius: 235,
};

export const LIVES = 3;

export const SCORE = {
  loot: 150,
  levelClear: 250,
  ghostBonus: 500,
  timeBonusPerSecond: 5,
};

export const PALETTE = {
  backdrop: '#070b14',
  floorA: '#1b2133',
  floorB: '#161b2a',
  floorEdge: '#232c44',
  wall: '#2e3a55',
  wallTop: '#42527a',
  wallEdge: '#525f86',
  crate: '#5a4632',
  crateTop: '#7a6248',
  shadow: '#101a26',
  shadowLeaf: '#1d3247',
  shadowLeaf2: '#2a4a63',
  player: '#f2b63d',
  playerDark: '#8a6414',
  guard: '#e5534b',
  guardCalm: '#d8a03c',
  coneCalm: 'rgba(242, 201, 76, 0.20)',
  coneCalmEdge: 'rgba(242, 201, 76, 0.45)',
  coneAlert: 'rgba(229, 83, 75, 0.30)',
  coneAlertEdge: 'rgba(229, 83, 75, 0.60)',
  camera: '#5fd4e6',
  cameraCone: 'rgba(95, 212, 230, 0.22)',
  cameraConeEdge: 'rgba(95, 212, 230, 0.50)',
  loot: '#ffd94d',
  exitLocked: '#e5534b',
  exitOpen: '#37e0b0',
  panel: '#121826',
  panelEdge: '#2b3550',
  text: '#eef1f5',
  muted: '#8b93a3',
  danger: '#ff5a52',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

// Where the best score lives between visits (this browser only).
export const BEST_KEY = 'vaultbreak.best';

// Level maps, 32 columns by 18 rows.
//   '#' wall   '.' floor   'S' shadow (hide in it)   'C' display case (cover, blocks sight)
//   'P' thief start   'L' loot   'E' getaway van
// Guards and cameras are listed per level below their map.
export const LEVELS = [
  {
    name: '1 · The Lobby',
    brief: 'One guard post, one camera, one haul. Learn to move unseen.',
    map: [
      '################################',
      '#P......S........C.......L.....#',
      '#........S...............#.....#',
      '#...C..........C.....#.........#',
      '#...................#....C.....#',
      '#..S......C......#.............#',
      '#............#..#......S.......#',
      '#....C....#..#..#..C...........#',
      '#.........#..#..#..............#',
      '#..S......#..#..#......C...S...#',
      '#.........#.....#..............#',
      '#....C....#..C..#...S..........#',
      '#.........#.....#..............#',
      '#..S......#..S..#......C...C...#',
      '#............#..#..............#',
      '#....C....S..#..#..S......S....#',
      '#...............#..........E...#',
      '################################',
    ],
    guards: [
      { waypoints: [[4, 2], [10, 2], [10, 6], [4, 6]] },
      { waypoints: [[24, 4], [24, 12], [19, 12], [19, 4]] },
    ],
    cameras: [
      { tx: 16, ty: 0, base: Math.PI / 2, sweep: 0.7, speed: 0.45 },
    ],
  },
  {
    name: '2 · The Vault Wing',
    brief: 'Two hauls, three guards, two cameras. Coins buy you room.',
    map: [
      '################################',
      '#P....S....#.....L...#..S......#',
      '#..C.......#...C...........C...#',
      '#....S...........S...#...S.....#',
      '#...C......#..C......#..C......#',
      '#.......S..#.......S.#......S..#',
      '#####.##########.#########.#####',
      '#..C.......#.C.......#...C.....#',
      '#.....S....#....S.........S....#',
      '#...C.............C..#......C..#',
      '#........S.#...S.....#..S......#',
      '#####.##########.#########.#####',
      '#..C.......#..C......#....C....#',
      '#......S...#.....S...#...S.....#',
      '#...C..............C.#.....C...#',
      '#.....S....#....S...........S..#',
      '#L.........#.........#......E..#',
      '################################',
    ],
    guards: [
      { waypoints: [[2, 2], [8, 2], [8, 4], [2, 4]] },
      { waypoints: [[24, 8], [28, 8], [28, 10], [24, 10]] },
      { waypoints: [[14, 13], [18, 13], [18, 15], [14, 15]] },
    ],
    cameras: [
      { tx: 8, ty: 0, base: Math.PI / 2, sweep: 0.8, speed: 0.55 },
      { tx: 24, ty: 17, base: -Math.PI / 2, sweep: 0.8, speed: 0.5 },
    ],
  },
  {
    name: '3 · The Core Vault',
    brief: 'Three hauls. Four guards. Three cameras. No room for noise.',
    map: [
      '################################',
      '#P..S......#.....L...#.....S...#',
      '#..C..........C......#..C......#',
      '#......S...#......S..#....S....#',
      '#....C.....#...C.........C.....#',
      '#........S.#.......S.#......S..#',
      '#####.##########.#########.#####',
      '#.C........#.C.......#.C.......#',
      '#.....S.........S....#.......L.#',
      '#...C......#......C..#....C....#',
      '#.......S..#...S........S......#',
      '#####.##########.#########.#####',
      '#..C.......#..C......#...S.....#',
      '#.....S....#.....S.........S...#',
      '#....C.....#.......C.#....C....#',
      '#........S......S....#......S..#',
      '#L.........#.........#......E..#',
      '################################',
    ],
    guards: [
      { waypoints: [[2, 2], [8, 2], [8, 4], [2, 4]] },
      { waypoints: [[23, 2], [28, 2], [28, 4], [23, 4]] },
      { waypoints: [[3, 8], [9, 8], [9, 10], [3, 10]] },
      { waypoints: [[23, 13], [28, 13], [28, 15], [23, 15]] },
    ],
    cameras: [
      { tx: 8, ty: 0, base: Math.PI / 2, sweep: 0.8, speed: 0.55 },
      { tx: 24, ty: 0, base: Math.PI / 2, sweep: 0.8, speed: 0.5 },
      { tx: 16, ty: 17, base: -Math.PI / 2, sweep: 0.9, speed: 0.45 },
    ],
  },
];
