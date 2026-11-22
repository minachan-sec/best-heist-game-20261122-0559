// Deterministic seeded randomness for VAULTBREAK.
// A tiny sfc32 generator: same seed, same level, same patrol jitter, every run.

export function hashSeed(text) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function makeRng(seed) {
  let a = (seed >>> 0) || 1;
  let b = (seed ^ 0x9e3779b9) >>> 0;
  let c = ((seed * 2654435761) >>> 0) || 7;
  let d = (seed ^ 0x85ebca6b) >>> 0;

  function next() {
    const t = (a + b) >>> 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) >>> 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) >>> 0;
    const out = (t + d) >>> 0;
    c = (c + t) >>> 0;
    return out / 4294967296;
  }

  return {
    next,
    range(min, max) {
      return min + next() * (max - min);
    },
    int(n) {
      return Math.floor(next() * n);
    },
    pick(list) {
      return list[Math.floor(next() * list.length)];
    },
    chance(p) {
      return next() < p;
    },
    jitter(amount) {
      return (next() * 2 - 1) * amount;
    },
  };
}
