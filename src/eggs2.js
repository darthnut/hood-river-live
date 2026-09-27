// Easter eggs, batch 2 (the board's eggs_more.py): Gorge wildlife and history, calendar specials, and
// a few just for fun.
import { W, H, HORIZON, rgb, blend, line, text, scale as mul } from "./pix.js";
import { Egg, smoothFade, sprite, splash, disk, glow, dayNumber } from "./eggs.js";
import { Rng } from "./rng.js";
import { hoodRiverTime, localParts } from "./sky.js";

const isNight = (c, level = 0.4) => (c.night > level ? 1 : 0);

// ---------------------------------------------------------------- Gorge life

export class SeaLion extends Egg {
  static egg = "sealion";
  static HEAD = ["..bb.", ".bbbb", "bbebb", ".bbbn"];
  layer = "water"; duration = 7; perHour = 0.3;
  allowed(c) { return c.light + 0.5 * c.w.twi; }
  begin(c) { this.x = c.rng.uniform(60, W - 60); this.row = c.rng.uniform(46, 56); this.dir = c.rng.choice([-1, 1]); return true; }
  depthRow() { return this.row; }
  draw(img, c, age) {
    const lum = 0.55 + 0.45 * c.light;
    const pal = { b: mul(rgb(96, 70, 48), lum), e: rgb(15, 10, 8), n: rgb(40, 28, 22) };
    const x = this.x, y = this.row, flip = this.dir < 0;
    if (age < 1) { // surfacing
      const shown = Math.round(4 * age);
      sprite(img, Math.trunc(x), Math.trunc(y) - shown, SeaLion.HEAD.slice(0, shown), pal, flip);
    } else if (age < 3.4) { // head up, barking twice
      sprite(img, Math.trunc(x), Math.trunc(y) - 4, SeaLion.HEAD, pal, flip);
      for (const tBark of [1.4, 2.4]) {
        const b = age - tBark;
        if (b >= 0 && b < 0.7) {
          text(img, Math.trunc(x) + (this.dir > 0 ? 6 : -13), Math.trunc(y) - 11 - Math.trunc(b * 3), "ARF", rgb(250, 250, 255), 0.9 * (1 - b / 0.7));
        }
      }
    }
    const fx = x + this.dir * 14;
    if (age >= 3 && age < 4.2) { // a salmon leaps just ahead of it
      const p = (age - 3) / 1.2, sx = fx + this.dir * 8 * p, sy = y - Math.sin(Math.PI * p) * 6;
      for (let i = -1; i <= 1; i++) blend(img, sx + i, sy, i ? rgb(230, 150, 160) : rgb(210, 220, 230), 1);
    }
    if (age >= 3.4 && age < 4.6) { // the lunge: a brown arc after it
      const p = (age - 3.4) / 1.2;
      for (let k = 0; k < 9; k++) {
        const u = k / 8;
        const bx = x + this.dir * (4 + 14 * p) - this.dir * u * 7, by = y - Math.sin(Math.PI * p) * 7 + (u - 0.5) ** 2 * 6;
        blend(img, bx, by, pal.b, 1); blend(img, bx, by + 1, mul(pal.b, 0.8), 1);
      }
    }
    if (age >= 4.4) splash(img, fx + this.dir * 4, y, Math.min(1, (age - 4.4) / 1.2), 1);
  }
}

export class Geese extends Egg {
  static egg = "geese";
  layer = "mountain"; duration = 18; perHour = 1.2; exclusive = false;
  allowed(c) { return [3, 4, 9, 10, 11].includes(c.now.month) ? c.light + 0.6 * c.w.twi : 0; }
  begin(c) { this.dir = c.rng.choice([-1, 1]); this.y = c.rng.uniform(8, 16); this.n = c.rng.integers(9, 14); return true; }
  draw(img, c, age) {
    const lead = this.dir < 0 ? W + 30 - age * 17 : -30 + age * 17;
    const col = c.w.day > 0.3 ? rgb(38, 34, 30) : rgb(24, 20, 26);
    for (let i = 0; i < this.n; i++) {
      const rank = Math.trunc((i + 1) / 2), side = i % 2 ? 1 : -1;
      const gx = lead - this.dir * rank * 3.2, gy = this.y + (i ? side * rank * 1.6 : 0);
      const up = Math.trunc(age * 5 + i) % 2;
      blend(img, gx, gy, col, 1); blend(img, gx - 1, gy - 1 + 2 * up, col, 1); blend(img, gx + 1, gy - 1 + 2 * up, col, 1);
    }
  }
}

export class Heron extends Egg {
  static egg = "heron";
  static T_FLY = 7; static T_STAND = 11;
  layer = "water"; duration = 22; perHour = 0.3;
  allowed(c) { return c.light + 0.6 * c.w.twi; }
  begin(c) { this.dir = c.rng.choice([-1, 1]); return true; }
  draw(img, c, age) {
    const lum = 0.55 + 0.45 * c.light, T_FLY = Heron.T_FLY, T_STAND = Heron.T_STAND;
    const body = mul(rgb(120, 140, 170), lum), dark = mul(rgb(50, 60, 80), lum), bill = mul(rgb(220, 190, 90), lum);
    const [px, py] = c.perch, d = this.dir;
    const start = d > 0 ? [-15, HORIZON - 10] : [W + 15, HORIZON - 10], end = d > 0 ? [W + 20, 6] : [-20, 6];
    if (age < T_FLY || age > T_FLY + T_STAND) { // flying: neck tucked, legs trailing
      let x, y;
      if (age < T_FLY) { const p = age / T_FLY; x = start[0] + (px - start[0]) * p; y = start[1] + (py - 4 - start[1]) * p; }
      else { const p = (age - T_FLY - T_STAND) / (this.duration - T_FLY - T_STAND); x = px + (end[0] - px) * p; y = py - 4 + (end[1] - py + 4) * p; }
      const flap = Math.sin(age * 5);
      for (let i = -2; i <= 2; i++) blend(img, x + i, y, body, 1);
      blend(img, x + d * 3, y, bill, 1); blend(img, x + d * 4, y, bill, 1);
      for (let i = 3; i < 6; i++) blend(img, x - d * i, y + 0.3 * i, dark, 1);
      for (let i = 1; i < 5; i++) blend(img, x + (i % 2) * d, y - flap * i * 0.9, dark, 1);
      return;
    }
    const stab = (age - T_FLY) % 4 > 3.3; // standing on the perch, now and then stabbing at the water
    const x = px, y = py;
    for (const i of [0, 1, 2]) { blend(img, x, y - i, dark, 1); blend(img, x + 1, y - i, dark, 1); }
    for (let i = -2; i < 2; i++) { blend(img, x + i, y - 3, body, 1); blend(img, x + i, y - 4, body, 1); }
    const [hx, hy] = stab ? [x + d * 3, y - 2] : [x + d, y - 7];
    line(img, x, y - 4, hx, hy, body, 1);
    blend(img, hx + d, hy, bill, 1); blend(img, hx + d * 2, hy + (stab ? 1 : 0), bill, 1);
  }
}

export class Paragliders extends Egg {
  static egg = "paragliders";
  static COLORS = [[255, 70, 90], [60, 200, 255], [255, 210, 50]];
  layer = "shore"; duration = 28; perHour = 0.25;
  allowed(c) { return c.w.day + 0.5 * c.w.gold; }
  begin(c) { this.pilots = [0, 1, 2].map(k => [c.rng.uniform(205, 245), c.rng.uniform(8, 15), c.rng.uniform(0, 6.3), k]); return true; }
  draw(img, c, age) {
    const fade = smoothFade(age, this.duration, 2);
    for (const [x0, y0, ph, k] of this.pilots) {
      const y = y0 + age * 0.75, x = x0 - age * 3.2 + 6 * Math.sin(age * 0.6 + ph);
      if (y > HORIZON - 4) continue; // landed
      const col = rgb(...Paragliders.COLORS[k]);
      for (let j = -3; j <= 3; j++) blend(img, x + j, y + j * j * 0.18, col, fade);
      blend(img, x, y + 5, rgb(40, 40, 50), fade);
      line(img, x - 3, y + 1.6, x, y + 5, rgb(220, 220, 230), 0.35 * fade);
      line(img, x + 3, y + 1.6, x, y + 5, rgb(220, 220, 230), 0.35 * fade);
    }
  }
}

export class Sturgeon extends Egg {
  static egg = "sturgeon";
  static LENGTH = 30;
  layer = "water"; duration = 8; perHour = 0.05;
  allowed(c) { return c.light + 0.4 * c.w.twi; }
  begin(c) { this.x = c.rng.uniform(40, W - 70); this.row = c.rng.uniform(50, 57); return true; }
  depthRow() { return this.row; }
  draw(img, c, age) {
    const lum = 0.55 + 0.45 * c.light, L = Sturgeon.LENGTH;
    const back = mul(rgb(98, 90, 76), lum), scute = mul(rgb(176, 166, 144), lum), belly = mul(rgb(200, 196, 186), lum);
    const rise = age < 5.5 ? Math.min(1, age / 2) : Math.max(0, 1 - (age - 5.5) / 2);
    const roll = age > 2.5 && age < 4.5;
    for (let i = 0; i < L; i++) {
      const thick = Math.sin(Math.PI * Math.min(1, i / (L - 1) * 1.15)) * 3 * rise, x = this.x + i;
      for (let dy = 0; dy < Math.round(thick); dy++) blend(img, x, this.row - dy, roll && dy === 0 ? belly : back, 1);
      if (i % 4 === 1 && thick > 1.2) blend(img, x, this.row - Math.round(thick), scute, 1); // bony scutes
    }
    if (rise > 0.5) { const tx = this.x + L; blend(img, tx, this.row - 2, back, 1); blend(img, tx + 1, this.row - 3, back, 1); }
    if (age > 0.3 && age < 1.6) splash(img, this.x + 10, this.row, (age - 0.3) / 1.3, 0.8);
  }
}

// ---------------------------------------------------------------- history and landmarks

export class SteamTrain extends Egg {
  static egg = "steamtrain";
  static SPEED = 11;
  layer = "shore"; perHour = 0.3; duration = (W + 70) / 11;
  allowed(c) { return c.light + 0.7 * c.w.twi; }
  begin(c) { this.dir = c.rng.choice([-1, 1]); this.puffs = []; return true; }
  draw(img, c, age) {
    const [x0, x1] = c.rail_span, row = c.rail_row, d = this.dir;
    const head = d > 0 ? x0 - 10 + age * SteamTrain.SPEED : x1 + 10 - age * SteamTrain.SPEED;
    const lum = 0.45 + 0.55 * (1 - c.night);
    const black = mul(rgb(30, 30, 34), lum), red = mul(rgb(200, 40, 30), lum), maroon = mul(rgb(120, 34, 38), lum), cream = mul(rgb(230, 214, 170), lum);
    const put = (x, y, col) => { if (x >= x0 && x < x1) blend(img, x, y, col, 1); };
    for (let i = 0; i < 8; i++) { // locomotive: boiler, cab, stack, red cowcatcher
      const x = head - d * i;
      put(x, row, black); put(x, row + 1, black);
      if (i >= 5) { put(x, row - 1, black); put(x, row - 2, i !== 6 ? black : cream); }
    }
    put(head + d, row + 1, red); put(head - d, row - 1, black); put(head - d, row - 2, black);
    if (c.night > 0.3) put(head + d, row, rgb(255, 240, 170));
    for (let car = 0; car < 3; car++) for (let i = 0; i < 7; i++) { // three coaches, windows lit at night
      const x = head - d * (10 + car * 8 + i);
      put(x, row, maroon); put(x, row + 1, maroon); put(x, row - 1, maroon);
      if (i % 2) put(x, row - 1, c.night > 0.3 ? rgb(255, 210, 120) : cream);
    }
    if (Math.trunc(age * 5) !== Math.trunc((age - c.dt) * 5)) this.puffs.push([head - d, row - 3, 0]);
    for (const p of this.puffs) { // smoke drifts up and back, spreading and fading
      p[2] += c.dt;
      const px = p[0] - d * p[2] * 5, py = p[1] - p[2] * 4, a = p[2];
      if (a < 2.6 && px >= x0 && px < x1) disk(img, px, py, 0.6 + a * 0.8, mul(rgb(232, 232, 236), 0.5 + 0.5 * lum), 0.55 * (1 - a / 2.6));
    }
    this.puffs = this.puffs.filter(p => p[2] < 2.6);
  }
}

export class Canoes extends Egg {
  static egg = "canoes";
  static SPEED = 6.5;
  layer = "water"; perHour = 0.4; duration = (W + 50) / 6.5;
  allowed(c) { return c.now.month === 10 ? c.light + 0.3 * c.w.twi : 0; }
  begin(c) { this.rows = [c.rng.uniform(46, 49), c.rng.uniform(53, 56)]; return true; }
  depthRow() { return this.rows[0]; }
  draw(img, c, age) {
    const lum = 0.5 + 0.5 * c.light;
    const hull = mul(rgb(112, 72, 40), lum), crew = mul(rgb(40, 30, 26), lum), paddle = mul(rgb(190, 160, 110), lum);
    this.rows.forEach((row, k) => { // downriver is to the right (west)
      const x = -30 + age * Canoes.SPEED + k * 14;
      for (let i = 0; i < 13; i++) blend(img, x + i, row, hull, 1);
      blend(img, x - 1, row - 1, hull, 1); blend(img, x + 13, row - 1, hull, 1);
      for (let j = 0; j < 4; j++) {
        const px = x + 2 + j * 3;
        blend(img, px, row - 1, crew, 1); blend(img, px, row - 2, crew, 1);
        blend(img, px + (Math.sin(age * 4 + j * 1.3 + k) > 0 ? 1 : -1), row + 1, paddle, 1);
      }
    });
  }
}

export class TallShip extends Egg {
  static egg = "tallship";
  static SPEED = 5;
  layer = "water"; perHour = 0.12; duration = (W + 50) / 5;
  allowed(c) { return c.light + 0.5 * c.w.twi; }
  // The "lift" version sails close in, too tall for the bridge, so the lift span rises to let it through.
  begin(c) {
    const variant = this.variant || (c.rng.random() < 0.35 ? "lift" : "far");
    this.variant = null; this.lastVariant = variant === "lift" ? "lift" : "far";
    this.lift = this.lastVariant === "lift";
    if (this.lift) { this.k = 2.2; this.speed = 8; this.row = 57; }
    else { this.k = 1; this.speed = TallShip.SPEED; this.row = c.rng.uniform(41, 44); }
    this.duration = (W + 20 + 24 * this.k) / this.speed + (this.lift ? 6 : 0);
    this.saluteAt = this.duration * (this.lift ? 0.25 : 0.5);
    this.scene = c.scene;
    return true;
  }
  depthRow() { return this.row; }
  draw(img, c, age) {
    const k = this.k, x = W + 20 - age * this.speed, y = this.row; // sailing upriver (left)
    if (this.lift) { // raise the span before the bow arrives; lower it once the stern is clear
      const up = Math.min(1, Math.max(0, (130 - x) / 50)), down = Math.min(1, Math.max(0, (-24 * k - 5 - x) / 30));
      this.scene.liftRaise = age > this.duration - 0.2 ? 0 : up * (1 - down);
    }
    const lum = 0.5 + 0.5 * c.light;
    const hull = mul(rgb(70, 44, 30), lum), stripe = mul(rgb(230, 200, 120), lum), sail = mul(rgb(240, 236, 222), lum);
    const spar = mul(rgb(60, 44, 34), lum), flag = mul(rgb(200, 40, 40), lum);
    for (let i = 0; i < Math.trunc(22 * k); i++) {
      for (let d = 0; d < Math.round(k); d++) blend(img, x + i, y + d, hull, 1);
      blend(img, x + i, y - 1, i > 3 * k && i < 19 * k ? stripe : hull, 1);
      if (k > 1.5) blend(img, x + i, y - 2, i < 2 * k || i > 20 * k ? hull : mul(hull, 1.2), 1);
    }
    line(img, x - 5 * k, y - 3 * k, x, y - 1, spar, 1); // bowsprit
    [5, 11, 17].forEach((mx, m) => {
      const top = (m === 1 ? 13 : 11) * k;
      line(img, x + mx * k, y - 2, x + mx * k, y - top, spar, 1);
      [[7, 3, 3], [6, 3, 6], [4, 2, 9]].forEach(([wid, hgt, off], s) => { // courses, topsails, royals
        const billow = (Math.trunc(age * 2) + s + m) % 2 ? 0.85 : 1;
        const sw = wid * k * (k > 1.5 ? 0.8 : 1);
        for (let yy = 0; yy < Math.trunc(hgt * k) - (k > 1.5 ? 1 : 0); yy++) {
          for (let xx = -Math.trunc(sw / 2); xx < Math.trunc(sw) - Math.trunc(sw / 2); xx++) blend(img, x + mx * k + xx, y - off * k - yy, mul(sail, billow), 1);
        }
      });
      for (let fx = 0; fx < Math.trunc(2 * k); fx++) blend(img, x + mx * k + fx, y - top - 1, flag, 1);
    });
    const b = age - this.saluteAt; // the salute: a flash and a cloud of cannon smoke
    if (b >= 0 && b < 3) {
      if (b < 0.12) glow(img, x + 10 * k, y - 1, 5 * k, rgb(255, 180, 80), 0.9);
      for (let i = 0; i < 6; i++) {
        disk(img, x + 10 * k + b * 3 + i * 0.8 * k, y - 1 - b * 1.5 * k - (i % 3) * 0.7, (0.8 + b * 1.1) * k, rgb(230, 230, 232), 0.5 * (1 - b / 3));
      }
    }
  }
}

// ---------------------------------------------------------------- calendar specials

export class Fireworks extends Egg {
  static egg = "fireworks";
  static PALETTE = [[255, 70, 70], [80, 255, 120], [255, 215, 80], [90, 150, 255], [255, 255, 255], [220, 100, 255]];
  layer = "water"; duration = 45; perHour = 120; exclusive = false;
  allowed(c) {
    const n = c.now;
    const july4 = n.month === 7 && n.day === 4 && c.night > 0.5;
    const nye = (n.month === 12 && n.day === 31 && n.hour === 23 && n.minute >= 57) || (n.month === 1 && n.day === 1 && n.hour === 0 && n.minute < 20);
    return july4 || nye ? 1 : 0;
  }
  begin(c) { this.bursts = []; this.next = 0; this.rng = c.rng; return true; } // keeps the seeded dice for every burst
  draw(img, c, age) {
    const r = this.rng;
    if (age >= this.next && age < this.duration - 3) {
      const count = r.random() < 0.35 ? 2 : 1;
      for (let q = 0; q < count; q++) {
        const n = r.integers(32, 50);
        this.bursts.push({ x: r.uniform(30, W - 30), y: r.uniform(5, 19), t: age, launch: 0.6,
          col: rgb(...Fireworks.PALETTE[r.integers(Fireworks.PALETTE.length)]),
          // each spark at its own speed so the burst fills in, not a hollow ring
          dirs: Array.from({ length: n }, () => { const a = r.uniform(0, 2 * Math.PI); return [Math.cos(a), Math.sin(a), r.uniform(0.35, 1)]; }),
          speed: r.uniform(12, 18) });
      }
      this.next = age + r.uniform(0.45, 1.0);
    }
    for (const b of this.bursts) {
      const a = age - b.t;
      if (a < b.launch) { // the rocket climbing from the shore
        const ry = HORIZON - 1 - (HORIZON - 1 - b.y) * (a / b.launch);
        blend(img, b.x, ry, rgb(255, 200, 120), 1); blend(img, b.x, ry + 1, rgb(255, 150, 60), 0.5);
        continue;
      }
      const e = a - b.launch;
      if (e > 1.8) continue;
      const fade = 1 - e / 1.8;
      if (e < 0.15) glow(img, b.x, b.y, 14, b.col, 0.25);
      b.dirs.forEach(([dx, dy, f], k) => {
        for (const [trail, ta] of [[0, 1], [0.07, 0.5], [0.14, 0.25]]) { // short fading trails
          const et = Math.max(0, e - trail);
          const reach = b.speed * f * Math.min(et, 0.9) * (1 - 0.3 * et);
          const px = b.x + dx * reach, py = b.y + dy * reach + 4 * et * et;
          let al = 0.95 * fade * ta;
          if (e > 1 && trail === 0 && (k + Math.trunc(age * 12)) % 3 === 0) al *= 0.2; // twinkling as they die
          blend(img, px, py, mul(b.col, 0.7 + 0.3 * ta), al);
          if (trail === 0) {
            const ry = HORIZON + (HORIZON - py) * 0.45 + Math.sin(age * 9 + px) * 0.6; // on the river
            if (ry >= HORIZON && ry < H) blend(img, px, ry, b.col, 0.35 * fade);
          }
        }
      });
    }
    this.bursts = this.bursts.filter(b => age - b.t < b.launch + 1.8);
  }
}

export class Halloween extends Egg {
  static egg = "halloween";
  static WITCH = ["....k.....", "...kk.....", "..kkkk....", "....kk....", "bbbkkkkkkk", "b...k....."];
  layer = "water"; duration = 14; perHour = 6; exclusive = false;
  allowed(c) { return c.now.month === 10 && c.now.day === 31 ? isNight(c) : 0; }
  begin(c) {
    const wins = c.scene.windows, idx = [...wins.keys()];
    for (let i = idx.length - 1; i > 0; i--) { const j = c.rng.integers(i + 1); [idx[i], idx[j]] = [idx[j], idx[i]]; }
    this.lanterns = idx.slice(0, Math.min(14, idx.length)).map(i => wins[i]);
    this.y = c.melev > 0 ? c.my - 2 : 10;
    return true;
  }
  draw(img, c, age) {
    this.lanterns.forEach(([wx, wy], i) => { // flickering jack-o'-lantern windows
      const flick = 0.8 + 0.2 * Math.sin(age * 9 + i);
      for (const dx of [0, 1]) blend(img, wx + dx, wy, rgb(255, 110, 10), flick);
      glow(img, wx + 0.5, wy, 3, rgb(255, 120, 20), 0.35 * flick);
    });
    const x = W + 12 - age * (W + 44) / this.duration, y = this.y + Math.sin(age * 1.4) * 2; // across the moon
    const pal = { k: rgb(8, 6, 10), b: rgb(110, 72, 34) };
    Halloween.WITCH.forEach((row, r) => [...row].forEach((ch, k) => { // double size so she reads as a witch
      if (pal[ch]) for (const dy of [0, 1]) for (const dx of [0, 1]) blend(img, x + 2 * k + dx, y - 6 + 2 * r + dy, pal[ch], 1);
    }));
  }
}

export class Christmas extends Egg {
  static egg = "christmas";
  layer = "water"; duration = 14; perHour = 6; exclusive = false;
  allowed(c) { return c.now.month === 12 && c.now.day === 24 ? isNight(c) : 0; }
  begin(c) { this.y = c.melev > 0 ? c.my - 1 : 11; return true; }
  draw(img, c, age) {
    const x = W + 20 - age * (W + 60) / this.duration, y = this.y + Math.sin(age * 1.1) * 2;
    const red = rgb(210, 30, 30), gold = rgb(230, 190, 60), white = rgb(240, 240, 240), brown = rgb(110, 70, 40);
    for (let i = 0; i < 7; i++) { blend(img, x + 12 + i, y + 1, red, 1); blend(img, x + 12 + i, y + 2, i % 2 ? gold : red, 1); }
    blend(img, x + 14, y, red, 1); blend(img, x + 14, y - 1, white, 1);
    for (let i = 0; i < 8; i++) blend(img, x + 11 + i, y + 3, gold, 1); // runner
    for (let k = 0; k < 4; k++) { // four reindeer in pairs, Rudolph's red nose leading
      const rx = x + 9 - k * 3, ry = y + (k % 2), gait = Math.trunc(age * 6 + k) % 2;
      blend(img, rx, ry, brown, 1); blend(img, rx + 1, ry, brown, 1); blend(img, rx - 1, ry - 1, brown, 1);
      blend(img, rx + (gait * 2 - 1), ry + 1, brown, 1);
    }
    blend(img, x - 3, y - 1, rgb(255, 40, 40), 0.6 + 0.4 * Math.sin(age * 8));
    line(img, x - 2, y, x + 12, y + 2, gold, 0.5); // harness
  }
}

export class HolidayLights extends Egg {
  static egg = "holidaylights";
  static COLORS = [[255, 60, 60], [60, 255, 90], [70, 140, 255], [255, 210, 60]];
  layer = "top"; duration = 600; perHour = 200; exclusive = false;
  allowed(c) { const n = c.now; return (n.month === 12 && n.day >= 20) || (n.month === 1 && n.day === 1) ? isNight(c, 0.3) : 0; }
  draw(img, c, age) {
    const sc = c.scene, S = sc.constructor, C = HolidayLights.COLORS;
    let i = 0;
    for (let z = S.Z_NEAR + 0.05; z < S.Z_FAR; z *= 1.06) { // along the deck and the bottom of the trusses
      for (const up of [0, -S.DECK_TRUSS]) {
        const [x, y] = sc.project(z, up);
        if ((i + Math.trunc(age * 3)) % 4) blend(img, x, y, rgb(...C[i % 4]), 0.95);
        i++;
      }
    }
    for (const zt of S.LIFT) for (let k = 0; k < 6; k++) { // up the lift towers
      const [x, y] = sc.project(zt, S.TOWER_H * k / 5);
      if ((k + Math.trunc(age * 3)) % 3) blend(img, x, y, rgb(...C[k % 4]), 0.95);
    }
  }
}

// The full moon nearest the autumn equinox (local date), as [year, month, day].
const harvestCache = {};
export function harvestDate(year) {
  if (!harvestCache[year]) {
    const phase = ms => ((((ms / 1000 - 947182440) / 86400) % 29.530588853) + 29.530588853) % 29.530588853 / 29.530588853;
    const base = hoodRiverTime(year, 9, 23, 21, 0);
    const vals = [];
    for (let d = -31; d <= 31; d++) vals.push([d, Math.abs(phase(base + d * 86400e3) - 0.5)]);
    const minima = [];
    for (let i = 1; i < vals.length - 1; i++) if (vals[i][1] < vals[i - 1][1] && vals[i][1] < vals[i + 1][1]) minima.push(vals[i][0]);
    const best = minima.reduce((a, b) => (Math.abs(b) < Math.abs(a) ? b : a));
    const p = localParts(base + best * 86400e3);
    harvestCache[year] = [p.year, p.month, p.day];
  }
  return harvestCache[year];
}

export class HarvestMoon extends Egg {
  static egg = "harvestmoon";
  layer = "sky"; duration = 600; perHour = 200; exclusive = false;
  allowed(c) {
    const [y, m, d] = harvestDate(c.now.year);
    const near = Math.abs(dayNumber(c.now.year, c.now.month, c.now.day) - dayNumber(y, m, d)) <= 1;
    return near && c.night > 0.3 && c.melev > -2 && c.melev < 18 ? 1 : 0;
  }
  begin(c) { this.forcedPos = c.melev > -2 && c.melev < 18 ? null : [44, 24]; return true; } // forced: low in the east
  draw(img, c, age) {
    const [x, y] = this.forcedPos || [c.mx, c.my];
    const fade = smoothFade(age, this.duration, 4) * (1 - 0.8 * c.veil);
    glow(img, x, y, 16, rgb(255, 150, 60), 0.35 * fade);
    for (let yy = -7; yy <= 7; yy++) for (let xx = -7; xx <= 7; xx++) {
      if (xx * xx + yy * yy > 6.8 ** 2) continue;
      const k = (yy + 7) / 14; // oranger toward the horizon
      let col = [0, 1, 2].map(j => rgb(255, 205, 130)[j] * (1 - k) + rgb(255, 140, 50)[j] * k);
      if ((((xx * 3 + yy * 5) % 11) + 11) % 11 === 0 || (xx - 2) ** 2 + (yy + 1) ** 2 < 4) col = mul(col, 0.82); // maria
      blend(img, x + xx, y + yy, col, fade);
    }
  }
}

// ---------------------------------------------------------------- just for fun

export class Satellites extends Egg {
  static egg = "satellites";
  layer = "sky"; duration = 26; perHour = 0.4; exclusive = false;
  allowed(c) { return c.night > 0.6 && c.veil < 0.5 ? 1 : 0; }
  begin(c) { this.y0 = c.rng.uniform(10, 22); this.slope = c.rng.uniform(-0.35, -0.1); this.n = c.rng.integers(20, 30); return true; }
  draw(img, c, age) {
    const head = -10 + age * 13;
    for (let k = 0; k < this.n; k++) {
      const x = head - k * 4.2, y = this.y0 + x * this.slope * 0.25;
      if (x >= 0 && x < W && y >= 0 && y < HORIZON) blend(img, x, y, rgb(235, 238, 255), 0.75 * (0.8 + 0.2 * Math.sin(age * 3 + k)));
    }
  }
}

export class Hydroplanes extends Egg {
  static egg = "hydroplanes";
  static SPEED = 62;
  layer = "water"; duration = 8; perHour = 0.2;
  allowed(c) { return c.w.day + 0.5 * c.w.gold; }
  begin(c) { this.dir = c.rng.choice([-1, 1]); this.rows = [c.rng.uniform(47, 50), c.rng.uniform(54, 58)]; this.spray = []; this.rng = c.rng; return true; }
  depthRow() { return (this.rows[0] + this.rows[1]) / 2; }
  draw(img, c, age) {
    const d = this.dir;
    this.rows.forEach((row, k) => {
      const x = d > 0 ? -15 + age * (Hydroplanes.SPEED - 4 * k) : W + 15 - age * (Hydroplanes.SPEED - 4 * k);
      if (age < this.duration - 1.5) {
        for (let q = 0; q < 4; q++) this.spray.push([x - d * 5, row, age, this.rng.uniform(-1, 1)]);
        const hull = rgb(245, 245, 245);
        for (let i = 0; i < 6; i++) { blend(img, x - d * i, row, hull, 1); blend(img, x - d * i, row - 1, i === 2 || i === 3 ? rgb(210, 30, 40) : hull, 1); }
        blend(img, x - d * 3, row - 2, rgb(30, 40, 60), 1); // cockpit
      }
    });
    for (const s of this.spray) { // roostertails: up and back, hanging, then falling away
      const a = age - s[2];
      if (a > 1.1) continue;
      const sx = s[0] - d * a * 10 + s[3] * 2, sy = s[1] - Math.sin(Math.PI * Math.min(1, a / 1.1)) * 10 * (0.6 + 0.4 * Math.abs(s[3]));
      blend(img, sx, sy, rgb(240, 245, 255), 0.7 * (1 - a / 1.1));
    }
    this.spray = this.spray.filter(s => age - s[2] <= 1.1);
  }
}

export class BigSpider extends Egg {
  static egg = "bigspider";
  layer = "top"; duration = 7; perHour = 0.15;
  begin(c) {
    this.x = c.rng.uniform(50, W - 50);
    const r = new Rng(Math.trunc(this.x));
    this.hair = Array.from({ length: 16 * 26 }, () => r.random());
    return true;
  }
  draw(img, c, age) {
    const up = age < 5.6 ? Math.min(1, age / 1.2) : Math.max(0, 1 - (age - 5.6) / 0.9);
    const top = H - 15 * up, cx = this.x + Math.sin(age * 1.3) * 0.6;
    const look = age > 1.2 && age < 5.6 ? Math.sin(age * 1.6) * 0.8 : 0; // its eyes track side to side
    const fur = rgb(36, 32, 40), band = rgb(225, 225, 225);
    for (let yy = 0; yy < 16; yy++) for (let xx = -12; xx <= 12; xx++) { // fuzzy head
      if ((xx / 12) ** 2 + ((yy - 8) / 8) ** 2 <= 1) blend(img, cx + xx, top + yy, mul(fur, this.hair[yy * 26 + xx + 12] > 0.86 ? 1.4 : 1), 1);
    }
    for (let xx = -6; xx <= 6; xx += 2) blend(img, cx + xx, top + 2, band, 0.9); // white band across the brow
    for (const ex of [-3.6, 3.6]) { // the two huge front eyes
      disk(img, cx + ex, top + 6.5, 2.6, rgb(6, 6, 10));
      blend(img, cx + ex - 1 + look, top + 5, rgb(255, 255, 255), 1);
      blend(img, cx + ex + look, top + 5, rgb(170, 190, 220), 0.6);
    }
    for (const ex of [-8, 8]) { disk(img, cx + ex, top + 6, 1.1, rgb(8, 8, 12)); blend(img, cx + ex, top + 5, rgb(220, 220, 230), 0.8); }
    for (const chx of [-2, 2]) { disk(img, cx + chx, top + 11.5, 1.8, rgb(40, 200, 150)); blend(img, cx + chx - 1, top + 11, rgb(120, 180, 255), 0.7); }
    for (const px of [-6, 6]) { disk(img, cx + px, top + 12, 1.2, fur); blend(img, cx + px, top + 11, band, 0.9); }
    for (const sx of [-1, 1]) for (let i = 0; i < 6; i++) { // front legs reaching down out of frame
      blend(img, cx + sx * (10 + i), top + 10 + i, fur, 1);
      blend(img, cx + sx * (11 + i), top + 10 + i, i % 2 ? fur : mul(band, 0.6), 1);
    }
  }
}

export const BATCH2 = [SeaLion, Geese, Heron, Paragliders, Sturgeon, SteamTrain, Canoes, TallShip,
  Fireworks, Halloween, Christmas, HolidayLights, HarvestMoon, Satellites, Hydroplanes, BigSpider];
