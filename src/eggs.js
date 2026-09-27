// Easter-egg framework: the manager, plus helpers the eggs and the rider code share.
import { blend, rgb } from "./pix.js";

export const smoothFade = (age, duration, edge) => Math.max(0, Math.min(1, age / edge, (duration - age) / edge));

export function sprite(img, x0, y0, rows, palette, flip = false, alpha = 1) {
  if (!rows.length) return;
  const w = Math.max(...rows.map(r => r.length));
  rows.forEach((row, r) => {
    [...row].forEach((ch, k) => {
      if (palette[ch]) blend(img, x0 + (flip ? w - 1 - k : k), y0 + r, palette[ch], alpha);
    });
  });
}

// Spray burst and a spreading ring at (x, y); p runs 0..1 over the splash.
export function splash(img, x, y, p, size = 1) {
  const n = Math.trunc(16 * size);
  for (let k = 0; k < n; k++) {
    const ang = Math.PI * (0.08 + 0.84 * k / Math.max(1, n - 1));
    const v = (8 + (k % 4) * 3) * size;
    blend(img, x + Math.cos(ang) * v * p, y - Math.sin(ang) * v * p + 16 * size * p * p, rgb(240, 245, 255), 0.9 * (1 - p));
  }
  const r = 1 + p * 7 * size;
  for (let k = 0; k < 20; k++) {
    const a = k / 20 * 2 * Math.PI;
    blend(img, x + Math.cos(a) * r, y + Math.sin(a) * r * 0.3, rgb(235, 240, 255), 0.7 * (1 - p));
  }
}

export class Egg {
  static egg = "";         // trigger name
  layer = "sky";           // sky, mountain, shore, water, top, over, none
  duration = 10;
  perHour = 0.2;
  exclusive = true;        // false: runs alongside other eggs
  allowed(c) { return 1; }
  begin(c) { return true; }
  draw(img, c, age) {}
  depthRow(c, age) { return null; } // water eggs: the river row that sets their depth among riders and piers
}

export class Eggs {
  constructor(classes, rng, rate = 1, log = console.log) {
    this.rng = rng; this.rate = rate; this.log = log;
    this.eggs = {};
    for (const Cls of classes) { const e = new Cls(); e.name = Cls.egg; this.eggs[e.name] = e; }
    this.active = []; // [egg, startT]
    this.pending = [];
  }

  trigger(name) {
    name = name.trim().toLowerCase();
    const [base, ...rest] = name.split("-");
    if (this.eggs[base]) this.pending.push([base, rest.join("-") || null]);
    else this.log(`egg: unknown ${name}`);
  }

  start(egg, c, forced) {
    egg.done = false;
    if (egg.begin(c)) {
      this.active.push([egg, c.t]);
      const v = egg.lastVariant;
      this.log(`egg: ${egg.name}${v ? ` (${v})` : ""}${forced ? " (triggered)" : ""}`);
    } else if (forced) {
      this.log(`egg: ${egg.name} had nothing to act on right now`);
    }
  }

  update(c) {
    for (const [name, variant] of this.pending) {
      this.active = this.active.filter(([e]) => e.name !== name);
      this.eggs[name].variant = variant;
      this.start(this.eggs[name], c, true);
    }
    this.pending = [];
    let busy = this.active.some(([e]) => e.exclusive);
    for (const egg of Object.values(this.eggs)) {
      if (this.active.some(([e]) => e === egg) || (busy && egg.exclusive)) continue;
      if (this.rng.random() < egg.perHour * this.rate / 3600 * c.dt * egg.allowed(c)) {
        this.start(egg, c, false);
        busy = busy || egg.exclusive;
      }
    }
    this.active = this.active.filter(([e, t0]) => c.t - t0 < e.duration && !e.done);
  }

  draw(layer, img, c) {
    for (const [egg, t0] of this.active) {
      if (egg.layer === layer && egg.depthRow(c, c.t - t0) === null) egg.draw(img, c, c.t - t0);
    }
  }

  depthItems(c) {
    const out = [];
    for (const [egg, t0] of this.active) {
      if (egg.layer !== "water") continue;
      const row = egg.depthRow(c, c.t - t0);
      if (row !== null) out.push([row, img => egg.draw(img, c, c.t - t0)]);
    }
    return out;
  }
}
