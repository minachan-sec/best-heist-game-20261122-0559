// Every tuning number, colour and level in one place. The playfield is a fixed 1280x720
// logical area (32x18 tiles of 40px); the renderer scales it to the window, so no rule
// below depends on the screen size. VAULTBREAK is a top-down heist game: slip past
// patrolling guards and sweeping security cameras, use shadows and display cases for
// cover, grab the loot and reach the getaway van before the alarm meter maxes out.

export const FIELD = { width: 1280, height: 720 };
export const TILE = 40;
export const COLS = 32;
export const ROWS = 18;

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

export const PLAYER = {
  radius: 13,
  sneakSpeed: 168,
  runSpeed: 305,
  /** Running is loud: guards this close hear the footsteps and come looking. */
  noiseRadius: 175,
  /** How often running feet make a noise pulse, in seconds. */
  noiseInterval: 0.45,
};

export const GUARD = {
  radius: 13,
  /** How far a guard can see, in pixels. */
  viewRange: 245,
  /** Vision cone width, in radians (about 78 degrees). */
  viewAngle: 1.36,
  patrolSpeed: 72,
  chaseSpeed: 205,
  investigateSpeed: 130,
  /** Seconds a guard stares at a waypoint before moving on. */
  pauseAtWaypoint: 1.1,
  /** Suspicion gained per second while the player is dead-centre, point blank. */
  detectRate: 1.5,
  /** Suspicion lost per second while the player is unseen. */
  forgetRate: 0.55,
  /** Inside a shadow the player is hidden unless a guard gets this close. */
  shadowSpotRange: 46,
  /** Seconds a guard searches the last known position before giving up. */
  searchTime: 4,
  /** Seconds a guard stares at a noise point before going back on patrol. */
  inspectTime: 2.2,
};

export const CAMERA = {
  radius: 10,
  /** How far a camera can see, in pixels. */
  viewRange: 230,
  /** Camera cone width, in radians (about 54 degrees). */
  viewAngle: 0.95,
  /** Alarm gained per second while the player is dead-centre, point blank. */
  detectRate: 1.15,
  /** Alarm lost per second while the player is unseen by every camera. */
  forgetRate: 0.12,
  /** Inside a shadow the player is hidden unless a camera gets this close. */
  shadowSpotRange: 40,
};

export const COIN = {
  /** Coins per level. A click throws one to the clicked point; guards go look at it. */
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

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'vaultbreak.best';

// Level maps: 32 columns x 18 rows.
// '#' wall   '.' floor   'S' shadow (hide in it)   'C' display case (cover, blocks sight)
// 'P' player start   'L' loot   'E' getaway van   Guards and cameras are listed per level.
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
