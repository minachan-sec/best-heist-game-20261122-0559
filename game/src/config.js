// VAULTBREAK configuration — every tunable number for the heist lives here.
// One frozen object so the sim, the renderer and the tests all read the same values.

export const SETTINGS = Object.freeze({
  viewWidth: 960,
  viewHeight: 600,
  tile: 40,
  cols: 24,
  rows: 15,

  thief: Object.freeze({
    radius: 13,
    walkSpeed: 175,
    runSpeed: 272,
    runNoiseRadius: 125,
  }),

  guard: Object.freeze({
    radius: 14,
    patrolSpeed: 66,
    investigateSpeed: 102,
    chaseSpeed: 152,
    viewDistance: 212,
    halfAngle: 0.61,
    suspicionRate: 1.9,
    suspicionDecay: 0.85,
    chaseMemory: 2.6,
    searchTime: 2.2,
    catchRadius: 27,
    shadowSpotRadius: 46,
  }),

  camera: Object.freeze({
    viewDistance: 238,
    halfAngle: 0.46,
    sweepSpeed: 0.55,
    seenRate: 0.62,
  }),

  alarm: Object.freeze({
    guardSeenRate: 0.52,
    decayRate: 0.12,
    lockdownAt: 1.0,
    lockdownSeconds: 6,
    afterLockdown: 0.4,
  }),

  coins: Object.freeze({
    perLevel: 3,
    throwSeconds: 0.38,
    hearRadius: 185,
  }),

  loot: Object.freeze({
    small: 100,
    big: 250,
    vault: 500,
  }),

  run: Object.freeze({
    lives: 3,
    clearBonusBase: 200,
    clearBonusPerLevel: 150,
    ghostBonus: 500,
    pickupRadius: 27,
    vanRadius: 36,
  }),
});

export const PALETTE = Object.freeze({
  floorA: '#1c2438',
  floorB: '#202a41',
  floorLine: '#26314a',
  wall: '#0d1120',
  wallTop: '#2c3a5e',
  caseGlass: '#7fd4ff',
  caseFrame: '#39496e',
  shadow: '#05070f',
  lootSmall: '#ffd34d',
  lootBig: '#ff9d2e',
  vault: '#ff5d73',
  van: '#39d98a',
  vanDark: '#1d7a4c',
  thief: '#ffb020',
  thiefDark: '#8a5a00',
  guard: '#e5484d',
  guardDark: '#7a1d20',
  coneGuard: 'rgba(255, 190, 60, 0.20)',
  coneGuardEdge: 'rgba(255, 190, 60, 0.45)',
  coneCamera: 'rgba(64, 224, 255, 0.22)',
  coneCameraEdge: 'rgba(64, 224, 255, 0.5)',
  cameraBody: '#37c8e8',
  alarmBack: '#2a1420',
  alarmFill: '#ff3b5c',
  hudText: '#e8ecf7',
  hudDim: '#8b96b3',
  title: '#ffd34d',
  banner: '#ff3b5c',
  ok: '#39d98a',
});
