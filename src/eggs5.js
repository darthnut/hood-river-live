// Easter eggs, batch 5 (the board's eggs_more4.py): more Gorge life, rarer sky sights, lesser holidays,
// and nonsense.
import { W, H, HORIZON, TOP, rgb, blend, lighten, line, text, FONT, getFull, getView, scale as mul } from "./pix.js";
import { Egg, smoothFade, splash, disk, glow } from "./eggs.js";
import { Scene } from "./scene.js";
import { Fireworks } from "./eggs2.js";
import { moonPlanetPairs } from "./skycalc.js";

const ROW_RAIL = HORIZON - 4;
const fresh = (holder, key) => holder.lastKey !== key;
const isDay = (c, m, d) => c.now.month === m && c.now.day === d;

// The 3x5 font at `scale` times, with a dark shadow.
function bigText(img, x, y, s, col, scale = 2, alpha = 1) {
  for (const ch of s.toUpperCase()) {
    const rows = FONT[ch] || FONT[" "];
    for (let r = 0; r < 5; r++) for (let k = 0; k < 3; k++) {
      if (!(rows[r] & (4 >> k))) continue;
      for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) {
        blend(img, x + k * scale + dx + 1, y + r * scale + dy + 1, [0, 0, 0], 0.6 * alpha);
        blend(img, x + k * scale + dx, y + r * scale + dy, col, alpha);
      }
    }
    x += 4 * scale;
  }
  return x;
}

// ---------------------------------------------------------------- Gorge life

export class TrainOfLights extends Egg {
  static egg = "trainlights";
  static LIGHTS = [[255, 60, 60], [60, 230, 90], [255, 210, 60], [90, 160, 255], [255, 255, 255]];
  layer = "shore"; duration = 40; perHour = 2;
  allowed(c) {
    const season = (c.now.month === 12 && c.now.day <= 23) || (c.now.month === 11 && c.now.day >= 27);
    return season ? Math.max(c.night, c.w.twi) : 0;
  }
  draw(img, c, age) {
    const x0 = W + 10 - age * (W + 90) / this.duration, y = ROW_RAIL, lum = 0.35 + 0.65 * c.light; // heading west (left)
    for (let car = 0; car < 6; car++) {
      const cx = x0 + car * 13, body = mul(car ? rgb(40, 60, 45) : rgb(30, 30, 34), lum);
      for (let i = 0; i < 12; i++) for (const yy of [y, y - 1, y - 2]) blend(img, cx + i, yy, body, 1);
      if (car === 0) { blend(img, cx - 1, y - 1, rgb(255, 245, 200), 1); glow(img, cx - 2, y - 1, 3, rgb(255, 240, 200), 0.35); } // headlight
      else for (let i = 2; i < 11; i += 3) blend(img, cx + i, y - 1, rgb(255, 215, 140), 0.9); // warm windows
      for (let i = 0; i < 12; i += 2) { // chasing lights along the roofline and the skirt
        for (const [row, shift] of [[y - 3, 0], [y + 1, 1]]) {
          const col = rgb(...TrainOfLights.LIGHTS[(Math.floor(i / 2) + car + shift + Math.trunc(age * 4)) % 5]);
          blend(img, cx + i, row, col, 1);
          glow(img, cx + i, row, 2, col, 0.3 * c.night);
        }
      }
    }
  }
}

export class Pelicans extends Egg {
  static egg = "pelicans";
  layer = "mountain"; duration = 40; perHour = 0.3;
  allowed(c) { return c.now.month >= 5 && c.now.month <= 9 ? c.light : 0; }
  begin(c) { const r = c.rng; this.cx = r.uniform(60, 200); this.birds = Array.from({ length: 11 }, () => [r.uniform(0, 6.3), r.uniform(6, 13), r.uniform(-2, 2)]); return true; }
  draw(img, c, age) {
    const fade = smoothFade(age, this.duration, 4), cx = this.cx + age * 1.2; // the thermal drifts downwind
    const body = rgb(250, 250, 245), tip = rgb(20, 20, 24);
    for (const [ph, rad, dy] of this.birds) {
      const a = ph + age * 0.45, x = cx + Math.cos(a) * rad * 1.8, y = 14 + dy + Math.sin(a) * rad * 0.35 - age * 0.08;
      const banking = Math.sin(a) > 0.3; // the black flight feathers show as they bank away
      blend(img, x, y, body, fade); blend(img, x - 1, y, body, fade); blend(img, x + 1, y, body, fade);
      blend(img, x - 2, y - (banking ? 1 : 0), banking ? tip : body, fade); blend(img, x + 2, y - (banking ? 1 : 0), tip, fade);
      blend(img, x + 1, y + 1, rgb(255, 190, 90), 0.8 * fade); // the orange bill
    }
  }
}

export class Floatplane extends Egg {
  static egg = "floatplane";
  layer = "water"; duration = 30; perHour = 0.1;
  allowed(c) { return c.light; }
  begin(c) { this.row = c.rng.uniform(50, 55); return true; }
  depthRow() { return this.row; }
  path(age) {
    if (age < 8) { const p = age / 8; return [-20 + p * 110, 14 + (this.row - 2 - 14) * (1 - (1 - p) ** 2), p > 0.93]; } // approach
    if (age < 20) { const p = (age - 8) / 12; return [90 + 70 * (1 - (1 - p) ** 1.6), this.row - 2, true]; } // landing, taxiing
    const p = (age - 20) / 10; // take-off run and climb out to the right
    return [160 + p * 130 * p + p * 20, this.row - 2 - Math.max(0, p - 0.25) ** 1.5 * 40, p < 0.3];
  }
  draw(img, c, age) {
    const [x, y, onWater] = this.path(age), lum = 0.6 + 0.4 * c.light;
    const white = mul(rgb(245, 245, 240), lum), red = mul(rgb(210, 50, 45), lum), dark = mul(rgb(40, 40, 50), lum);
    for (let i = -4; i <= 4; i++) blend(img, x + i, y, white, 1); // fuselage
    blend(img, x + 4, y, red, 1); blend(img, x - 4, y - 1, red, 1); blend(img, x - 4, y - 2, red, 1); // tail
    for (let i = -3; i <= 3; i++) blend(img, x + i, y - 1, Math.abs(i) < 3 ? white : red, 1); // wing, edge-on
    blend(img, x + 2, y, dark, 1);
    for (const i of [-3, 3]) blend(img, x + i, y + 1, dark, 1);
    for (let i = -3; i <= 3; i++) blend(img, x + i, y + 2, mul(rgb(230, 230, 230), lum), 1); // floats
    if (Math.trunc(age * 20) % 2) blend(img, x + 5, y, rgb(200, 200, 200), 0.5); // prop blur
    if ((onWater && age > 7.5 && age < 12) || (onWater && age > 20)) {
      for (let k = 0; k < 8; k++) blend(img, x - 4 - k, y + 2 - (k % 3) * 0.5, rgb(235, 240, 255), 0.5 * (1 - k / 8)); // spray
    }
  }
}

export class DriftBoat extends Egg {
  static egg = "driftboat";
  layer = "water"; duration = 24; perHour = 0.15;
  allowed(c) { return c.light + 0.4 * c.w.twi; }
  begin(c) { this.x0 = c.rng.uniform(150, 200); this.row = c.rng.uniform(54, 58); return true; }
  depthRow() { return this.row; }
  draw(img, c, age) {
    const x = this.x0 - Math.max(0, age - 6) ** 1.6 * 2.2, y = this.row + Math.sin(age * 2) * 0.4; // towed upriver, faster and faster
    const lum = 0.6 + 0.4 * c.light, hull = mul(rgb(235, 225, 200), lum);
    for (let i = -4; i <= 4; i++) {
      blend(img, x + i, y, hull, 1);
      if (Math.abs(i) < 4) blend(img, x + i, y - 1, Math.abs(i) > 2 ? hull : mul(rgb(150, 100, 60), lum), 1);
    }
    blend(img, x - 4, y - 1, hull, 1); blend(img, x + 4, y - 1, hull, 1); // upswept bow and stern
    blend(img, x + 1, y - 2, mul(rgb(200, 60, 50), lum), 1); blend(img, x + 1, y - 3, mul(rgb(240, 200, 170), lum), 1); // angler
    const tip = age < 6 ? [x + 6, y - 7 + Math.sin(age * 3) * 0.5] : [x - 5, y - 4 + Math.sin(age * 9) * 0.6]; // the rod bends
    line(img, x + 1, y - 2, tip[0], tip[1], mul(rgb(60, 50, 40), lum), 1);
    line(img, tip[0], tip[1], age > 6 ? x - 20 : x + 10, y, rgb(230, 230, 230), 0.4);
    if (age > 6) for (let k = 0; k < 10; k++) blend(img, x + 5 + k, y + 0.4, rgb(235, 240, 255), 0.5 * (1 - k / 10));
    const b = age - 13;
    if (b >= 0 && b < 1.4) { // the fish jumps: a huge grey sturgeon
      const fx = x - 20, fy = y - Math.sin(Math.PI * b / 1.4) * 8;
      for (let i = -5; i <= 5; i++) {
        blend(img, fx + i, fy + Math.abs(i) * 0.15, mul(rgb(120, 125, 120), lum), 1);
        if (Math.abs(i) < 4) blend(img, fx + i, fy + 1, mul(rgb(190, 190, 180), lum), 1);
      }
      if (b > 1.1) splash(img, fx, y, (b - 1.1) / 0.3, 1.5);
    }
  }
}

export class LooseKite extends Egg {
  static egg = "loosekite";
  layer = "top"; duration = 14; perHour = 0.2;
  allowed(c) { return c.light; }
  begin(c) {
    const kites = c.riders.filter(r => r.kite && r.kitePos && r.x > 10 && r.x < W - 60 && r.kiteLost == null && r.crashT == null);
    if (!kites.length) return false;
    const r = kites[c.rng.integers(kites.length)];
    r.kiteLost = c.t;
    [this.x0, this.y0] = r.kitePos;
    this.col = r.color; this.col2 = r.color2;
    return true;
  }
  draw(img, c, age) {
    const x = this.x0 + age * 11, y = this.y0 - age * 1.4 + Math.sin(age * 2) * 1.5, ang = Math.sin(age * 1.9) * 1.2; // tumbling
    const lum = 0.55 + 0.45 * c.light;
    for (let j = -4; j <= 4; j++) {
      const px = x + Math.cos(ang) * j, py = y + Math.sin(ang) * j + j * j * 0.15;
      blend(img, px, py, mul(Math.abs(j) < 3 ? this.col : this.col2, lum), 1);
      blend(img, px, py + 1, mul(this.col, lum * 0.7), 1);
    }
    for (const side of [-1, 1]) line(img, x + side * 4, y + 1, x - 6 + side * 2, y + 14 + Math.sin(age * 3 + side) * 2, rgb(230, 230, 240), 0.3);
  }
}

export class LogRaft extends Egg {
  static egg = "lograft";
  layer = "water"; duration = 70; perHour = 0.1;
  allowed(c) { return c.light + 0.5 * c.w.twi; }
  depthRow() { return 43.5; }
  draw(img, c, age) {
    const x = -60 + age * (W + 70) / this.duration, y = 43, lum = 0.5 + 0.5 * c.light;
    for (let i = 0; i < 44; i++) { // the raft, logs lashed in bundles
      const col = mul(Math.floor(i / 4) % 2 ? rgb(125, 85, 50) : rgb(150, 105, 62), lum);
      blend(img, x + i, y, col, 1); blend(img, x + i, y - 1, mul(col, 0.85), 1);
    }
    const tx = x - 9, red = mul(rgb(190, 45, 40), lum), cabin = mul(rgb(240, 240, 235), lum); // the tug, pushing from behind
    for (let i = 0; i < 8; i++) { blend(img, tx + i, y, red, 1); blend(img, tx + i, y - 1, red, 1); }
    for (let i = 2; i < 6; i++) { blend(img, tx + i, y - 2, cabin, 1); blend(img, tx + i, y - 3, i !== 4 ? cabin : mul(rgb(60, 80, 110), lum), 1); }
    blend(img, tx + 3, y - 4, rgb(30, 30, 30), 1); // stack
    if (Math.trunc(age * 2) % 3 === 0) blend(img, tx + 3, y - 6, rgb(190, 190, 195), 0.5);
    for (let k = 0; k < 8; k++) blend(img, tx - 1 - k, y + 0.5, rgb(235, 240, 255), 0.45 * (1 - k / 8));
  }
}

export class SupDog extends Egg {
  static egg = "supdog";
  layer = "water"; duration = 32; perHour = 0.25;
  allowed(c) { return !c.wind || c.wind.speed < 20 ? c.light : 0.3 * c.light; }
  begin(c) { this.dir = c.rng.choice([-1, 1]); this.row = c.rng.uniform(55, 60); return true; }
  depthRow() { return this.row; }
  draw(img, c, age) {
    const d = this.dir, x = d > 0 ? -10 + age * (W + 20) / this.duration : W + 10 - age * (W + 20) / this.duration, y = this.row;
    const lum = 0.6 + 0.4 * c.light;
    for (let i = -4; i <= 4; i++) blend(img, x + i, y, mul(rgb(90, 200, 210), lum), 1); // board
    const px = x - d * 2; // paddler at the back
    blend(img, px, y - 1, mul(rgb(40, 50, 90), lum), 1); blend(img, px, y - 2, mul(rgb(250, 200, 60), lum), 1); blend(img, px, y - 3, mul(rgb(240, 200, 170), lum), 1);
    line(img, px + d, y - 3, px + d * (1 - ((age * 1.2) % 1) * 3), y + 1, mul(rgb(60, 45, 35), lum), 1);
    const dx = x + d * 3, fur = mul(rgb(170, 110, 50), lum); // the dog up front
    blend(img, dx, y - 1, fur, 1); blend(img, dx + d, y - 1, fur, 1); blend(img, dx + d * 2, y - 2, fur, 1); blend(img, dx + d * 2, y - 3, mul(fur, 0.8), 1);
    blend(img, dx - d, y - 2 - Math.trunc(age * 8) % 2, fur, 1); // tail
    for (let k = 0; k < 6; k++) blend(img, x - d * (5 + k), y + 0.4, rgb(235, 240, 255), 0.35 * (1 - k / 6));
  }
}

export class DuckFamily extends Egg {
  static egg = "ducklings";
  layer = "water"; duration = 28; perHour = 0.2;
  allowed(c) { return c.now.month >= 4 && c.now.month <= 7 ? c.light : 0.3 * c.light; }
  depthRow() { return 57; }
  draw(img, c, age) {
    const lum = 0.6 + 0.4 * c.light, x0 = W - 20 - age * 5.5, y = 57;
    const brown = mul(rgb(120, 85, 50), lum), green = mul(rgb(40, 110, 60), lum), fuzz = mul(rgb(235, 205, 90), lum);
    for (const dx of [0, 1, 2]) blend(img, x0 + dx, y, brown, 1);
    blend(img, x0, y - 1, green, 1); blend(img, x0 - 1, y - 1, mul(rgb(240, 180, 50), lum), 1); // mother's head and bill
    for (let k = 0; k < 6; k++) { // ducklings bobbing along behind in a line
      const dx = x0 + 5 + k * 3.2, dy = y + Math.sin(age * 4 + k) * 0.3;
      blend(img, dx, dy, fuzz, 1); blend(img, dx - 0.6, dy - 1, fuzz, 1);
    }
    const sx = -10 + age * 16, near = Math.exp(-(((sx - (x0 + 10)) / 18) ** 2)), sy = 58 - 6 * near; // the windsurfer swerves
    for (let i = 0; i < 8; i++) {
      const wdt = Math.max(1, Math.round((1 - i / 8) * 3.5));
      for (let j = 0; j < wdt; j++) blend(img, sx + 1 - j, sy - 1 - i, mul(rgb(255, 90, 60), lum), 1);
    }
    for (let i = -2; i <= 2; i++) blend(img, sx + i, sy, mul(rgb(245, 245, 245), lum), 1);
    for (let k = 0; k < 8; k++) blend(img, sx - 3 - k, sy + 0.4 + 6 * near * 0.1 * k, rgb(235, 240, 255), 0.4 * (1 - k / 8));
  }
}

export class Snowman extends Egg {
  static egg = "snowman";
  layer = "top"; duration = 60; perHour = 1;
  allowed(c) { return c.ground > 0.3 ? c.light : 0; }
  draw(img, c, age) {
    const fade = smoothFade(age, this.duration, 2), x = 160, base = HORIZON + 1, lum = 0.55 + 0.45 * c.light;
    const snow = mul(rgb(245, 248, 255), lum), coal = rgb(20, 20, 24), built = Math.min(1, age / 8); // rolled and stacked as you watch
    [[2.6, 0], [2.0, 4.2], [1.5, 7.6]].forEach(([r, dy], k) => { if (built * 3 > k) disk(img, x, base - dy - r + 1, r, snow, fade); });
    if (built >= 1) {
      blend(img, x + 1, base - 8, rgb(255, 140, 40), fade); blend(img, x + 2, base - 8, rgb(255, 140, 40), fade); // carrot
      blend(img, x - 1, base - 9, coal, fade); blend(img, x + 1, base - 9, coal, fade);
      line(img, x - 2, base - 5, x - 5, base - 7, mul(rgb(90, 60, 40), lum), fade); line(img, x + 2, base - 5, x + 5, base - 7, mul(rgb(90, 60, 40), lum), fade);
      for (let i = -1; i <= 1; i++) blend(img, x + i, base - 11, coal, fade); // hat
      for (let i = -2; i <= 2; i++) blend(img, x + i, base - 10, coal, fade);
    }
  }
}

export class PaperPlane extends Egg {
  static egg = "paperplane";
  layer = "over"; duration = 14; perHour = 0.2;
  pos(age) {
    if (age < 4) return [W + 5 - age * 30, 22 - age * 1.5]; // glide in from the right
    if (age < 6) { const a = (age - 4) / 2 * 2 * Math.PI; return [W - 115 - Math.sin(a) * 9, 16 - (1 - Math.cos(a)) * 6]; } // a loop
    if (age < 10) { const p = (age - 6) / 4; return [W - 115 - p * (W - 115 - 14), 16 - p * 15]; } // down onto the clock
    if (age < 12) return [14, 1]; // perched on the digits
    const p = (age - 12) / 2; return [14 + p * 60, 1 + p * 6]; // a gust takes it away
  }
  draw(img, c, age) {
    const [x, y] = this.pos(age), [x2] = this.pos(age + 0.05);
    const d = x2 < x || (age >= 10 && age < 12) ? -1 : 1, white = rgb(250, 250, 250), crease = rgb(170, 180, 200);
    for (let i = 0; i < 5; i++) blend(img, x + d * (2 - i), y, white, 1);
    blend(img, x - d, y - 1, white, 1); blend(img, x - d * 2, y - 1, crease, 1); blend(img, x - d * 2, y + 1, crease, 0.8);
  }
}

// ---------------------------------------------------------------- sky

export class Moonbow extends Egg {
  static egg = "moonbow";
  layer = "sky"; duration = 60; perHour = 2;
  allowed(c) {
    const bright = Math.abs(c.mphase - 0.5) < 0.1 && c.melev > 5 && c.melev < 42;
    const misty = c.wx && (c.wx.rain > 0 || c.wx.fog > 0.2) && c.veil < 0.8;
    return bright && misty ? c.night : 0;
  }
  draw(img, c, age) {
    const fade = smoothFade(age, this.duration, 8), cx = Math.min(Math.max(W - c.mx, 50), W - 50), cy = HORIZON + 8, r0 = 36; // opposite the moon
    for (let y = 0; y < HORIZON; y++) for (let x = 0; x < W; x++) {
      const d = Math.hypot(x - cx, y - cy);
      const band = Math.max(0, 1 - Math.abs(d - r0) / 2.2) * 0.28 * fade, tint = Math.max(0, 1 - Math.abs(d - (r0 - 1.5))) * 0.1 * fade;
      if (band <= 0 && tint <= 0) continue;
      const i = (y * W + x) * 3;
      img[i] += 0.85 * band + 0.15 * tint; img[i + 1] += 0.88 * band; img[i + 2] += 0.95 * band + 0.1 * tint;
    }
  }
}

export class SunDogs extends Egg {
  static egg = "sundogs";
  layer = "mountain"; duration = 90; perHour = 2;
  allowed(c) {
    const cold = c.wind && !c.wind.demo && c.wind.temp < 32, hazy = c.wx && c.wx.cc > 0.15 && c.wx.cc < 0.7;
    return cold && hazy && c.elev > 3 && c.elev < 25 ? 1 : 0;
  }
  draw(img, c, age) {
    const fade = smoothFade(age, this.duration, 10), [sx, sy] = c.elev > 0 ? [c.sx, c.sy] : [128, 18];
    for (const side of [-1, 1]) { // the parhelia, 22 degrees out, red on the side toward the sun
      const x = sx + side * 26;
      for (let dy = -3; dy <= 3; dy++) {
        const a = fade * (1 - Math.abs(dy) / 4);
        blend(img, x, sy + dy, rgb(255, 250, 235), 0.8 * a);
        blend(img, x - side, sy + dy, rgb(255, 120, 80), 0.45 * a);
        blend(img, x + side, sy + dy, rgb(150, 190, 255), 0.35 * a);
      }
      glow(img, x, sy, 3, rgb(255, 245, 230), 0.3 * fade);
    }
    for (let i = 0; i < 60; i++) { const a = Math.PI * i / 59; blend(img, sx + Math.cos(a) * 26, sy - Math.sin(a) * 26 * 0.8, rgb(240, 240, 250), 0.12 * fade); } // halo
  }
}

let pairsCache = [-1e12, []];
function pairsNow(ms) { // recomputed at most once a minute
  const now = performance.now();
  if (now - pairsCache[0] > 60e3) pairsCache = [now, moonPlanetPairs(ms)];
  return pairsCache[1];
}

export class MoonPlanet extends Egg {
  static egg = "moonpair";
  layer = "sky"; duration = 600; perHour = 5000; exclusive = false;
  allowed(c) { return c.melev > 3 && c.elev < -4 && c.veil < 0.6 && pairsNow(c.nowMs).length ? 1 : 0; }
  begin(c) { this.demo = !(c.melev > 3 && pairsNow(c.nowMs).length); this.duration = this.demo ? 25 : 600; return true; }
  draw(img, c, age) {
    let name, mx, my;
    if (this.demo) {
      [mx, my] = c.melev > 3 ? [c.mx, c.my] : [70, 14];
      name = "VENUS";
      glow(img, mx - 9, my + 3, 3, rgb(255, 250, 230), 0.3); blend(img, mx - 9, my + 3, rgb(255, 250, 230), 1);
    } else {
      const pairs = pairsNow(c.nowMs);
      if (!pairs.length || c.melev < 2) { this.done = true; return; }
      name = pairs.reduce((a, b) => (b[1] < a[1] ? b : a))[0].toUpperCase();
      mx = c.mx; my = c.my;
    }
    const label = `MOON + ${name}`, lx = Math.trunc(Math.min(Math.max(mx + 7, 2), W - label.length * 4 - 2)); // beside the moon
    text(img, lx, Math.max(10, Math.trunc(my) - 2), label, rgb(200, 210, 235), 0.85 * smoothFade(age, this.duration, 2));
  }
}

export class Contrails extends Egg {
  static egg = "contrails";
  layer = "mountain"; duration = 50; perHour = 3;
  allowed(c) { return c.now.hour >= 12 && c.elev > -6 && c.elev < 0 && c.veil < 0.5 ? 1 : 0; }
  begin(c) { const r = c.rng; this.jets = [0, 1].map(() => [r.uniform(-40, 60), r.uniform(4 - TOP * 0.6, 10 - TOP * 0.3), r.uniform(0.15, 0.3), r.uniform(0, 12)]); return true; }
  draw(img, c, age) {
    const fade = smoothFade(age, this.duration, 6);
    for (const [x0, y0, slope, t0] of this.jets) {
      const a = age - t0;
      if (a < 0) continue;
      const hx = x0 + a * 7;
      for (let i = 0; i < Math.trunc(Math.min(a * 7, 150)); i++) { // the trail widens and fades behind the jet
        const x = hx - i, y = y0 + (hx - i - x0) * slope, u = i / 150;
        const col = [0, 1, 2].map(k => rgb(255, 235, 215)[k] * (1 - u) + rgb(255, 200, 120)[k] * u);
        blend(img, x, y, col, 0.85 * (1 - u) * fade);
        if (i > 20) blend(img, x, y + 1, col, 0.4 * (1 - u) * fade);
      }
      blend(img, hx + 1, y0 + (hx + 1 - x0) * slope, rgb(255, 255, 255), fade);
    }
  }
}

export class GodRays extends Egg {
  static egg = "godrays";
  layer = "mountain"; duration = 80; perHour = 2;
  allowed(c) { return c.wx && c.wx.cc > 0.3 && c.wx.cc < 0.75 && c.now.hour >= 12 && c.elev > 3 && c.elev < 25 ? 1 : 0; }
  draw(img, c, age) {
    const fade = smoothFade(age, this.duration, 10), [sx, sy] = c.elev > 0 ? [c.sx, c.sy - 6] : [180, 4];
    for (let y = -TOP; y < HORIZON; y++) {
      const below = Math.min(1, Math.max(0, (y - sy) / 20));
      if (below <= 0) continue;
      for (let x = 0; x < W; x++) {
        const ang = Math.atan2(y - sy, x - sx);
        const a = Math.max(0, Math.sin(ang * 23 + 0.3 * Math.sin(age * 0.2)) * Math.sin(ang * 9 + 1.1)) * below * 0.24 * fade;
        if (a > 0) lighten(img, x, y, [1, 0.92, 0.75], a);
      }
    }
  }
}

export class Climbers extends Egg {
  static egg = "climbers";
  layer = "mountain"; duration = 150; perHour = 3;
  allowed(c) { return [5, 6].includes(c.now.month) && c.now.hour >= 1 && c.now.hour < 5 && c.veil < 0.5 ? c.night : 0; }
  draw(img, c, age) {
    const fade = smoothFade(age, this.duration, 8), [sx, sy] = c.summit;
    for (let k = 0; k < 7; k++) { // a zig-zag line of climbers, strung out
      const u = Math.min(1, 0.08 + age / this.duration * 0.5 + (6 - k) * 0.045);
      blend(img, sx + 16 - u * 15 + Math.sin(u * 20) * 1.5, sy + 15 - u * 13, rgb(255, 250, 215), fade * (0.6 + 0.4 * Math.sin(age * 3 + k * 1.7)));
    }
  }
}

// ---------------------------------------------------------------- calendar

export class Countdown extends Egg {
  static egg = "countdown";
  layer = "over"; duration = 40; perHour = 5000; exclusive = false;
  allowed(c) {
    const n = c.now;
    return n.month === 12 && n.day === 31 && n.hour === 23 && n.minute === 59 && n.second >= 50 && fresh(this, n.year) ? 1 : 0;
  }
  begin(c) { this.lastKey = c.now.year; this.fw = new Fireworks(); this.fw.begin(c); return true; }
  draw(img, c, age) {
    if (age < 10) {
      const n = String(10 - Math.trunc(age)), pulse = 1 - (age % 1) * 0.5;
      bigText(img, W / 2 - n.length * 6, 12, n, mul(rgb(255, 230, 120), pulse), 3);
    } else {
      this.fw.draw(getView(), c, age - 10); // the fireworks draw in the scene's own coordinates
      if (age < 22) bigText(img, W / 2 - 13 * 4, 13, "HAPPY NEW YEAR", rgb(255, 220, 90), 2, Math.min(1, (22 - age) / 2));
    }
  }
}

export class PiDay extends Egg {
  static egg = "piday";
  layer = "over"; duration = 12; perHour = 5000; exclusive = false;
  allowed(c) { const n = c.now; return isDay(c, 3, 14) && n.hour % 12 === 3 && n.minute === 14 && fresh(this, n.hour) ? 1 : 0; }
  begin(c) {
    this.lastKey = c.now.hour;
    const h = c.now.hour % 12 || 12;
    this.clockW = `${h}:${String(c.now.minute).padStart(2, "0")} ${c.now.hour < 12 ? "AM" : "PM"}`.length * 4;
    return true;
  }
  draw(img, c, age) {
    if (age > this.duration - 1) return;
    for (let y = 1; y < 9; y++) for (let x = 2; x < 3 + this.clockW; x++) { // paint the sky back over the clock
      const d = (y * W + x) * 3, s = x * 3;
      img[d] = img[s]; img[d + 1] = img[s + 1]; img[d + 2] = img[s + 2];
    }
    text(img, 3, 2, "3.14159", rgb(150, 220, 255), 1);
  }
}

export class BlackCat extends Egg {
  static egg = "blackcat";
  layer = "top"; duration = 24; perHour = 3;
  allowed(c) { return c.now.weekday === 4 && c.now.day === 13 ? 1 : 0; }
  draw(img, c, age) {
    const stop = age > 9 && age < 14, moving = age < 9 ? age : (stop ? 9 : age - 5);
    const x = 100 + moving * 6, y = HORIZON - 1, black = rgb(12, 12, 16), step = Math.trunc(moving * 4) % 2;
    for (let i = 0; i < 4; i++) blend(img, x + i, y - 1, black, 1);
    blend(img, x + step, y, black, 1); blend(img, x + 3 - step, y, black, 1);
    const hx = x + 4;
    for (const [dx, dy] of [[0, -2], [1, -2], [0, -3], [1, -3]]) blend(img, hx + dx, y + dy, black, 1); // head and ears
    blend(img, x - 1, y - 2, black, 1); blend(img, x - 1 + Math.sin(age * 3), y - 3, black, 1); // tail
    const eye = stop ? rgb(120, 255, 140) : rgb(90, 200, 100), a = stop || c.night > 0.4 ? 1 : 0; // green eyeshine
    blend(img, hx, y - 2, eye, a); blend(img, hx + 1, y - 2, eye, a);
    if (stop && c.night > 0.3) glow(img, hx + 0.5, y - 2, 2.5, eye, 0.45 * c.night);
  }
}

export class AprilFools extends Egg {
  static egg = "aprilfools";
  layer = "top"; duration = 60; perHour = 2;
  allowed(c) { return isDay(c, 4, 1) ? 1 : 0; }
  draw(img) { // the whole scene mirrored for a minute; the clock is drawn after, so it stays put
    img = getFull();
    for (let y = 0; y < H + TOP; y++) for (let x = 0; x < W / 2; x++) {
      const a = (y * W + x) * 3, b = (y * W + W - 1 - x) * 3;
      for (let k = 0; k < 3; k++) { const t = img[a + k]; img[a + k] = img[b + k]; img[b + k] = t; }
    }
  }
}

export class MoonLanding extends Egg {
  static egg = "moonlanding";
  layer = "sky"; duration = 300; perHour = 30; exclusive = false;
  allowed(c) { return isDay(c, 7, 20) && c.melev > 2 && c.w.day < 0.7 ? 1 : 0; }
  draw(img, c, age) {
    const [mx, my] = c.melev > 2 ? [c.mx, c.my] : [70, 14];
    if (c.melev <= 2) disk(img, mx, my, 3.8, rgb(238, 235, 215)); // a stand-in moon for the review
    const gold = rgb(230, 180, 60);
    blend(img, mx - 1, my + 1, gold, 1); blend(img, mx, my + 1, gold, 1); // lander body
    blend(img, mx - 2, my + 2, rgb(120, 120, 120), 1); blend(img, mx + 1, my + 2, rgb(120, 120, 120), 1); // legs
    blend(img, mx + 2, my, rgb(90, 90, 90), 1); blend(img, mx + 2, my - 1, rgb(90, 90, 90), 1); // flagpole
    blend(img, mx + 3, my - 1, rgb(220, 50, 50), 1); blend(img, mx + 3, my - 2, rgb(250, 250, 250), 1); // flag
    if (age < 10) text(img, Math.trunc(mx) - 22, Math.trunc(my) + 7, "JULY 20 1969", rgb(200, 210, 235), 0.8 * Math.min(1, 10 - age));
  }
}

export class Groundhog extends Egg {
  static egg = "groundhog";
  layer = "top"; duration = 16; perHour = 3;
  allowed(c) { return isDay(c, 2, 2) ? c.light : 0; }
  draw(img, c, age) {
    const sunny = c.light > 0.5 && c.veil < 0.4, x = 158, base = HORIZON + 1, back = sunny ? 8 : 14;
    const up = age < back ? Math.min(1, age / 1.5) : Math.max(0, 1 - (age - back) / 0.6);
    const lum = 0.55 + 0.45 * c.light, fur = mul(rgb(130, 90, 55), lum);
    blend(img, x - 2, base, mul(rgb(90, 70, 50), lum), 1); blend(img, x + 2, base, mul(rgb(90, 70, 50), lum), 1); // the burrow
    const h = Math.round(4 * up);
    for (let i = 0; i < h; i++) { blend(img, x, base - i, fur, 1); blend(img, x + 1, base - i, fur, 1); }
    if (h >= 3) {
      blend(img, x + 1, base - h + 1, rgb(10, 10, 10), 1); // eye
      if (sunny && age > 3) for (let i = 0; i < h; i++) blend(img, x - 1 - i, base, [0, 0, 0], 0.4); // its shadow
    }
    const msg = sunny ? "6 MORE WEEKS OF WINTER" : "EARLY SPRING!";
    if (age > 4 && age < 12) text(img, x - msg.length * 2, base - 14, msg, rgb(255, 240, 200), 0.95);
  }
}

// ---------------------------------------------------------------- nonsense

export class Burp extends Egg {
  static egg = "burp";
  layer = "mountain"; duration = 8; perHour = 0.01;
  begin(c) { const r = c.rng; this.sparks = Array.from({ length: 28 }, () => [r.uniform(-1, 1) * 9, r.uniform(9, 17), r.uniform(0, 0.5)]); return true; }
  draw(img, c, age) {
    const [sx, sy] = c.summit;
    for (const [vx, vy, t0] of this.sparks) { // glowing bits arcing up and falling back
      const a = age - t0;
      if (a >= 0 && a < 2.2) blend(img, sx + vx * a, sy - 1 - vy * a + 9 * a * a, a < 1 ? rgb(255, 200, 80) : rgb(255, 90, 40), 1 - a / 2.2);
    }
    for (let k = 0; k < 5; k++) disk(img, sx + k * 2 + age * 2, sy - 3 - age * 1.5 - k, 1.5 + age * 0.4, rgb(150, 150, 150), 0.35 * (1 - age / this.duration));
    if (age > 0.5 && age < 2.5) text(img, sx + 10, sy + 10, "*BURP*", rgb(255, 230, 200), 0.9);
  }
}

export class Dragon extends Egg {
  static egg = "dragon";
  layer = "mountain"; duration = 20; perHour = 0.02;
  allowed(c) { return c.light + 0.6 * c.w.twi + 0.3 * c.night; }
  draw(img, c, age) {
    const [sx, sy] = c.summit, a = -Math.PI / 2 + age / this.duration * 2.4 * Math.PI;
    const x = sx + Math.cos(a) * 60, y = sy + 12 + Math.sin(a) * 7, d = Math.sin(a) > 0 ? -1 : 1; // facing the way it flies
    const lum = 0.55 + 0.45 * c.light, body = mul(rgb(170, 40, 40), lum), belly = mul(rgb(240, 180, 80), lum), wing = mul(rgb(120, 25, 30), lum);
    for (let i = -4; i <= 4; i++) blend(img, x + i, y + Math.sin(age * 5 + i * 0.6) * 0.5, body, 1); // long body
    for (let i = 5; i < 9; i++) blend(img, x - d * i, y + (i - 4) * 0.4 + Math.sin(age * 5 + i) * 0.6, body, 1); // tail
    blend(img, x + d * 5, y - 1, body, 1); blend(img, x + d * 6, y - 1, body, 1); blend(img, x + d * 5, y - 2, belly, 1); // head, horn
    const flap = Math.sin(age * 7);
    for (let i = 0; i < 5; i++) { blend(img, x - d + i * 0.4, y - 1 - i * flap, wing, 1); blend(img, x - d - i * 0.4, y - 1 - i * flap * 0.9, wing, 1); }
    if (age > 9 && age < 10.6) { // fire
      const f = (age - 9) / 1.6;
      for (let k = 0; k < 10; k++) blend(img, x + d * (7 + k), y - 1 + Math.sin(k + age * 20) * 0.6, rgb(255, 220 - k * 15, 60), (1 - k / 10) * (1 - f * 0.5));
    }
  }
}

export class TimeMachine extends Egg {
  static egg = "timemachine";
  layer = "top"; duration = 12; perHour = 0.03;
  draw(img, c, age) {
    const sc = c.scene, zStart = Scene.Z_FAR * 0.8, zGone = 1.3, run = Math.min(1, (age / 5) ** 2); // accelerating toward us
    const z = zStart + (zGone - zStart) * run;
    if (age < 5) {
      const [x, y, k] = sc.project(z, 1.2), size = Math.max(1, Math.round(3 * k));
      for (let dy = 0; dy < Math.max(1, size - 1); dy++) for (let d = 0; d <= size; d++) blend(img, x + d, y - dy, rgb(200, 205, 215), 1); // stainless
      if (age > 3.2) text(img, Math.trunc(x) - 6, Math.trunc(y) - 12, "88", rgb(255, 255, 255), 1);
    } else if (age < 5.6) {
      const [x, y] = sc.project(zGone, 1.2);
      glow(img, x, y, 10 * (1 - (age - 5) / 0.6) + 2, rgb(200, 230, 255), 1);
    }
    const burn = age < 5 ? 1 : Math.max(0, 1 - (age - 5) / 7); // two fire trails where the wheels were, burning out
    for (let zz = zStart; zz > Math.max(zGone, z); zz -= 0.05) {
      for (const dx of [-0.8, 0.8]) {
        const [x, y] = sc.project(zz, 0.2, dx * 2), flick = 0.7 + 0.3 * Math.sin(age * 20 + zz * 13 + dx);
        blend(img, x, y, rgb(255, 150, 40), burn * flick); blend(img, x, y - 1, rgb(255, 220, 90), 0.5 * burn * flick);
      }
    }
  }
}

export const BATCH5 = [TrainOfLights, Pelicans, Floatplane, DriftBoat, LooseKite, LogRaft, SupDog, DuckFamily, Snowman, PaperPlane,
  Moonbow, SunDogs, MoonPlanet, Contrails, GodRays, Climbers, Countdown, PiDay, BlackCat, AprilFools, MoonLanding, Groundhog,
  Burp, Dragon, TimeMachine];
