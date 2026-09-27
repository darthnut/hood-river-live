// Easter eggs, batch 1 (the board's eggs.py): meteor, aurora, UFO, Sasquatch, salmon, sternwheeler,
// rainbow, sky whale, steam, spider, mega jump, osprey (and the eagle), shark, humpback.
import { W, H, HORIZON, rgb, blend, line, scale as mul } from "./pix.js";
import { Egg, smoothFade, sprite, splash } from "./eggs.js";

const TAU = 2 * Math.PI;

export class Meteor extends Egg {
  static egg = "meteor";
  layer = "sky"; duration = 0.8; perHour = 3.0; exclusive = false;
  allowed(c) { return Math.max(0, (c.night - 0.4) / 0.6); }
  begin(c) {
    const r = c.rng;
    this.x = r.uniform(30, W - 30); this.y = r.uniform(2, 8);
    this.vx = r.choice([-1, 1]) * r.uniform(90, 140); this.vy = r.uniform(25, 45);
    return true;
  }
  draw(img, c, age) {
    const hx = this.x + this.vx * age, hy = this.y + this.vy * age;
    const fade = Math.min(1, (this.duration - age) / 0.25);
    for (let i = 0; i < 14; i++) blend(img, hx - this.vx * 0.012 * i, hy - this.vy * 0.012 * i, rgb(255, 250, 230), (1 - i / 14) * 0.9 * fade);
  }
}

export class Aurora extends Egg {
  static egg = "aurora";
  layer = "sky"; duration = 45; perHour = 0.25;
  allowed(c) { return c.w.night > 0.7 ? 1 : 0; }
  draw(img, c, age) {
    const t = c.t, fade = smoothFade(age, this.duration, 7);
    const lo = rgb(60, 255, 140), hi = rgb(180, 70, 230);
    for (let x = 0; x < W; x++) {
      const edge = 20 + 3 * Math.sin(x * 0.035 + t * 0.2) + 2 * Math.sin(x * 0.011 - t * 0.13); // curtain bottom
      const rays = 0.6 + 0.4 * Math.sin(x * 0.3 + 2.5 * Math.sin(x * 0.04 + t * 0.5) + t * 0.9);
      const height = 14 + 4 * Math.sin(x * 0.02 + t * 0.3);
      for (let y = 0; y < HORIZON; y++) {
        const above = edge - y;
        const body = Math.min(1, Math.max(0, 1 - above / height)) * (above > -1 ? 1 : 0);
        const glow = body ** 1.5 + 0.8 * Math.exp(-((above / 1.3) ** 2));
        const up = Math.min(1, Math.max(0, above / height));
        const k = glow * rays * 0.33 * fade, i = (y * W + x) * 3;
        img[i] += (lo[0] * (1 - up) + hi[0] * up) * k;
        img[i + 1] += (lo[1] * (1 - up) + hi[1] * up) * k;
        img[i + 2] += (lo[2] * (1 - up) + hi[2] * up) * k;
      }
    }
  }
}

export class UFO extends Egg {
  static egg = "ufo";
  layer = "water"; duration = 16; perHour = 0.2;
  allowed(c) { return c.w.night; }
  depthRow() { return this.fishY; }
  begin(c) { this.hx = c.rng.uniform(120, 200); this.fishY = c.rng.uniform(50, 58); return true; }
  draw(img, c, age) {
    let x, y;
    if (age < 4) { const p = 1 - (1 - age / 4) ** 2; x = W + 10 + (this.hx - W - 10) * p; y = 13; } // glide in
    else if (age < 12) { x = this.hx + Math.sin(age * 2) * 1.2; y = 13 + Math.sin(age * 3.1) * 0.8; } // hover
    else { const p = (age - 12) / 4; x = this.hx - p * p * 260; y = 13 - p * 30; } // zip away up-left
    if (age > 5 && age < 11.5) { // tractor beam with a salmon riding it up
      const flick = 0.18 + 0.06 * Math.sin(age * 25);
      for (let yy = Math.trunc(y) + 2; yy <= Math.trunc(this.fishY); yy++) {
        const half = 1 + (yy - y) * 0.22;
        for (let xx = Math.trunc(x - half); xx <= Math.trunc(x + half); xx++) blend(img, xx, yy, rgb(120, 255, 160), flick);
      }
      if (age > 6) {
        const fy = this.fishY - (this.fishY - y - 3) * Math.min(1, (age - 6) / 4.5);
        const wiggle = Math.trunc(age * 8) % 2;
        for (let i = 0; i < 4; i++) blend(img, x - 2 + i, fy + (i === 0 ? wiggle : 0), i ? rgb(220, 160, 170) : rgb(180, 190, 200), 1);
      }
    }
    const body = rgb(170, 172, 190), dome = rgb(120, 220, 255);
    for (let dx = -5; dx <= 5; dx++) blend(img, x + dx, y + 1, body, 1);
    for (let dx = -3; dx <= 3; dx++) blend(img, x + dx, y + 2, mul(body, 0.7), 1);
    for (let dx = -2; dx <= 2; dx++) blend(img, x + dx, y, dome, 1);
    for (const dx of [-1, 0, 1]) blend(img, x + dx, y - 1, dome, 1);
    const lights = [rgb(255, 60, 60), rgb(255, 220, 40), rgb(60, 255, 90)];
    [-4, -2, 0, 2, 4].forEach((dx, i) => blend(img, x + dx, y + 1, lights[(i + Math.trunc(age * 6)) % 3], 1));
  }
}

export class Sasquatch extends Egg {
  static egg = "sasquatch";
  static SPEED = 11; static PAUSE_AT = 9; static PAUSE_S = 4;
  static WALK = [[".##..", ".###.", "####.", "#.##.", ".##..", ".#.#.", "#...#"],
    [".##..", ".###.", "####.", "#.##.", ".##..", ".##..", ".##.."]];
  static WAVE = [".##.#", ".####", "###..", "..##.", ".##..", ".#.#.", ".#.#."];
  layer = "shore"; perHour = 0.15; duration = (W + 20) / 11 + 4;
  allowed(c) { return c.w.twi + c.w.gold + 0.6 * c.w.night + 0.3 * c.w.day; }
  begin(c) { this.dir = c.rng.choice([-1, 1]); return true; }
  draw(img, c, age) {
    const S = Sasquatch, pa = S.PAUSE_AT, ps = S.PAUSE_S;
    const moving = age < pa ? age : (age < pa + ps ? pa : age - ps);
    const x = this.dir > 0 ? -8 + moving * S.SPEED : W + 3 - moving * S.SPEED;
    const waving = age >= pa && age < pa + ps;
    const rows = waving ? S.WAVE : S.WALK[Math.trunc(moving * 4) % 2];
    const y0 = HORIZON - 1 - rows.length;
    if (c.night > 0.6) { // only the eyes show in the dark, blinking now and then
      if (Math.trunc(age * 2.5) % 7 !== 0) {
        const ex = Math.trunc(x) + (this.dir > 0 ? 2 : 1);
        for (const k of [0, 2]) { blend(img, ex + k, y0 + 1, rgb(255, 60, 30), 1); blend(img, ex + k, y0, rgb(255, 60, 30), 0.25); }
      }
      return;
    }
    sprite(img, Math.trunc(x), y0, rows, { "#": mul(rgb(140, 92, 55), 0.75 + 0.25 * c.light) }, this.dir < 0);
  }
}

export class Salmon extends Egg {
  static egg = "salmon";
  layer = "water"; duration = 4.6; perHour = 1.0;
  allowed(c) { return c.light + 0.5 * c.w.twi; }
  depthRow() { return this.y0; }
  begin(c) { const r = c.rng; this.x0 = r.uniform(30, W - 30); this.y0 = r.uniform(44, 60); this.dir = r.choice([-1, 1]); return true; }
  draw(img, c, age) {
    const sc = 1 + (this.y0 - 40) / 21 * 0.6;
    [0, 1.2, 2.5].forEach((start, n) => {
      const p = (age - start) / 1.1;
      if (p < 0 || p > 1.6) return;
      const x0 = this.x0 + this.dir * n * 22, span = 14 * sc, rise = 11 * sc;
      if (p <= 1) {
        const x = x0 + this.dir * p * span, y = this.y0 - Math.sin(Math.PI * p) * rise;
        const ang = Math.atan2(-Math.cos(Math.PI * p) * rise * Math.PI, this.dir * span);
        for (let i = -3; i <= 3; i++) { // tail .. head: silver belly, rosy back, dark tail
          const col = i <= -2 ? rgb(90, 100, 120) : (i >= 1 ? rgb(240, 140, 150) : rgb(215, 225, 235));
          blend(img, x + Math.cos(ang) * i, y + Math.sin(ang) * i, col, 1);
          if (i >= -1 && i <= 1) blend(img, x + Math.cos(ang) * i - Math.sin(ang), y + Math.sin(ang) * i + Math.cos(ang), mul(col, 0.8), 1);
        }
      }
      for (const [sx, sp] of [[x0, p], [x0 + this.dir * span, p - 1]]) {
        if (sp >= 0 && sp < 0.6) { // splash and a ring where it leaves and re-enters
          const r = 2 + sp * 10;
          for (let k = 0; k < 16; k++) {
            const a = k / 16 * TAU;
            blend(img, sx + Math.cos(a) * r, this.y0 + Math.sin(a) * r * 0.3, rgb(240, 245, 255), 0.7 * (1 - sp / 0.6));
          }
          if (sp < 0.2) for (let k = -2; k <= 2; k++) blend(img, sx + k, this.y0 - (3 - Math.abs(k)), rgb(250, 252, 255), 0.9);
        }
      }
    });
  }
}

export class Sternwheeler extends Egg {
  static egg = "sternwheeler";
  static SPEED = 7;
  layer = "water"; perHour = 0.3; duration = (W + 50) / 7;
  allowed(c) { return c.w.day + 0.7 * c.w.gold; }
  begin(c) { this.dir = c.rng.choice([-1, 1]); return true; }
  depthRow() { return 48; }
  draw(img, c, age) {
    const x = Math.trunc(this.dir > 0 ? -40 + age * Sternwheeler.SPEED : W + 10 - age * Sternwheeler.SPEED), y = 47;
    const white = rgb(238, 236, 228), window = rgb(40, 60, 110), red = rgb(200, 40, 40), black = rgb(25, 25, 30);
    const X = i => (this.dir > 0 ? x + i : x + 27 - i); // i = 0 at the stern (the wheel) .. 27 at the bow
    for (let i = 2; i < 27; i++) { blend(img, X(i), y, white, 1); blend(img, X(i), y + 1, rgb(60, 55, 60), 1); }
    for (let i = 4; i < 24; i++) for (const yy of [y - 1, y - 2]) blend(img, X(i), yy, i % 2 && yy === y - 2 ? window : white, 1);
    for (let i = 8; i < 20; i++) for (const yy of [y - 3, y - 4]) blend(img, X(i), yy, i % 2 && yy === y - 4 ? window : white, 1);
    for (let i = 12; i < 16; i++) blend(img, X(i), y - 5, white, 1);
    for (const i of [13, 15]) for (const yy of [y - 8, y - 7, y - 6]) blend(img, X(i), yy, black, 1);
    const spin = Math.trunc(age * 6) % 2;
    for (let i = 0; i < 3; i++) for (let yy = y - 2; yy < y + 2; yy++) {
      blend(img, X(i), yy, (i + yy + spin) % 2 === 0 ? red : mul(red, 0.55), 1);
    }
    for (let i = -6; i < 0; i++) blend(img, X(i), y + 1, rgb(230, 235, 250), 0.5 * (1 + i / 7)); // wake
    if (Math.trunc(age * 2) % 3 === 0) blend(img, X(14), y - 10, rgb(200, 200, 205), 0.5);
  }
}

export class Rainbow extends Egg {
  static egg = "rainbow";
  static BANDS = [[255, 50, 50], [255, 140, 30], [255, 230, 40], [60, 220, 70], [50, 140, 255], [90, 70, 220], [160, 70, 210]];
  layer = "sky"; duration = 45; perHour = 0.2;
  allowed(c) { return c.elev > 6 && c.elev < 42 ? c.w.day : 0; }
  draw(img, c, age) {
    const fade = smoothFade(age, this.duration, 8);
    const cx = Math.min(Math.max(W - c.sx, 50), W - 50), cy = HORIZON + 8, r0 = 38; // opposite the sun
    const bands = Rainbow.BANDS.map(b => rgb(...b));
    for (let y = 0; y < HORIZON; y++) for (let x = 0; x < W; x++) {
      const d = Math.hypot(x - cx, y - cy);
      if (d < r0 - 8 || d > r0 + 1) continue;
      const i = (y * W + x) * 3;
      bands.forEach((col, k) => {
        const band = Math.max(0, 1 - Math.abs(d - (r0 - k)) / 0.7) * 0.3 * fade;
        if (band > 0) { img[i] += col[0] * band; img[i + 1] += col[1] * band; img[i + 2] += col[2] * band; }
      });
    }
  }
}

export class SkyWhale extends Egg {
  static egg = "whale";
  static ROWS = ["..........bbbbbbb.........", ".......bbbbbbbbbbbbb......", ".....bbbbbbbbbbbbbbbbb..tt",
    "...bbebbbbbbbbbbbbbbbbbttt", "..bbbbbbbbbbbbbbbbbbbbbbt.", ".bbbbbbbbbbbbbbbbbbbbbb...",
    "bbllllllllllbbbbbbbbb.....", ".blllllllllllllbbbb.......", "..dldldldldlll............",
    "....llllll................"];
  layer = "mountain"; perHour = 0.08; duration = (W + 50) / 9;
  begin(c) { this.dir = c.rng.choice([-1, 1]); return true; }
  draw(img, c, age) {
    const x = this.dir > 0 ? -30 + age * 9 : W + 4 - age * 9, y = 9 + Math.sin(age * 0.6) * 2.5;
    const lum = 0.55 + 0.45 * (1 - c.night);
    const pal = { b: mul(rgb(205, 190, 240), lum), t: mul(rgb(205, 190, 240), lum), l: mul(rgb(250, 235, 215), lum),
      e: rgb(20, 10, 30), d: mul(rgb(150, 140, 180), lum) };
    sprite(img, Math.trunc(x), Math.trunc(y), SkyWhale.ROWS, pal, this.dir > 0); // the sprite faces left
    const s = age % 12;
    if (s > 6 && s < 7.5) { // spout from the blowhole
      const hx = x + (this.dir > 0 ? 20 : 5);
      for (let k = 0; k < 5; k++) blend(img, hx + (k % 3 - 1), y - 1 - k * 0.8 * (s - 6), rgb(200, 230, 255), 0.6);
    }
  }
}

export class Steam extends Egg {
  static egg = "steam";
  layer = "mountain"; duration = 25; perHour = 0.2;
  allowed(c) { return c.light + 0.5 * c.w.twi; }
  begin(c) { this.puffs = Array.from({ length: 40 }, () => [c.rng.uniform(0, 18), c.rng.uniform(-0.6, 0.6)]); return true; }
  draw(img, c, age) {
    const [sx, sy] = c.summit;
    for (const [born, jitter] of this.puffs) {
      const a = age - born;
      if (a < 0 || a >= 8) continue;
      // the summit is near the top edge, so the plume streams downwind (right) and barely rises
      const x = sx + 1 + jitter + a * 4.0 + Math.sin(a * 1.5 + born) * 0.8;
      const y = sy + 1 - a * 0.25 + Math.sin(a * 0.9 + born) * 0.5;
      const r = 1 + a * 0.25, ri = Math.trunc(r);
      for (let dy = -ri; dy <= ri; dy++) for (let dx = -ri; dx <= ri; dx++) {
        if (dx * dx + dy * dy <= r * r) blend(img, x + dx, y + dy, rgb(245, 245, 250), 0.6 * (1 - a / 8));
      }
    }
  }
}

export class Spider extends Egg {
  static egg = "spider";
  static ROWS = ["l..k..l", ".lkkkl.", "lkkwkkl", ".kEkEk.", "l.ggg.l", ".l...l."];
  layer = "top"; duration = 14; perHour = 0.25;
  begin(c) { this.x = Math.trunc(c.rng.uniform(96, 156)); return true; }
  draw(img, c, age) {
    let y;
    if (age < 3) y = -7 + 27 * (1 - (1 - age / 3) ** 3);
    else if (age < 10) y = 20 + Math.sin((age - 3) * 2.2) * 1.2;
    else y = 20 - (age - 10) / 4 * 30;
    line(img, this.x + 3, 0, this.x + 3, y, rgb(210, 210, 220), 0.45);
    const glint = 0.6 + 0.4 * Math.sin(age * 5);
    const pal = { k: rgb(38, 36, 44), l: rgb(70, 58, 50), w: rgb(235, 235, 235), E: mul(rgb(255, 255, 255), glint), g: rgb(40, 210, 150) };
    sprite(img, this.x, Math.trunc(y), Spider.ROWS, pal);
  }
}

export class MegaJump extends Egg {
  static egg = "megajump";
  layer = "none"; duration = 3.5; perHour = 0.4;
  allowed(c) { return c.light; }
  begin(c) {
    const kiters = c.riders.filter(r => r.kite && r.x > 30 && r.x < W - 30);
    if (!kiters.length) return false;
    kiters[0].megaT = c.t;
    return true;
  }
}

export class Osprey extends Egg {
  static egg = "osprey";
  static GLIDE = ["dd.......dd", ".dd.....dd.", "..ddwwwdd..", ".....w....."]; // crooked M wings, white underside
  static FLAP = ["...........", "..ddwwwdd..", ".dd..w..dd.", "dd.......dd"];
  static STOOP = ["d.d", "dwd", "dwd", ".w.", ".w.", ".d."]; // wings folded back, head down
  static T_GLIDE = 3.0; static T_DIVE = 1.1; static T_SPLASH = 0.6; static T_CLIMB = 1.4; static DURATION = 9.5;
  layer = "water"; duration = 9.5; perHour = 0.3;
  allowed(c) { return c.light + 0.5 * c.w.twi; }
  depthRow() { return this.lastVariant === "left" ? H : this.ty; } // the left version stays in front of the bridge

  // "right" dives over the open river right of centre; "left" dives just past the bridge's far end;
  // "eagle" has a bald eagle mug the osprey for its fish on the way out.
  begin(c) {
    const r = c.rng;
    const variant = this.variant || r.choice(["left", "right"]);
    this.variant = null; this.lastVariant = variant;
    this.eagle = variant === "eagle";
    this.duration = this.eagle ? 12 : Osprey.DURATION;
    if (variant === "left") { this.dir = -1; this.tx = r.uniform(96, 118); }
    else if (variant === "eagle") { this.dir = r.choice([-1, 1]); this.tx = r.uniform(120, 150); }
    else { this.dir = r.choice([-1, 1]); this.tx = r.uniform(110, 220); }
    this.ty = r.uniform(47, 57);
    this.x0 = this.dir > 0 ? -12 : W + 12;
    return true;
  }

  draw(img, c, age) {
    const O = Osprey, d = this.dir;
    const pal = { d: mul(rgb(48, 34, 28), 0.6 + 0.4 * c.light), w: mul(rgb(245, 244, 238), 0.5 + 0.5 * c.light) };
    const fish = rgb(190, 202, 214);
    const t1 = O.T_GLIDE, t2 = t1 + O.T_DIVE, t3 = t2 + O.T_SPLASH, t4 = t3 + O.T_CLIMB;
    if (age < t1) { // glide in, with a lazy flap now and then
      const p = age / t1;
      const x = this.x0 + (this.tx - this.x0) * p, y = 10 + 2 * Math.sin(p * 5);
      sprite(img, Math.trunc(x) - 5, Math.trunc(y), Math.trunc(age * 4) % 5 === 0 ? O.FLAP : O.GLIDE, pal, d < 0);
      return;
    }
    if (age < t2) { // stoop: accelerating dive
      const p = (age - t1) / O.T_DIVE;
      sprite(img, Math.trunc(this.tx + d * 6 * p) - 1, Math.trunc(11 + (this.ty - 4 - 11) * p * p), O.STOOP, pal);
      return;
    }
    const sx = this.tx + d * 6;
    if (age < t3) { // splash: a burst of spray and a ring
      const p = (age - t2) / O.T_SPLASH;
      for (let k = 0; k < 14; k++) {
        const ang = Math.PI * (0.1 + 0.8 * k / 13), v = 9 + (k % 3) * 3;
        blend(img, sx + Math.cos(ang) * v * p * 0.9, this.ty - Math.sin(ang) * v * p + 14 * p * p, rgb(240, 245, 255), 0.9 * (1 - p));
      }
      const r = 1 + p * 6;
      for (let k = 0; k < 16; k++) {
        const a = k / 16 * TAU;
        blend(img, sx + Math.cos(a) * r, this.ty + Math.sin(a) * r * 0.3, rgb(235, 240, 255), 0.7 * (1 - p));
      }
      return;
    }
    const [x, y, rows] = this.flight(age);
    sprite(img, Math.trunc(x) - 5, Math.trunc(y), rows, pal, d < 0);
    const hasFish = this.eagle ? this.drawEagle(img, c, age, fish) : true;
    if (hasFish) {
      for (const i of [-1, 0, 1]) blend(img, x + i, y + 4, fish, 1);
      blend(img, x - d * 2, y + 4, mul(fish, 0.7), 1); // tail
    }
    if (age < t4) for (let k = 0; k < 3; k++) blend(img, x + (k - 1) * 2, y + 5 + ((age * 20 + k * 3) % 5), rgb(220, 230, 255), 0.6);
  }

  flight(age) { // where the osprey is after leaving the water
    const O = Osprey, d = this.dir, t3 = O.T_GLIDE + O.T_DIVE + O.T_SPLASH, t4 = t3 + O.T_CLIMB, sx = this.tx + d * 6;
    if (age < t4) { // climb out heavily, fish in the talons
      const p = (age - t3) / O.T_CLIMB;
      return [sx + d * 18 * p, this.ty - 2 - (this.ty - 30) * (1 - (1 - p) ** 2), Math.trunc(age * 7) % 2 ? O.FLAP : O.GLIDE];
    }
    let p = (age - t4) / (O.DURATION - t4); // away, up and out of frame
    if (this.eagle && age > t4 + 1) p += (age - t4 - 1) * 0.08; // mugged: fleeing fast
    return [sx + d * (18 + 150 * p), 30 - 42 * p, Math.trunc(age * 5) % 2 ? O.FLAP : O.GLIDE];
  }

  // The bald eagle swoops in, snatches the fish at the top of the climb; returns whether the osprey keeps it.
  drawEagle(img, c, age, fish) {
    const O = Osprey, d = this.dir;
    const tMeet = O.T_GLIDE + O.T_DIVE + O.T_SPLASH + O.T_CLIMB + 0.6;
    const [mx, my] = this.flight(tMeet);
    const lum = 0.6 + 0.4 * c.light;
    const brown = mul(rgb(58, 38, 24), lum), white = mul(rgb(250, 250, 245), lum), gold = mul(rgb(250, 190, 40), lum);
    let ex, ey;
    if (age < tMeet) {
      const p = (age - (tMeet - 3)) / 3;
      if (p < 0) return true;
      ex = mx - d * 110 * (1 - p); ey = my - 4 - 18 * (1 - p) ** 2 + 3; // a long descending swoop
    } else {
      const q = age - tMeet;
      ex = mx + d * 22 * q; ey = my - 1 - 3 * q;
    }
    const flap = Math.trunc(age * 6) % 2;
    for (let i = -3; i < 3; i++) blend(img, ex + d * i, ey, brown, 1);
    for (let i = -2; i < 2; i++) {
      blend(img, ex + d * i, ey - 1 - flap * 2, brown, 1);
      blend(img, ex + d * i, flap ? ey - 2 + flap * 3 : ey - 1, brown, 1);
      blend(img, ex + d * (i - 1), ey - 3 + flap * 5, brown, 1);
    }
    blend(img, ex + d * 3, ey, white, 1); blend(img, ex + d * 3, ey - 1, white, 1); blend(img, ex + d * 4, ey, gold, 1);
    blend(img, ex - d * 4, ey, white, 1); blend(img, ex - d * 5, ey, white, 1);
    if (age >= tMeet) { // the prize, and a burst of feathers at the grab
      for (const i of [-1, 0, 1]) blend(img, ex + i, ey + 2, fish, 1);
      if (age < tMeet + 0.5) {
        for (let k = 0; k < 6; k++) {
          const a = k * 1.05 + age * 3;
          blend(img, mx + Math.cos(a) * (age - tMeet) * 14, my + 2 + Math.sin(a) * (age - tMeet) * 8, white, 0.8);
        }
      }
      return false;
    }
    return true;
  }
}

export class Shark extends Egg {
  static egg = "shark";
  static JAWS = ["......g......", ".....ggg.....", "....ggggg....", "...ggggggg...", "..gwkkkkkwg..",
    "..gkwkwkwkg..", "..gkkkkkkkg..", "..gkwkwkwkg..", "..gwkkkkkwg..", "...gwwwwwg...", "....wwwww...."];
  static RISE = 0.4; static HOLD = 0.7; static SINK = 0.4;
  layer = "water"; duration = 30; perHour = 0.15;
  allowed(c) { return c.light; }
  begin(c) {
    const prey = c.riders.filter(r => !r.kite && r.x > 40 && r.x < W - 40);
    if (!prey.length) return false;
    const toward = prey.filter(r => r.dir > 0);
    this.prey = (toward.length ? toward : prey).reduce((a, b) => (b.y > a.y ? b : a)); // the nearest one reads best
    this.row = this.prey.y;
    this.fx = W + 12; // comes up the river from downstream (the right)
    this.phase = "hunt"; this.phaseT = 0;
    return true;
  }
  depthRow() { return this.row; }
  draw(img, c, age) {
    const S = Shark, dt = c.dt, sc = 0.6 + (this.row - 40) / 21 * 0.9;
    const finCol = mul(rgb(70, 78, 92), 0.6 + 0.4 * c.light), wake = rgb(235, 240, 255);
    this.phaseT += dt;
    if (this.phase === "hunt") {
      const gap = this.prey.x - this.fx;
      this.fx += Math.max(-32 * dt, Math.min(32 * dt, gap));
      Shark.fin(img, this.fx, this.row + Math.sin(age * 1.7) * 0.4, sc, finCol, wake);
      if (Math.abs(this.fx - this.prey.x) < 3) { this.phase = "strike"; this.phaseT = 0; this.jx = this.prey.x; }
      else if (this.phaseT > 16 || !(this.prey.x > -20 && this.prey.x < W + 20)) { this.phase = "leave"; this.phaseT = 0; this.jx = this.fx; }
    } else if (this.phase === "strike") {
      const p = this.phaseT;
      let rise;
      if (p < S.RISE) rise = p / S.RISE;
      else if (p < S.RISE + S.HOLD) { rise = 1; this.prey.eaten = true; }
      else rise = Math.max(0, 1 - (p - S.RISE - S.HOLD) / S.SINK);
      const shown = Math.max(0, Math.round(S.JAWS.length * rise));
      sprite(img, Math.trunc(this.jx) - 6, Math.round(this.row) - shown, S.JAWS.slice(0, shown),
        { g: rgb(95, 105, 120), w: rgb(240, 240, 240), k: rgb(60, 12, 24) });
      splash(img, this.jx, this.row, Math.min(1, p / 1.1), 1.3);
      if (p > S.RISE + S.HOLD + S.SINK) { this.prey.reset(); this.prey.eaten = false; this.phase = "leave"; this.phaseT = 0; }
    } else { // the fin slips away upriver and sinks
      const p = this.phaseT / 2;
      this.jx -= 22 * dt;
      Shark.fin(img, this.jx, this.row, sc * (1 - p), finCol, wake);
      if (p >= 1) this.done = true;
    }
  }
  static fin(img, x, y, sc, col, wake) {
    const h = Math.round(3 * sc) + 1;
    for (let i = 0; i < h; i++) for (let j = 0; j < h - i; j++) blend(img, x + j, y - 1 - i, col, 1);
    for (let k = 1; k < 9; k++) { // V wake spreading behind it
      const a = 0.5 * (1 - k / 9);
      blend(img, x + h + k, y - k * 0.12, wake, a);
      blend(img, x + h + k, y + k * 0.25, wake, a);
    }
  }
}

export class Humpback extends Egg {
  static egg = "humpback";
  static SPEED = 8.5;
  static BODY = ["........dddd..........", "....dddddddddddd......", "..dddddddddddddddd....",
    ".ddedddddddddddddddd.d", "dddwwwddddddddddddddd.", ".dwwwwwwddddddddd..ddd",
    "..wwwwww.wwww....ddd..", "...ww............d...."];
  static FLUKES = ["dd.......dd", "ddd.....ddd", ".dddd.dddd.", "...ddddd...", "....ddd...."];
  layer = "water"; perHour = 0.08; duration = (W + 60) / 8.5;
  allowed(c) { return c.light + 0.4 * c.w.twi; }
  begin(c) { this.row = c.rng.uniform(53, 57); this.breachAt = (W / 2 + 20) / Humpback.SPEED; return true; }
  depthRow() { return this.row; }
  draw(img, c, age) {
    const x = W + 20 - age * Humpback.SPEED, y = this.row, lum = 0.6 + 0.4 * c.light;
    const pal = { d: mul(rgb(46, 52, 66), lum), w: mul(rgb(232, 236, 242), lum), e: rgb(12, 12, 16) };
    if (!(x > -20 && x < W + 4)) return;
    for (const tSpout of [4, 11, this.breachAt + 8]) { // surface and blow
      const a = age - tSpout;
      if (a <= -1.2 || a >= 2.2) continue;
      const arch = Math.sin(Math.PI * Math.min(1, (a + 1.2) / 3.4));
      for (let dx = -6; dx <= 6; dx++) {
        const hgt = arch * 2.2 * Math.cos(dx / 7 * Math.PI / 2);
        for (let dy = 0; dy < Math.round(hgt); dy++) blend(img, x + dx, y - 1 - dy, pal.d, 1);
      }
      if (a >= 0 && a < 1.6) { // the blow: a tall bushy column of spray
        const rise = Math.sin(Math.PI * Math.min(1, a / 1.6));
        for (let k = 0; k < 22; k++) {
          const spread = (k % 7 - 3) * 0.45 * (0.4 + a), hgt = 11 * rise * (0.45 + 0.55 * ((k * 5) % 11) / 10);
          blend(img, x - 5 + spread, y - 3 - hgt, rgb(236, 242, 252), 0.95 * (1 - a / 1.6) + 0.05);
        }
      }
    }
    const b = age - this.breachAt; // the breach
    if (b >= 0 && b < 2.6) {
      const p = Math.min(1, b / 2), lift = Math.sin(Math.PI * p) * 11, tilt = (0.5 - p) * 1.6, h = Humpback.BODY.length;
      if (b < 2) Humpback.BODY.forEach((row, r) => {
        const shear = Math.round((r - h / 2) * tilt);
        sprite(img, Math.trunc(x) - 11 + shear, Math.trunc(y - h + 2 - lift) + r, [row], pal);
      });
      if (b < 0.4) splash(img, x, y, b / 0.4, 0.8);
      if (b >= 2) splash(img, x, y, (b - 2) / 0.6, 2.0);
    }
    const f = age - (this.breachAt + 8 + 2.2); // flukes up as it dives after the last blow
    if (f >= 0 && f < 1.6) sprite(img, Math.trunc(x) + 3, Math.trunc(y - 4 - Math.sin(Math.PI * f / 1.6) * 6), Humpback.FLUKES, pal);
  }
}

export const BATCH1 = [Meteor, Aurora, UFO, Sasquatch, Salmon, Sternwheeler, Rainbow, SkyWhale, Steam, Spider, MegaJump,
  Osprey, Shark, Humpback];
