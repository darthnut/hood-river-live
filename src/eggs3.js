// Easter eggs, batch 3 (the board's eggs_more2.py): rider mishaps, seasons and Gorge life, legends,
// the real sky, holidays.
import { W, H, HORIZON, rgb, blend, text, scale as mul } from "./pix.js";
import { Egg, smoothFade, sprite, splash, glow, landTop, skyXY, dayNumber } from "./eggs.js";
import { Rng } from "./rng.js";
import { MAT } from "./scene.js";
import { Rainbow } from "./eggs1.js";
import { Fireworks } from "./eggs2.js";
import { easter, thanksgiving, sameDay } from "./calendar.js";
import { lunarEclipseNear } from "./skymath.js";
import { issVisible } from "./skyfeeds.js";

const fresh = (holder, key) => holder.lastKey !== key;
const dayKey = n => `${n.year}-${n.month}-${n.day}`;

// ---------------------------------------------------------------- riders

export class Catapult extends Egg {
  static egg = "catapult";
  layer = "none"; duration = 3.6; perHour = 0.6;
  allowed(c) { return c.light; }
  begin(c) {
    const pool = c.riders.filter(r => !r.kite && r.x > 20 && r.x < W - 20 && r.catapultT == null);
    if (!pool.length) return false;
    pool[c.rng.integers(pool.length)].catapultT = c.t;
    return true;
  }
}

export class KiteCrash extends Egg {
  static egg = "kitecrash";
  layer = "none"; duration = 5.4; perHour = 0.5;
  allowed(c) { return c.light; }
  begin(c) {
    const pool = c.riders.filter(r => r.kite && r.x > 20 && r.x < W - 20 && r.crashT == null);
    if (!pool.length) return false;
    pool[c.rng.integers(pool.length)].crashT = c.t;
    return true;
  }
}

// ---------------------------------------------------------------- seasons and Gorge life

// Pixels of the given land materials, each kept with probability `keep`, from a fixed seed.
function pickLand(scene, codes, keep, seed) {
  const r = new Rng(seed), out = [];
  for (let p = 0; p < HORIZON * W; p++) {
    const roll = r.random();
    if (codes.includes(scene.land[p]) && roll < keep) out.push(p);
  }
  return out;
}

export class Blossom extends Egg {
  static egg = "blossom";
  layer = "shore"; duration = 900; perHour = 200; exclusive = false;
  allowed(c) { return c.now.month === 4 && c.now.day <= 25 ? c.light + 0.5 * c.w.twi : 0; }
  begin(c) {
    this.pix = pickLand(c.scene, [MAT.ORCHARD, MAT.ORCHARD_ROW], 0.5, 7);
    const r = new Rng(8);
    this.pink = this.pix.map(() => r.random() < 0.35);
    return true;
  }
  draw(img, c, age) {
    const a = 0.8 * smoothFade(age, this.duration, 5) * (0.35 + 0.65 * (1 - c.night)), lit = 0.55 + 0.45 * c.light;
    this.pix.forEach((p, i) => {
      const col = this.pink[i] ? [1.0, 0.8, 0.86] : [1.0, 0.97, 0.97], j = p * 3;
      for (let k = 0; k < 3; k++) img[j + k] = img[j + k] * (1 - a) + col[k] * lit * a;
    });
  }
}

export class FallColor extends Egg {
  static egg = "fallcolor";
  static PALETTE = [[0.86, 0.55, 0.16], [0.78, 0.31, 0.12], [0.9, 0.75, 0.24], [0.67, 0.24, 0.16]];
  layer = "shore"; duration = 900; perHour = 200; exclusive = false;
  allowed(c) { return c.now.month === 10 && c.now.day >= 5 ? c.light + 0.5 * c.w.twi : 0; }
  begin(c) {
    this.pix = pickLand(c.scene, [MAT.ORCHARD, MAT.ORCHARD_ROW, MAT.FAR_WEST, MAT.BLUFF, MAT.TREE], 0.35, 10);
    const r = new Rng(11);
    this.cols = this.pix.map(() => FallColor.PALETTE[r.integers(4)]);
    return true;
  }
  draw(img, c, age) {
    const a = 0.7 * smoothFade(age, this.duration, 5), lit = 0.35 + 0.65 * (1 - c.night);
    this.pix.forEach((p, i) => {
      const col = this.cols[i], j = p * 3;
      for (let k = 0; k < 3; k++) img[j + k] = img[j + k] * (1 - a) + col[k] * lit * a;
    });
  }
}

export class Bats extends Egg {
  static egg = "bats";
  layer = "shore"; duration = 24; perHour = 2;
  allowed(c) { return c.now.month >= 5 && c.now.month <= 9 && c.now.hour >= 12 && c.w.twi > 0.3 ? 1 : 0; }
  begin(c) { this.bats = Array.from({ length: 16 }, () => [c.rng.uniform(40, 220), c.rng.uniform(11, 20), c.rng.uniform(0, 6.3), c.rng.uniform(0.7, 1.4)]); return true; }
  draw(img, c, age) {
    const fade = smoothFade(age, this.duration, 3), col = rgb(18, 14, 20);
    for (const [x0, y0, ph, sp] of this.bats) { // erratic darting paths
      const x = x0 + 30 * Math.sin(age * 0.5 * sp + ph) + 8 * Math.sin(age * 3.1 * sp + ph * 2);
      const y = y0 + 4 * Math.sin(age * 0.9 * sp + ph * 1.7) + 2 * Math.sin(age * 5 + ph);
      const flap = Math.trunc(age * 12 * sp + ph) % 2;
      blend(img, x, y, col, fade); blend(img, x - 1, y - flap, col, fade); blend(img, x + 1, y - flap, col, fade);
    }
  }
}

export class Elk extends Egg {
  static egg = "elk";
  layer = "shore"; duration = 40; perHour = 0.12;
  allowed(c) { return c.light + 0.6 * c.w.twi; }
  begin(c) {
    this.ground = {};
    for (let x = 180; x < 232; x++) { const g = landTop(c.scene, x, [MAT.ORCHARD, MAT.ORCHARD_ROW]); if (g !== null) this.ground[x] = g; }
    if (!Object.keys(this.ground).length) return false;
    this.herd = [0, 1, 2, 3, 4].map(i => [c.rng.uniform(186, 205) + i * 5, i === 0, c.rng.uniform(0, 6.3)]);
    return true;
  }
  draw(img, c, age) {
    const fade = smoothFade(age, this.duration, 4), lum = 0.45 + 0.55 * (1 - c.night);
    const body = mul(rgb(120, 82, 50), lum), dark = mul(rgb(60, 40, 28), lum), rump = mul(rgb(215, 195, 160), lum);
    for (const [x0, bull, ph] of this.herd) {
      const x = Math.trunc(x0 + age * 0.35 + Math.sin(age * 0.3 + ph));
      const g = this.ground[x] ?? this.ground[x + 1];
      if (g === undefined) continue;
      const y = g + 1, grazing = Math.sin(age * 0.7 + ph) > 0.2;
      for (let i = 0; i < 4; i++) { blend(img, x + i, y - 2, body, fade); blend(img, x + i, y - 1, body, fade); }
      blend(img, x, y - 2, rump, fade);
      for (const lx of [x, x + 3]) blend(img, lx, y, dark, fade);
      const hx = x + 4, hy = grazing ? y - 1 : y - 3; // head down to graze, or up
      blend(img, hx, hy, dark, fade);
      if (bull) { blend(img, hx, hy - 1, rump, fade); blend(img, hx + 1, hy - 2, rump, fade); blend(img, hx - 1, hy - 2, rump, fade); }
    }
  }
}

export class SalmonRun extends Egg {
  static egg = "salmonrun";
  layer = "water"; duration = 10; perHour = 1;
  allowed(c) { return c.now.month === 8 || c.now.month === 9 ? c.light + 0.4 * c.w.twi : 0; }
  begin(c) { const r = c.rng; this.leaps = Array.from({ length: 30 }, () => [r.uniform(0, 8.5), r.uniform(15, W - 15), r.uniform(46, 62), r.choice([-1, 1])]); return true; }
  draw(img, c, age) {
    const lum = 0.55 + 0.45 * c.light;
    for (const [t0, x0, y0, d] of this.leaps) {
      const p = age - t0;
      if (p < 0 || p > 1.3) continue;
      const sc = 0.9 + (y0 - 40) / 21 * 0.9;
      if (p <= 1) { // an arcing fish, silver back and a red flank
        const x = x0 + d * p * 10 * sc, y = y0 - Math.sin(Math.PI * p) * 9 * sc;
        const ang = Math.atan2(-Math.cos(Math.PI * p) * 9 * Math.PI * sc, d * 10 * sc), n = Math.round(2.5 * sc);
        for (let i = -n; i <= n; i++) {
          const col = i === -n ? rgb(70, 80, 100) : (i > 0 ? rgb(230, 90, 100) : rgb(225, 232, 240));
          const px = x + Math.cos(ang) * i, py = y + Math.sin(ang) * i;
          blend(img, px, py, mul(col, lum), 1);
          if (Math.abs(i) < n) blend(img, px, py + 1, mul(rgb(200, 70, 80), lum), 0.8);
        }
      }
      for (const [sx, sp] of [[x0, p], [x0 + d * 10 * sc, p - 1]]) if (sp >= 0 && sp < 0.3) splash(img, sx, y0, sp / 0.3, 0.6 * sc);
    }
  }
}

// ---------------------------------------------------------------- legends and oddities

export class ColossalClaude extends Egg {
  static egg = "claude";
  layer = "water"; duration = 26; perHour = 0.04;
  allowed(c) { return c.light + 0.5 * c.w.twi; }
  begin(c) { this.row = c.rng.uniform(53, 58); this.dir = c.rng.choice([-1, 1]); return true; }
  depthRow() { return this.row; }
  draw(img, c, age) {
    const lum = 0.55 + 0.45 * c.light;
    const skin = mul(rgb(70, 125, 85), lum), light = mul(rgb(150, 200, 120), lum), dark = mul(rgb(35, 70, 50), lum);
    const rise = age < 21 ? Math.min(1, age / 3) : Math.max(0, 1 - (age - 21) / 4);
    const d = this.dir, y = this.row, headX = d > 0 ? -40 + age * 12 : W + 40 - age * 12;
    for (let h = 0; h < 3; h++) { // three humps trailing behind the neck, rolling like waves
      const hx = headX - d * (12 + h * 11), size = (4.5 - h * 0.6) * rise * (1 + 0.2 * Math.sin(age * 2.2 - h));
      for (let dx = -5; dx <= 5; dx++) {
        const hgt = size * (1 - (dx / 5.5) ** 2), n = Math.round(hgt);
        for (let dy = 0; dy < n; dy++) blend(img, hx + dx, y - 1 - dy, dy === n - 1 ? light : skin, 1);
        if (hgt > 0.5) blend(img, hx + dx, y, dark, 0.8); // waterline shadow
      }
      if (rise > 0.3) blend(img, hx - d * 6, y, rgb(235, 240, 255), 0.6);
    }
    const neck = 15 * rise, look = Math.sin(age * 0.8) * 2;
    for (let i = 0; i < Math.trunc(neck); i++) { // the long neck curving up, two pixels thick
      const nx = headX + d * Math.sin(i / 15 * 1.6) * 3;
      blend(img, nx, y - 1 - i, skin, 1); blend(img, nx + d, y - 1 - i, i % 3 ? light : skin, 1);
    }
    if (neck > 6) {
      const hx = headX + d * 3 + look, hy = y - neck;
      for (let i = -1; i < 4; i++) { blend(img, hx + d * i, hy, skin, 1); if (i < 2) blend(img, hx + d * i, hy - 1, skin, 1); }
      blend(img, hx + d, hy - 1, rgb(255, 225, 80), 1); // eye
      blend(img, hx - d, hy - 2, light, 1); blend(img, hx, hy - 2, light, 1); // a little crest
    }
    for (let k = 0; k < 14; k++) blend(img, headX - d * (k + 2), y + k * 0.15, rgb(235, 240, 255), 0.45 * (1 - k / 14) * rise);
  }
}

export class Kraken extends Egg {
  static egg = "kraken";
  layer = "water"; duration = 9; perHour = 0.02;
  begin(c) { const bx = c.scene.bargeX(c.t); return bx > 10 && bx < W - 70; }
  depthRow() { return 39.5; }
  draw(img, c, age) {
    const bx = c.scene.bargeX(c.t);
    const rise = age < 6.5 ? Math.min(1, age / 2) : Math.max(0, 1 - (age - 6.5) / 2.5);
    const lum = 0.5 + 0.5 * c.light, skin = mul(rgb(150, 50, 80), lum), sucker = mul(rgb(235, 170, 185), lum);
    [-4, 8, 20, 32, 44].forEach((off, k) => {
      const baseX = bx + off, baseY = 40.5, length = 12 * rise * (0.8 + 0.3 * (k % 2));
      let prev = null;
      for (let i = 0; i < Math.trunc(length * 2); i++) {
        const u = i / (length * 2), x = baseX + Math.sin(u * 3 + age * 2 + k) * 3 * u, y = baseY - u * length;
        blend(img, x, y, skin, 1);
        if (u < 0.6) blend(img, x + 1, y, skin, 1);
        if (i % 5 === 3) blend(img, x + 1, y, sucker, 1);
        prev = [x, y];
      }
      if (prev && rise > 0.8) blend(img, prev[0] + 1, prev[1] + 1, skin, 1); // the curling tip
    });
    if (age < 1.2) splash(img, bx + 20, 40, age / 1.2, 1.2);
  }
}

export class RubberDucks extends Egg {
  static egg = "ducks";
  layer = "water"; duration = 30; perHour = 0.15;
  allowed(c) { return c.light; }
  begin(c) { const r = c.rng; this.ducks = Array.from({ length: 30 }, () => [r.uniform(-60, 0), r.uniform(43, 60), r.uniform(0, 6.3), r.uniform(0.8, 1.2)]); return true; }
  depthRow() { return 50; }
  draw(img, c, age) {
    const yellow = mul(rgb(255, 215, 40), 0.5 + 0.5 * c.light), beak = rgb(255, 120, 30);
    for (const [x0, y0, ph, sp] of this.ducks) {
      const x = x0 + age * 11 * sp, y = y0 + Math.sin(age * 3 + ph) * 0.6;
      if (x > -2 && x < W + 2) { blend(img, x, y, yellow, 1); blend(img, x + 1, y, yellow, 1); blend(img, x + 1, y - 1, yellow, 1); blend(img, x + 2, y - 1, beak, 1); }
    }
  }
}

export class Bottle extends Egg {
  static egg = "bottle";
  layer = "water"; duration = 30; perHour = 0.15;
  allowed(c) { return c.light + 0.4 * c.w.twi; }
  begin(c) { this.row = c.rng.uniform(55, 60); return true; }
  depthRow() { return this.row; }
  draw(img, c, age) {
    const x = -8 + age * (W + 16) / this.duration, y = this.row + Math.sin(age * 2.3) * 0.7, tilt = Math.sin(age * 1.7) * 0.6;
    const lum = 0.6 + 0.4 * c.light, glass = mul(rgb(70, 190, 110), lum), dark = mul(rgb(30, 110, 60), lum);
    for (let i = 0; i < 7; i++) { // the bottle lying on its side: body, shoulder, neck, cork
      const yy = y + tilt * (i - 3) / 3;
      if (i < 5) { blend(img, x + i, yy - 1, glass, 1); blend(img, x + i, yy, dark, 1); }
      else if (i === 5) blend(img, x + i, yy - 1, glass, 1);
      else blend(img, x + i, yy - 1, mul(rgb(190, 145, 90), lum), 1);
    }
    blend(img, x + 1, y - 1, mul(rgb(245, 238, 210), lum), 1); blend(img, x + 2, y - 1, mul(rgb(245, 238, 210), lum), 1); // the message
    if (Math.trunc(age * 3) % 4 === 0) blend(img, x + 3, y - 2, rgb(255, 255, 255), 1); // glint
    for (let k = 0; k < 4; k++) blend(img, x - 1 - k, y + 0.5, rgb(235, 240, 255), 0.3 * (1 - k / 4));
  }
}

// ---------------------------------------------------------------- the real sky

export class ISSPass extends Egg {
  static egg = "iss";
  layer = "mountain"; // in front: Mt. Hood only rises a couple of degrees above Hood River's horizon duration = 900; perHour = 3000; exclusive = false;
  allowed(c) { return issVisible(c.nowMs) ? 1 : 0; }
  begin(c) { this.forced = !issVisible(c.nowMs); return true; }
  draw(img, c, age) {
    let az, el;
    if (this.forced) { // a demo pass: west to east, 6 minutes squeezed into 25 seconds
      if (age > 25) { this.done = true; return; }
      const p = age / 25;
      az = 300 - 200 * p; el = 12 + 50 * Math.sin(Math.PI * p);
    } else {
      const v = issVisible(c.nowMs);
      if (!v) { this.done = true; return; }
      [az, el] = v;
    }
    const [x, y] = skyXY(az, el);
    glow(img, x, y, 3, rgb(255, 255, 240), 0.35);
    blend(img, x, y, rgb(255, 255, 250), 1);
    if (x < W - 16) text(img, Math.trunc(x) + 3, Math.trunc(y) + 1, "ISS", rgb(200, 210, 230), 0.7);
  }
}

export class GreenFlash extends Egg {
  static egg = "greenflash";
  layer = "shore"; duration = 1.6; perHour = 5000; exclusive = false;
  allowed(c) {
    if (c.veil > 0.3 || c.now.hour < 12 || !(c.sx >= 0 && c.sx < W)) return 0;
    const ridge = landTop(c.scene, c.sx) ?? HORIZON, top = c.sy - 5.5;
    return top > ridge - 1.5 && top < ridge + 0.5 && fresh(this, dayKey(c.now)) ? 1 : 0;
  }
  begin(c) { this.lastKey = dayKey(c.now); return true; }
  draw(img, c, age) {
    const x = Math.trunc(c.sx), ridge = landTop(c.scene, x) ?? Math.trunc(c.sy - 4);
    const a = Math.sin(Math.PI * age / this.duration);
    for (let dx = -3; dx <= 3; dx++) { // a thin green sliver right on the ridgeline
      blend(img, x + dx, ridge - 1, rgb(90, 255, 120), a * (1 - Math.abs(dx) / 4));
      if (Math.abs(dx) < 2) blend(img, x + dx, ridge - 2, rgb(150, 255, 170), a);
    }
    glow(img, x, ridge - 2, 5, rgb(90, 255, 140), 0.35 * a);
  }
}

export class LunarEclipse extends Egg {
  static egg = "eclipse";
  layer = "sky"; duration = 900; perHour = 3000; exclusive = false;
  static cache = {};
  current(c) {
    const key = dayKey(c.now);
    if (!(key in LunarEclipse.cache)) LunarEclipse.cache[key] = lunarEclipseNear(c.nowMs);
    const e = LunarEclipse.cache[key];
    if (!e) return null;
    const frac = (c.nowMs - e.max) / 60e3 / e.partialMin;
    return frac > -1 && frac < 1 ? [frac, e] : null;
  }
  allowed(c) { return c.melev > 0 && this.current(c) ? 1 : 0; }
  begin(c) { this.forced = this.current(c) === null; return true; }
  draw(img, c, age) {
    let frac, gamma, total;
    if (this.forced) {
      if (age > 30) { this.done = true; return; }
      frac = age / 15 - 1; gamma = 0.3; total = true;
    } else {
      const cur = this.current(c);
      if (!cur) { this.done = true; return; }
      [frac] = cur; gamma = cur[1].gamma; total = cur[1].kind === "total";
    }
    const [mx, my] = c.melev > 0 ? [c.mx, c.my] : [60, 12];
    const r = 3.8, shadowR = 7.5, sx = mx - frac * (r + shadowR), sy = my + gamma * 3; // the umbra slides across
    const copper = total ? rgb(170, 70, 40) : rgb(120, 60, 50);
    for (let yy = -4; yy <= 4; yy++) for (let xx = -4; xx <= 4; xx++) {
      if (xx * xx + yy * yy > r * r) continue;
      const inside = (mx + xx - sx) ** 2 + (my + yy - sy) ** 2 < shadowR ** 2;
      blend(img, mx + xx, my + yy, inside ? mul(copper, 0.6) : rgb(238, 235, 215), 1);
    }
    if (Math.abs(frac) < 0.3 && total) glow(img, mx, my, 7, rgb(150, 60, 40), 0.2);
  }
}

// ---------------------------------------------------------------- holidays

export class Valentine extends Egg {
  static egg = "valentine";
  static HEART = [".r.r.", "rrrrr", ".rrr.", "..r.."];
  layer = "shore"; duration = 20; perHour = 4; exclusive = false;
  allowed(c) { return c.now.month === 2 && c.now.day === 14 ? 1 : 0; }
  begin(c) {
    const wins = c.scene.windows, r = c.rng;
    this.src = Array.from({ length: 12 }, () => { const w = wins[r.integers(wins.length)]; return [w[0], w[1]]; });
    this.t0 = this.src.map(() => r.uniform(0, 14));
    return true;
  }
  draw(img, c, age) {
    this.src.forEach(([x0, y0], i) => {
      const a = age - this.t0[i];
      if (a < 0 || a >= 5) return;
      const x = x0 + Math.sin(a * 2 + x0) * 2, y = y0 - a * 5;
      sprite(img, Math.trunc(x) - 2, Math.trunc(y) - 4, Valentine.HEART, { r: Math.trunc(x0) % 2 ? rgb(255, 60, 110) : rgb(255, 130, 170) }, false, 1 - a / 5);
    });
  }
}

export class StPatrick extends Egg {
  static egg = "stpatrick";
  layer = "water"; duration = 45; perHour = 3; exclusive = false;
  allowed(c) { return c.now.month === 3 && c.now.day === 17 ? c.light : 0; }
  draw(img, c, age) {
    const fade = smoothFade(age, this.duration, 6), [px, py] = c.perch, cx = px - 30, r0 = 32;
    Rainbow.BANDS.forEach((col, k) => { // an arc landing right on the pot
      const rr = r0 - k;
      for (let i = 0; i < 90; i++) {
        const a = Math.PI * i / 89, x = cx + Math.cos(a) * rr, y = HORIZON + 2 - Math.sin(a) * rr * 0.9;
        if (x > cx && y <= py) blend(img, x, y, rgb(...col), 0.35 * fade);
      }
    });
    const pot = rgb(25, 25, 28), gold = rgb(255, 205, 40);
    for (let dx = -2; dx <= 2; dx++) { blend(img, px + dx, py - 1, pot, fade); blend(img, px + dx, py, pot, fade); }
    for (let dx = -2; dx <= 2; dx += 2) blend(img, px + dx, py - 2, gold, fade);
    if (Math.trunc(age * 4) % 2) blend(img, px, py - 3, rgb(255, 255, 220), fade); // glint
  }
}

export class Easter extends Egg {
  static egg = "easter";
  static PASTELS = [[255, 170, 200], [170, 220, 255], [255, 240, 150], [190, 255, 190], [220, 190, 255]];
  static X0 = 100; static X1 = 232; // from the Hook to the bluff
  layer = "top"; duration = 20; perHour = 3; exclusive = false;
  allowed(c) { return sameDay(c.now, easter(c.now.year)) ? c.light : 0; }
  draw(img, c, age) {
    const E = Easter, y = HORIZON, speed = (E.X1 - E.X0) / (this.duration - 2);
    const x = E.X0 + Math.min(age, this.duration - 2) * speed, fade = smoothFade(age, this.duration, 1);
    const hop = Math.abs(Math.sin(age * 5)) * 3, lum = 0.6 + 0.4 * c.light;
    const fur = mul(rgb(240, 236, 228), lum), pink = mul(rgb(255, 170, 190), lum);
    for (let k = 0; k < Math.trunc((x - E.X0) / 7); k++) { // the eggs left behind
      const ex = E.X0 + 3 + k * 7, col = mul(rgb(...E.PASTELS[k % 5]), lum);
      blend(img, ex, y, col, fade); blend(img, ex + 1, y, col, fade); blend(img, ex, y - 1, col, fade); blend(img, ex + 1, y - 1, mul(col, 0.85), fade);
    }
    for (let dx = -1; dx < 3; dx++) { blend(img, x + dx, y - 1 - hop, fur, fade); blend(img, x + dx, y - 2 - hop, fur, fade); }
    blend(img, x + 3, y - 3 - hop, fur, fade); blend(img, x + 2, y - 3 - hop, fur, fade); // head
    for (const ear of [2, 3]) { blend(img, x + ear, y - 4 - hop, fur, fade); blend(img, x + ear, y - 5 - hop, ear === 3 ? pink : fur, fade); }
    blend(img, x - 2, y - 2 - hop, rgb(255, 255, 255), fade); // cotton tail
  }
}

export class Thanksgiving extends Egg {
  static egg = "thanksgiving";
  static X0 = 228; static X1 = 100;
  layer = "top"; duration = 22; perHour = 3; exclusive = false;
  allowed(c) { return sameDay(c.now, thanksgiving(c.now.year)) ? c.light : 0; }
  draw(img, c, age) {
    const T = Thanksgiving, y = HORIZON, x = T.X0 + (T.X1 - T.X0) * Math.min(1, age / (this.duration - 2));
    const fade = smoothFade(age, this.duration, 1), lum = 0.6 + 0.4 * c.light, strut = Math.trunc(age * 4) % 2;
    [[200, 110, 40], [150, 80, 30], [235, 180, 70], [120, 60, 30], [200, 110, 40]].forEach((col, i) => { // the tail fan
      for (let r = 2; r < 6; r++) {
        const a = Math.PI * (0.15 + 0.7 * i / 4);
        blend(img, x + 2 + Math.cos(a) * r, y - 3 - Math.sin(a) * r, mul(rgb(...col), lum), fade);
      }
    });
    const body = mul(rgb(95, 60, 38), lum);
    for (let dx = -1; dx < 3; dx++) { blend(img, x + dx, y - 2, body, fade); blend(img, x + dx, y - 3, body, fade); }
    blend(img, x - 2, y - 4, body, fade); blend(img, x - 2, y - 5, mul(rgb(170, 190, 220), lum), fade);
    blend(img, x - 3, y - 5, mul(rgb(230, 190, 60), lum), fade); blend(img, x - 3, y - 4, rgb(220, 40, 40), fade); // beak, wattle
    blend(img, x + strut, y - 1, mul(rgb(220, 180, 60), lum), fade); blend(img, x + 2 - strut, y - 1, mul(rgb(220, 180, 60), lum), fade);
    if (Math.trunc(age) % 5 === 1) text(img, Math.trunc(x) - 14, y - 12, "GOBBLE", rgb(255, 240, 220), fade);
  }
}

// The website keeps birthdays private: this only plays when triggered, with a generic banner.
export class Birthday extends Egg {
  static egg = "birthday";
  layer = "water"; duration = 32; perHour = 3; exclusive = false;
  allowed() { return 0; }
  begin(c) { this.msg = "HAPPY BIRTHDAY!"; this.fw = new Fireworks(); this.fw.begin(c); return true; }
  draw(img, c, age) {
    this.fw.draw(img, c, age);
    const x = W - age * 22, colors = [[255, 80, 80], [255, 200, 60], [90, 230, 120], [90, 170, 255], [220, 120, 255]];
    [...this.msg].forEach((ch, i) => {
      const cx = Math.trunc(x) + i * 4;
      if (cx > -4 && cx < W) text(img, cx, 11 + Math.trunc(Math.sin(age * 4 + i * 0.6) * 1.5), ch, rgb(...colors[i % 5]), 1);
    });
  }
}

export class Wish extends Egg {
  static egg = "wish";
  layer = "mountain"; duration = 1.4; perHour = 5000; exclusive = false;
  key(c) { return `${dayKey(c.now)} ${c.now.hour}:${c.now.minute}`; }
  allowed(c) {
    const h = c.now.hour % 12 || 12, m = c.now.minute;
    return ((h === 11 && m === 11) || (h === 12 && m === 34)) && fresh(this, this.key(c)) ? 1 : 0;
  }
  begin(c) { this.lastKey = this.key(c); this.x = c.rng.uniform(30, 120); this.y = c.rng.uniform(9, 12); return true; }
  draw(img, c, age) {
    const hx = this.x + age * 90, hy = this.y + age * 9, fade = Math.min(1, (this.duration - age) / 0.3);
    glow(img, hx, hy, 3, rgb(255, 250, 220), 0.5 * fade);
    for (let i = 0; i < 22; i++) blend(img, hx - i * 1.5, hy - i * 0.3, rgb(255, 250, 225), (1 - i / 22) * fade);
  }
}

export const BATCH3 = [Catapult, KiteCrash, Blossom, FallColor, Bats, Elk, SalmonRun, ColossalClaude, Kraken, RubberDucks,
  Bottle, ISSPass, GreenFlash, LunarEclipse, Valentine, StPatrick, Easter, Thanksgiving, Birthday, Wish];
