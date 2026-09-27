// Easter-egg framework: the manager, plus helpers the eggs and the rider code share.
import { blend, rgb } from "./pix.js";
import { Rng } from "./rng.js";

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

export function disk(img, cx, cy, r, col, alpha = 1) {
  for (let y = Math.trunc(cy - r - 1); y < Math.trunc(cy + r + 2); y++) {
    for (let x = Math.trunc(cx - r - 1); x < Math.trunc(cx + r + 2); x++) {
      if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r) blend(img, x, y, col, alpha);
    }
  }
}

export function glow(img, cx, cy, r, col, alpha) {
  for (let y = Math.trunc(cy - r); y <= Math.trunc(cy + r); y++) {
    for (let x = Math.trunc(cx - r); x <= Math.trunc(cx + r); x++) {
      const d = Math.hypot(x - cx, y - cy);
      if (d < r) blend(img, x, y, col, alpha * (1 - d / r) ** 2);
    }
  }
}

// First land row at column x in the town (optionally only of the given material codes), or null.
export function landTop(scene, x, codes = null) {
  x = Math.trunc(x);
  if (x < 0 || x >= 256) return null;
  for (let y = 0; y < 36; y++) {
    const m = scene.land[y * 256 + x];
    if (m && (!codes || codes.includes(m))) return y;
  }
  return null;
}

// Screen position for an azimuth/elevation, facing south: east left, south centre, west right,
// kept below the caption row.
export const skyXY = (az, el) => [(((az % 360) + 360) % 360) / 360 * 256, Math.max(10, 28 - el * 0.3)];

// Days since 1970-01-01 for a calendar date, for comparing dates.
export const dayNumber = (y, m, d) => Math.round(Date.UTC(y, m - 1, d) / 86400000);

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

// A number in [0, 1) that depends only on the egg's name and a whole second of scene time, so every
// visitor's browser makes the same "does this egg start now?" decision at the same moment.
function hash32(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  h ^= h >>> 16; h = Math.imul(h, 0x45d9f3b) >>> 0; h ^= h >>> 16;
  return h >>> 0;
}
const hash01 = (name, s) => hash32(`${name}@${s}`) / 4294967296;

const CATCH_UP_S = 120; // on page load, look back this far so eggs already under way show up in progress

export class Eggs {
  constructor(classes, rng, rate = 1, log = console.log) {
    this.rng = rng; this.rate = rate; this.log = log;
    this.eggs = {};
    for (const Cls of classes) { const e = new Cls(); e.name = Cls.egg; this.eggs[e.name] = e; }
    this.active = []; // [egg, startT]
    this.pending = [];
    this.lastSecond = null;
    this.shared = true; // false: roll the dice locally every frame, as the board does
  }

  trigger(name) {
    name = name.trim().toLowerCase();
    const [base, ...rest] = name.split("-");
    if (this.eggs[base]) this.pending.push([base, rest.join("-") || null]);
    else this.log(`egg: unknown ${name}`);
  }

  start(egg, c, forced, t0 = c.t) {
    egg.done = false;
    if (egg.begin(c)) {
      if (c.t - t0 >= egg.duration) return; // caught up on page load, but it has already finished
      this.active.push([egg, t0]);
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
    if (this.shared) this.sharedStarts(c);
    else this.localStarts(c);
    this.active = this.active.filter(([e, t0]) => c.t - t0 < e.duration && !e.done);
  }

  localStarts(c) {
    let busy = this.active.some(([e]) => e.exclusive);
    for (const egg of Object.values(this.eggs)) {
      if (this.active.some(([e]) => e === egg) || (busy && egg.exclusive)) continue;
      if (this.rng.random() < egg.perHour * this.rate / 3600 * c.dt * egg.allowed(c)) {
        this.start(egg, c, false);
        busy = busy || egg.exclusive;
      }
    }
  }

  // Each whole second, each egg gets one roll that every visitor shares. Its own randomness (where it
  // flies, which way it turns) is seeded the same way, so everyone sees the same egg.
  sharedStarts(c) {
    const now = Math.floor(c.t);
    if (this.lastSecond === null) this.lastSecond = now - CATCH_UP_S;
    if (now - this.lastSecond > CATCH_UP_S) this.lastSecond = now - CATCH_UP_S; // e.g. the tab slept
    for (let s = this.lastSecond + 1; s <= now; s++) {
      this.active = this.active.filter(([e, t0]) => s - t0 < e.duration && !e.done);
      let busy = this.active.some(([e]) => e.exclusive);
      for (const egg of Object.values(this.eggs)) {
        if (this.active.some(([e]) => e === egg) || (busy && egg.exclusive)) continue;
        const p = egg.perHour * this.rate / 3600 * egg.allowed(c);
        if (p > 0 && hash01(egg.name, s) < p) {
          this.start(egg, { ...c, rng: new Rng(hash32(`${egg.name}#${s}`)) }, false, s);
          busy = busy || this.active.some(([e]) => e === egg && e.exclusive);
        }
      }
    }
    this.lastSecond = now;
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
