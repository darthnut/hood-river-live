// Small seeded random generator (mulberry32) with the numpy-style helpers the scene uses.

export class Rng {
  constructor(seed = 1) { this.s = seed >>> 0; }

  random() {
    let t = (this.s = (this.s + 0x6D2B79F5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  uniform(a, b) { return a + (b - a) * this.random(); }

  // integers(n) -> [0, n); integers(a, b) -> [a, b)
  integers(a, b) {
    if (b === undefined) { b = a; a = 0; }
    return a + Math.floor(this.random() * (b - a));
  }

  choice(arr) { return arr[Math.floor(this.random() * arr.length)]; }

  normal(mu = 0, sigma = 1) {
    const u = 1 - this.random(), v = this.random();
    return mu + sigma * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
}
